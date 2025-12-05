import { NextRequest, NextResponse } from 'next/server'
import { hybridPositionStore } from '@/lib/hybrid-position-store'
import { LiquidationEngine, LiquidationResult } from '@/lib/liquidation-engine'

export async function POST(request: NextRequest) {
  try {
    const allPositions = hybridPositionStore.getAllActivePositions()
    const liquidations: LiquidationResult[] = []
    const errors: string[] = []

    for (const position of allPositions) {
      try {
        const shouldLiquidate = LiquidationEngine.shouldLiquidate(
          position,
          position.currentPrice
        )

        if (shouldLiquidate) {
          const liquidationResult = LiquidationEngine.calculateLiquidationOutcome(
            position,
            position.currentPrice
          )

          await hybridPositionStore.liquidatePosition(position.id)
          liquidations.push(liquidationResult)

          console.log(`Liquidated position ${position.id} at $${position.currentPrice.toFixed(4)}`)
        }
      } catch (error) {
        const errorMsg = `Failed to liquidate ${position.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    return NextResponse.json({
      success: true,
      checkedPositions: allPositions.length,
      liquidatedCount: liquidations.length,
      liquidations,
      errors,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Error checking liquidations:', error)
    return NextResponse.json(
      { error: 'Failed to check liquidations' },
      { status: 500 }
    )
  }
}
