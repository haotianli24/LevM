import WebSocket from 'ws'

interface OrderSummary {
  price: string
  size: string
}

interface BookMessage {
  event_type: 'book'
  asset_id: string
  market: string
  timestamp: string
  hash: string
  bids: OrderSummary[]
  asks: OrderSummary[]
}

interface PriceChange {
  asset_id: string
  price: string
  size: string
  side: 'BUY' | 'SELL'
  hash: string
  best_bid: string
  best_ask: string
}

interface PriceChangeMessage {
  event_type: 'price_change'
  market: string
  price_changes: PriceChange[]
  timestamp: string
}

type MarketMessage = BookMessage | PriceChangeMessage

interface SubscriptionConfig {
  assetIds: string[]
  onBook?: (data: BookMessage) => void
  onPriceChange?: (data: PriceChangeMessage) => void
  onError?: (error: Error) => void
}

export class PolymarketWebSocket {
  private ws: WebSocket | null = null
  private url = 'wss://ws-subscriptions-clob.polymarket.com/ws/market'
  private assetIds: string[] = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private pingInterval: NodeJS.Timeout | null = null
  private onBook?: (data: BookMessage) => void
  private onPriceChange?: (data: PriceChangeMessage) => void
  private onError?: (error: Error) => void

  constructor(config: SubscriptionConfig) {
    this.assetIds = config.assetIds
    this.onBook = config.onBook
    this.onPriceChange = config.onPriceChange
    this.onError = config.onError
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url)

      this.ws.on('open', () => {
        this.reconnectAttempts = 0
        this.subscribe()
        this.startPing()
      })

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = data.toString()
          if (message === 'PONG') return

          const parsed: MarketMessage = JSON.parse(message)
          
          if (parsed.event_type === 'book' && this.onBook) {
            this.onBook(parsed)
          } else if (parsed.event_type === 'price_change' && this.onPriceChange) {
            this.onPriceChange(parsed)
          }
        } catch (error) {
          if (this.onError) {
            this.onError(error instanceof Error ? error : new Error('Parse error'))
          }
        }
      })

      this.ws.on('error', (error) => {
        if (this.onError) {
          this.onError(error)
        }
      })

      this.ws.on('close', () => {
        this.stopPing()
        this.attemptReconnect()
      })
    } catch (error) {
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error('Connection error'))
      }
    }
  }

  private subscribe() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        assets_ids: this.assetIds,
        type: 'market'
      }))
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('PING')
      }
    }, 10000)
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        this.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  updateAssets(assetIds: string[]) {
    this.assetIds = assetIds
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.subscribe()
    }
  }

  disconnect() {
    this.stopPing()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
