import { useState, useEffect, useRef } from 'react'

interface OrderLevel {
  price: string
  size: string
}

interface OrderbookData {
  bids: OrderLevel[]
  asks: OrderLevel[]
  timestamp: string
}

export function useOrderbook(assetIds: string[]) {
  const [orderbook, setOrderbook] = useState<OrderbookData | null>(null)
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (assetIds.length === 0) return

    console.log('[Hook] Connecting to orderbook for:', assetIds)
    const params = new URLSearchParams({ assetIds: assetIds.join(',') })
    const eventSource = new EventSource(`/api/orderbook-ws?${params}`)
    eventSourceRef.current = eventSource

    eventSource.onerror = (error) => {
      console.error('[Hook] SSE error:', error)
      setConnected(false)
      eventSource.close()
      
      setTimeout(() => {
        console.log('[Hook] Reconnecting...')
        if (eventSourceRef.current === eventSource) {
          const newEventSource = new EventSource(`/api/orderbook-ws?${params}`)
          eventSourceRef.current = newEventSource
        }
      }, 3000)
    }

    eventSource.onopen = () => {
      console.log('[Hook] SSE connection opened')
      setConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('[Hook] Received message:', data.type || data.event_type)
        
        if (data.type === 'ping' || data.type === 'connected') return

        if (data.event_type === 'book') {
          console.log('[Hook] Book update:', data.bids?.length, 'bids,', data.asks?.length, 'asks')
          setOrderbook({
            bids: data.bids || [],
            asks: data.asks || [],
            timestamp: data.timestamp
          })
        } else if (data.event_type === 'price_change') {
          setOrderbook(prev => {
            if (!prev) return null
            
            const newOrderbook = { ...prev }
            
            data.price_changes?.forEach((change: any) => {
              const price = parseFloat(change.price)
              const size = parseFloat(change.size)
              
              if (change.side === 'BUY') {
                if (size === 0) {
                  newOrderbook.bids = newOrderbook.bids.filter(b => b.price !== change.price)
                } else {
                  const existingIndex = newOrderbook.bids.findIndex(b => b.price === change.price)
                  if (existingIndex >= 0) {
                    newOrderbook.bids[existingIndex].size = change.size
                  } else {
                    newOrderbook.bids.push({ price: change.price, size: change.size })
                    newOrderbook.bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
                  }
                }
              } else {
                if (size === 0) {
                  newOrderbook.asks = newOrderbook.asks.filter(a => a.price !== change.price)
                } else {
                  const existingIndex = newOrderbook.asks.findIndex(a => a.price === change.price)
                  if (existingIndex >= 0) {
                    newOrderbook.asks[existingIndex].size = change.size
                  } else {
                    newOrderbook.asks.push({ price: change.price, size: change.size })
                    newOrderbook.asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
                  }
                }
              }
            })
            
            newOrderbook.timestamp = data.timestamp
            return newOrderbook
          })
        }
      } catch (error) {
        console.error('Parse error:', error)
      }
    }

    eventSource.onerror = () => {
      setConnected(false)
    }

    return () => {
      eventSource.close()
      setConnected(false)
    }
  }, [assetIds.join(',')])

  return { orderbook, connected }
}
