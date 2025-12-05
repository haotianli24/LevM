import { NextRequest, NextResponse } from 'next/server'
import { polymarketCLOB } from '@/lib/polymarket-clob'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tokenId = searchParams.get('tokenId')

    if (!tokenId) {
      return NextResponse.json(
        { error: 'Token ID required' },
        { status: 400 }
      )
    }

    console.log('Fetching order book for token:', tokenId)

    try {
      const orderBook = await polymarketCLOB.getOrderBook(tokenId)

      console.log('Order Book API Response:', {
        tokenId,
        bidsCount: orderBook.bids?.length || 0,
        asksCount: orderBook.asks?.length || 0,
        firstBid: orderBook.bids?.[0],
        firstAsk: orderBook.asks?.[0],
      })

      return NextResponse.json({
        success: true,
        orderBook
      })
    } catch (clobError) {
      console.error('CLOB API Error:', {
        tokenId,
        error: clobError instanceof Error ? clobError.message : String(clobError),
        stack: clobError instanceof Error ? clobError.stack : undefined
      })
      
      // Return empty order book instead of error to prevent UI from breaking
      return NextResponse.json({
        success: true,
        orderBook: {
          bids: [],
          asks: [],
          error: 'Order book temporarily unavailable'
        }
      })
    }

  } catch (error) {
    console.error('Error getting order book:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get order book' },
      { status: 500 }
    )
  }
}

