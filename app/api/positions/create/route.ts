import { NextRequest, NextResponse } from 'next/server'
import { positionStore } from '@/lib/position-store'
import { LiquidationEngine, LeveragedPosition } from '@/lib/liquidation-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      marketId,
      marketName,
      side,
      entryPrice,
      collateral,
      leverage,
      maintenanceMargin,
      userAddress,
    } = body

    if (!marketId || !marketName || !side || !entryPrice || !collateral || !leverage || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (side !== 'long' && side !== 'short') {
      return NextResponse.json(
        { error: 'Side must be long or short' },
        { status: 400 }
      )
    }

    if (leverage < 1 || leverage > 20) {
      return NextResponse.json(
        { error: 'Leverage must be between 1 and 20' },
        { status: 400 }
      )
    }

    if (entryPrice <= 0 || collateral <= 0) {
      return NextResponse.json(
        { error: 'Entry price and collateral must be positive' },
        { status: 400 }
      )
    }

    const validatedMaintenanceMargin = maintenanceMargin === null 
      ? null 
      : LiquidationEngine.validateMaintenanceMargin(parseFloat(maintenanceMargin))

    const liquidationPrice = LiquidationEngine.calculateLiquidationPrice(
      entryPrice,
      side,
      leverage,
      validatedMaintenanceMargin
    )

    const position: LeveragedPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      marketId,
      marketName,
      side,
      entryPrice,
      currentPrice: entryPrice,
      collateral,
      leverage,
      liquidationPrice,
      maintenanceMargin: validatedMaintenanceMargin,
      userAddress,
      createdAt: new Date().toISOString(),
      status: 'active',
    }

    positionStore.addPosition(position)

    return NextResponse.json({
      success: true,
      position,
      message: `Position created with ${leverage}x leverage. Liquidation price: $${liquidationPrice.toFixed(4)}`,
    })

  } catch (error) {
    console.error('Error creating position:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create position' },
      { status: 500 }
    )
  }
}
