import { NextRequest, NextResponse } from 'next/server'
import { positionStore } from '@/lib/position-store'
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

    const positions = positionStore.getUserPositions(userAddress)

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

    return NextResponse.json({
      positions: enrichedPositions,
      total: enrichedPositions.length,
    })

  } catch (error) {
    console.error('Error listing positions:', error)
    return NextResponse.json(
      { error: 'Failed to list positions' },
      { status: 500 }
    )
  }
}
