import { NextRequest, NextResponse } from 'next/server'
import { positionStore } from '@/lib/position-store'
import { LiquidationEngine } from '@/lib/liquidation-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { positionId, userAddress } = body

    if (!positionId || !userAddress) {
      return NextResponse.json(
        { error: 'Position ID and user address required' },
        { status: 400 }
      )
    }

    const position = positionStore.getPosition(positionId)

    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      )
    }

    if (position.userAddress !== userAddress) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (position.status !== 'active') {
      return NextResponse.json(
        { error: 'Position is not active' },
        { status: 400 }
      )
    }

    const positionSize = position.collateral * position.leverage
    const pnl = position.side === 'long'
      ? ((position.currentPrice - position.entryPrice) / position.entryPrice) * positionSize
      : ((position.entryPrice - position.currentPrice) / position.entryPrice) * positionSize

    const finalBalance = position.collateral + pnl

    positionStore.closePosition(positionId)

    return NextResponse.json({
      success: true,
      position: {
        ...position,
        status: 'closed',
      },
      pnl,
      finalBalance: Math.max(0, finalBalance),
      message: `Position closed at $${position.currentPrice.toFixed(4)}`,
    })

  } catch (error) {
    console.error('Error closing position:', error)
    return NextResponse.json(
      { error: 'Failed to close position' },
      { status: 500 }
    )
  }
}
