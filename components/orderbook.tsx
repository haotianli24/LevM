import { useOrderbook } from '@/hooks/use-orderbook'
import { Card } from '@/components/ui/card'
import { useMemo } from 'react'

interface OrderbookProps {
  assetIds: string[]
  maxLevels?: number
}

export function Orderbook({ assetIds, maxLevels = 15 }: OrderbookProps) {
  const { orderbook, connected } = useOrderbook(assetIds)

  const { bids, asks, spread, midPrice } = useMemo(() => {
    if (!orderbook) return { bids: [], asks: [], spread: null, midPrice: null }

    const bids = orderbook.bids.slice(0, maxLevels)
    const asks = orderbook.asks.slice(0, maxLevels)

    const bestBid = bids[0] ? parseFloat(bids[0].price) : null
    const bestAsk = asks[0] ? parseFloat(asks[0].price) : null

    const spread = bestBid && bestAsk ? bestAsk - bestBid : null
    const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null

    return { bids, asks, spread, midPrice }
  }, [orderbook, maxLevels])

  const maxBidSize = useMemo(() => 
    Math.max(...bids.map(b => parseFloat(b.size)), 0), 
    [bids]
  )
  
  const maxAskSize = useMemo(() => 
    Math.max(...asks.map(a => parseFloat(a.size)), 0), 
    [asks]
  )

  if (!connected) {
    return (
      <Card className="bg-card border-zinc-800 p-6">
        <div className="text-center text-muted-foreground">Connecting to orderbook...</div>
      </Card>
    )
  }

  if (!orderbook) {
    return (
      <Card className="bg-card border-zinc-800 p-6">
        <div className="text-center text-muted-foreground">Loading orderbook...</div>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Order Book</h3>
        {connected && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 px-4 py-2 text-xs font-mono text-muted-foreground border-b border-zinc-800">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      <div className="relative">
        <div className="h-[300px] overflow-y-auto">
          {asks.slice().reverse().map((ask, idx) => {
            const size = parseFloat(ask.size)
            const price = parseFloat(ask.price)
            const total = size * price
            const percentage = (size / maxAskSize) * 100

            return (
              <div
                key={`ask-${idx}`}
                className="relative grid grid-cols-3 px-4 py-1.5 text-xs font-mono hover:bg-accent/20 transition-colors"
              >
                <div
                  className="absolute inset-0 bg-red-500/10"
                  style={{ width: `${percentage}%`, right: 0, left: 'auto' }}
                />
                <div className="relative text-red-400">{price.toFixed(4)}</div>
                <div className="relative text-right">{size.toFixed(2)}</div>
                <div className="relative text-right text-muted-foreground">{total.toFixed(2)}</div>
              </div>
            )
          })}
        </div>

        <div className="px-4 py-3 bg-accent/30 border-y border-zinc-800">
          <div className="flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-muted-foreground">Spread:</span>
              <span className="ml-2 text-foreground">
                {spread !== null ? spread.toFixed(4) : '--'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Mid:</span>
              <span className="ml-2 text-primary font-semibold">
                ${midPrice !== null ? midPrice.toFixed(4) : '--'}
              </span>
            </div>
          </div>
        </div>

        <div className="h-[300px] overflow-y-auto">
          {bids.map((bid, idx) => {
            const size = parseFloat(bid.size)
            const price = parseFloat(bid.price)
            const total = size * price
            const percentage = (size / maxBidSize) * 100

            return (
              <div
                key={`bid-${idx}`}
                className="relative grid grid-cols-3 px-4 py-1.5 text-xs font-mono hover:bg-accent/20 transition-colors"
              >
                <div
                  className="absolute inset-0 bg-green-500/10"
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative text-green-400">{price.toFixed(4)}</div>
                <div className="relative text-right">{size.toFixed(2)}</div>
                <div className="relative text-right text-muted-foreground">{total.toFixed(2)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
