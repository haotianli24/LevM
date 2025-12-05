"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { AppLayout } from "@/components/app-layout"
import { Market } from "@/lib/types"

// Hardcoded featured markets (multi-outcome events)
const FEATURED_MARKETS = [
  {
    id: 'gta-vi-events',
    name: 'What will happen before GTA VI?',
    slug: 'what-will-happen-before-gta-vi',
    oraclePrice: 0.49,
    volume: 12147911,
    liquidity: 95,
    change24h: 2.4,
    isEvent: true,
    description: 'Multiple event outcomes before GTA VI release'
  },
  {
    id: 'trump-epstein-files',
    name: 'Will Trump release Epstein files by...?',
    slug: 'will-trump-release-epstein-files-by',
    oraclePrice: 0.66,
    volume: 3093522,
    liquidity: 88,
    change24h: 5.2,
    isEvent: true,
    description: 'Multiple deadline outcomes for Epstein files release'
  },
  {
    id: 'trump-kennedy-center',
    name: 'What will Trump say during Kennedy Center Honors on December 7?',
    slug: 'what-will-trump-say-during-kennedy-center-honors-on-december-7',
    oraclePrice: 0.52,
    volume: 18328,
    liquidity: 72,
    change24h: -1.3,
    isEvent: true,
    description: 'Multiple word/phrase mentions during the event'
  }
]

export default function MarketsPage() {
  const router = useRouter()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loadingMarkets, setLoadingMarkets] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchMarkets = async () => {
    setLoadingMarkets(true)
    try {
      const response = await fetch('/api/polymarket/markets?limit=6')
      if (response.ok) {
        const data = await response.json()
        setMarkets(data)
      } else {
        console.error('Failed to fetch markets')
      }
    } catch (error) {
      console.error('Error fetching markets:', error)
    } finally {
      setLoadingMarkets(false)
    }
  }

  useEffect(() => {
    // Use featured markets instead of fetching
    setMarkets(FEATURED_MARKETS as Market[])
  }, [])

  const fetchMarketInfo = async (marketId: string, slug?: string) => {
    try {
      const url = slug 
        ? `/api/polymarket/market?slug=${encodeURIComponent(slug)}`
        : `/api/polymarket/market?id=${encodeURIComponent(marketId)}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        return data
      }
      return null
    } catch (error) {
      console.error('Error fetching market info:', error)
      return null
    }
  }

  const handleMarketClick = async (market: Market) => {
    // Use slug if available, otherwise fall back to ID
    const marketSlug = market.slug || market.id
    
    if (!marketSlug) {
      console.error('Market has no slug or id:', market)
      return
    }
    
    console.log('Navigating to market:', { slug: marketSlug, id: market.id, hasSlug: !!market.slug })
    
    // Navigate directly - the detail page will fetch the full market info
    router.push(`/markets/${encodeURIComponent(marketSlug)}`)
  }

  return (
    <AppLayout title="Markets">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border-zinc-800"
            />
          </div>
        </div>
        {markets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No markets available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets
              .filter(market =>
                market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (market.description && market.description.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .map((market) => (
                <Card
                  key={market.id}
                  className="bg-card border-zinc-800 p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleMarketClick(market)}
                >
                  <div className="mb-2">
                    <p className="font-semibold text-sm mb-1">{market.name}</p>
                    {(market as any).isEvent && (
                      <span className="inline-block px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                        Multi-Outcome Event
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Yes</span>
                      <span className="font-mono text-green-500">{((market.oraclePrice || 0) * 100).toFixed(0)}¢</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">No</span>
                      <span className="font-mono text-red-500">{((1 - (market.oraclePrice || 0)) * 100).toFixed(0)}¢</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Volume</span>
                      <span className="font-mono">${(market.volume || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">24h Change</span>
                      <span className={`font-mono ${(market.change24h || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {(market.change24h || 0) >= 0 ? "+" : ""}
                        {(market.change24h || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

