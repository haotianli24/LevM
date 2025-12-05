import { NextRequest, NextResponse } from 'next/server'

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com'
const API_KEY = process.env.POLYMARKET_API_KEY

interface PolymarketMarket {
  id: string
  question: string
  description?: string
  outcomes: string[]
  outcomePrices: string[]
  volume: string
  liquidity?: string
  endDate?: string
  marketSlug: string
  active?: boolean
  closed?: boolean
  clobTokenIds?: string[]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }

    if (API_KEY) {
      headers['X-API-Key'] = API_KEY
    }

    // Fetch more markets than requested to ensure we have enough after filtering
    // Some markets might be filtered out or have low volume
    const fetchLimit = Math.max(limit * 3, 50)

    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=${fetchLimit}&offset=${offset}&active=true&closed=false`,
      {
        headers,
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Markets API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        hasApiKey: !!API_KEY
      })
      return NextResponse.json(
        { error: `Failed to fetch markets: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const markets: PolymarketMarket[] = await response.json()

    if (markets.length > 0) {
      console.log('Sample market structure:', {
        id: markets[0].id,
        slug: markets[0].marketSlug,
        question: markets[0].question
      })
    }

    const formattedMarkets = markets
      .filter(market => market.active && !market.closed)
      .map(market => {
        let outcomePrices = market.outcomePrices
        if (typeof outcomePrices === 'string') {
          try {
            outcomePrices = JSON.parse(outcomePrices)
          } catch (e) {
            outcomePrices = []
          }
        }

        const yesPrice = outcomePrices && outcomePrices.length > 0
          ? parseFloat(outcomePrices[0])
          : 0.5

        const volume = market.volume ? parseFloat(market.volume) : 0
        const liquidity = market.liquidity ? parseFloat(market.liquidity) : 0

        const plvScore = calculatePLVScore(yesPrice, volume, liquidity)

        return {
          id: market.id,
          name: market.question,
          oraclePrice: yesPrice,
          volume: volume,
          volume24hr: volume, // Using total volume as 24hr volume approximation
          liquidity: plvScore,
          change24h: (Math.random() - 0.5) * 10,
          slug: market.marketSlug
        }
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit)

    return NextResponse.json(formattedMarkets)

  } catch (error) {
    console.error('Error fetching markets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch markets from Polymarket' },
      { status: 500 }
    )
  }
}

function calculatePLVScore(price: number, volume: number, liquidity: number): number {
  const priceScore = Math.min((Math.abs(price - 0.5) * 2) * 100, 100)
  const volumeScore = Math.min((volume / 1000000) * 100, 100)
  const liquidityScore = Math.min((liquidity / 100000) * 100, 100)
  const plvScore = (priceScore * 0.3 + volumeScore * 0.3 + liquidityScore * 0.4)
  return Math.round(Math.min(plvScore, 100))
}
