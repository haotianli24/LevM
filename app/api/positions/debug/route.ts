import { NextRequest, NextResponse } from 'next/server'
import { hybridPositionStore } from '@/lib/hybrid-position-store'

/**
 * Debug endpoint to check position store status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userAddress = searchParams.get('userAddress')

    const stats = hybridPositionStore.getStats()
    
    let userPositions = null
    if (userAddress) {
      userPositions = await hybridPositionStore.getUserPositions(userAddress)
    }

    return NextResponse.json({
      stats,
      userAddress,
      userPositions: userPositions?.map(p => ({
        id: p.id,
        marketName: p.marketName,
        side: p.side,
        status: p.status,
        userAddress: p.userAddress,
        createdAt: p.createdAt,
      })) || null,
      allActivePositions: hybridPositionStore.getAllActivePositions().map(p => ({
        id: p.id,
        userAddress: p.userAddress,
        marketName: p.marketName,
        status: p.status,
      })),
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[Debug API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get debug info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

