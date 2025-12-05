import { NextRequest, NextResponse } from 'next/server'
import { hybridPositionStore } from '@/lib/hybrid-position-store'
import { LiquidationEngine, LiquidationResult } from '@/lib/liquidation-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { positionId, marketPrice } = body

    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID required' },
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

    if (position.status !== 'active') {
      return NextResponse.json(
        { error: 'Position is not active' },
        { status: 400 }
      )
    }

    const currentPrice = marketPrice ?? position.currentPrice

    const shouldLiquidate = LiquidationEngine.shouldLiquidate(position, currentPrice)

    if (!shouldLiquidate) {
      return NextResponse.json(
        { 
          error: 'Position does not meet liquidation criteria',
          currentPrice,
          liquidationPrice: position.liquidationPrice,
        },
        { status: 400 }
      )
    }

    const liquidationResult = LiquidationEngine.calculateLiquidationOutcome(
      position,
      currentPrice
    )

    await hybridPositionStore.liquidatePosition(positionId)

    return NextResponse.json({
      success: true,
      liquidation: liquidationResult,
      message: `Position liquidated at $${currentPrice.toFixed(4)}. Remaining collateral: $${liquidationResult.remainingCollateral.toFixed(2)}`,
    })

  } catch (error) {
    console.error('Error executing liquidation:', error)
    return NextResponse.json(
      { error: 'Failed to execute liquidation' },
      { status: 500 }
    )
  }
}
