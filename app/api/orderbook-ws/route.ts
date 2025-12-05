import { NextRequest } from 'next/server'
import { polymarketCLOB } from '@/lib/polymarket-clob'

const clients = new Map<string, Set<ReadableStreamDefaultController>>()

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const assetIds = searchParams.get('assetIds')?.split(',') || []

  if (assetIds.length === 0) {
    return new Response('Asset IDs required', { status: 400 })
  }

  const key = assetIds.sort().join(',')
  console.log('[SSE] New client connecting for assets:', assetIds)

  const stream = new ReadableStream({
    async start(controller) {
      console.log('[SSE] Sending connected message')
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))
      
      for (const assetId of assetIds) {
        try {
          console.log('[SSE] Fetching initial orderbook for:', assetId)
          const orderbook = await polymarketCLOB.getOrderBook(assetId)
          const bookMessage = {
            event_type: 'book',
            asset_id: assetId,
            bids: orderbook.bids || [],
            asks: orderbook.asks || [],
            timestamp: Date.now().toString()
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(bookMessage)}\n\n`))
          console.log('[SSE] Sent initial book:', orderbook.bids?.length, 'bids,', orderbook.asks?.length, 'asks')
        } catch (error) {
          console.error('[SSE] Error fetching initial orderbook:', error)
        }
      }
      
      if (!clients.has(key)) {
        clients.set(key, new Set())
        startWebSocketConnection(key, assetIds)
      }
      
      clients.get(key)?.add(controller)

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping' })}\n\n`))
        } catch {
          clearInterval(keepAlive)
        }
      }, 15000)

      return () => {
        clearInterval(keepAlive)
        const clientSet = clients.get(key)
        if (clientSet) {
          clientSet.delete(controller)
          if (clientSet.size === 0) {
            clients.delete(key)
          }
        }
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

function startWebSocketConnection(key: string, assetIds: string[]) {
  console.log('[WS] Starting WebSocket connection for:', assetIds)
  const WS = require('ws')
  const ws = new WS('wss://ws-subscriptions-clob.polymarket.com/ws/market')

  ws.on('open', () => {
    console.log('[WS] Connected, subscribing to assets:', assetIds)
    const subscribeMsg = JSON.stringify({
      assets_ids: assetIds,
      type: 'market'
    })
    console.log('[WS] Sending subscription:', subscribeMsg)
    ws.send(subscribeMsg)

    const pingInterval = setInterval(() => {
      if (ws.readyState === WS.OPEN) {
        ws.send('PING')
      }
    }, 10000)

    ws.pingInterval = pingInterval
  })

  ws.on('message', (data: Buffer) => {
    try {
      const message = data.toString()
      if (message === 'PONG') return

      const parsed = JSON.parse(message)
      console.log('[WS] Raw message:', JSON.stringify(parsed).slice(0, 200))
      console.log('[WS] Message type:', parsed.event_type || parsed.type || 'unknown')
      
      const clientSet = clients.get(key)
      
      if (clientSet) {
        const encoder = new TextEncoder()
        const encodedData = encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`)
        console.log('[WS] Broadcasting to', clientSet.size, 'clients')
        clientSet.forEach(controller => {
          try {
            controller.enqueue(encodedData)
          } catch (error) {
            console.error('[WS] Error enqueueing to client:', error)
            clientSet.delete(controller)
          }
        })
      }
    } catch (error) {
      console.error('[WS] Message error:', error)
    }
  })

  ws.on('error', (error: Error) => {
    console.error('WS error:', error)
  })

  ws.on('close', () => {
    if (ws.pingInterval) {
      clearInterval(ws.pingInterval)
    }
    
    if (clients.has(key) && clients.get(key)!.size > 0) {
      setTimeout(() => startWebSocketConnection(key, assetIds), 3000)
    }
  })
}
