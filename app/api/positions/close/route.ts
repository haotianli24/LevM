import { NextRequest, NextResponse } from 'next/server'
import { hybridPositionStore } from '@/lib/hybrid-position-store'
import { depositStore } from '@/lib/deposit-store'
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

    const position = hybridPositionStore.getPosition(positionId)

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

    // Return funds to user's available balance
    // Return the final balance (collateral + PnL), but at least 0
    const returnAmount = Math.max(0, finalBalance)
    depositStore.returnBalance(userAddress, returnAmount)

    console.log('[API] Position closed - Returning funds:', {
      positionId,
      userAddress,
      collateral: position.collateral,
      pnl,
      finalBalance,
      returnAmount
    })

    // Close position in hybrid store (updates both local and on-chain)
    await hybridPositionStore.closePosition(positionId)

    return NextResponse.json({
      success: true,
      position: {
        ...position,
        status: 'closed',
      },
      pnl,
      finalBalance: returnAmount,
      isDemo: true,
      message: `Position closed at $${position.currentPrice.toFixed(4)}. ${returnAmount > 0 ? `$${returnAmount.toFixed(2)} returned to your balance.` : 'Position liquidated.'}`,
    })

  } catch (error) {
    console.error('Error closing position:', error)
    return NextResponse.json(
      { error: 'Failed to close position' },
      { status: 500 }
    )
  }
}
