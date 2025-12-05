import { NextRequest, NextResponse } from 'next/server'
import { hybridPositionStore } from '@/lib/hybrid-position-store'
import { LiquidationEngine } from '@/lib/liquidation-engine'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userAddress = searchParams.get('userAddress')

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400 }
      )
    }

    console.log('[API] Fetching positions for user:', userAddress)

    // Fetch positions from hybrid store (checks local and on-chain)
    const positions = await hybridPositionStore.getUserPositions(userAddress)
    
    console.log('[API] Found positions:', {
      count: positions.length,
      positionIds: positions.map(p => p.id),
      userAddress
    })

    const enrichedPositions = positions.map(position => {
      const marginRatio = LiquidationEngine.calculateMarginRatio(
        position.entryPrice,
        position.currentPrice,
        position.side,
        position.collateral,
        position.leverage
      )

      const health = LiquidationEngine.getMarginHealth(
        marginRatio,
        position.maintenanceMargin
      )

      const positionSize = position.collateral * position.leverage
      const pnl = position.side === 'long'
        ? ((position.currentPrice - position.entryPrice) / position.entryPrice) * positionSize
        : ((position.entryPrice - position.currentPrice) / position.entryPrice) * positionSize

      const pnlPercentage = (pnl / position.collateral) * 100

      return {
        ...position,
        marginRatio: marginRatio * 100,
        health,
        pnl,
        pnlPercentage,
        positionSize,
      }
    })

    console.log('[API] Returning enriched positions:', {
      count: enrichedPositions.length,
      positions: enrichedPositions.map(p => ({
        id: p.id,
        market: p.marketName,
        side: p.side,
        status: p.status
      }))
    })

    return NextResponse.json({
      positions: enrichedPositions,
      total: enrichedPositions.length,
      source: 'hybrid-store',
    })

  } catch (error) {
    console.error('[API] Error listing positions:', error)
    return NextResponse.json(
      { error: 'Failed to list positions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
