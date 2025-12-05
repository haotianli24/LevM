import { NextRequest, NextResponse } from 'next/server'
import { positionStore } from '@/lib/position-store'
import { LiquidationEngine } from '@/lib/liquidation-engine'

export async function GET(request: NextRequest) {
  try {
    const allPositions = positionStore.getAllActivePositions()
    const atRiskPositions = []
    const healthyPositions = []

    for (const position of allPositions) {
      const shouldLiquidate = LiquidationEngine.shouldLiquidate(
        position,
        position.currentPrice
      )

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

      const positionData = {
        id: position.id,
        marketName: position.marketName,
        userAddress: position.userAddress,
        side: position.side,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        liquidationPrice: position.liquidationPrice,
        marginRatio: marginRatio * 100,
        health,
        shouldLiquidate,
      }

      if (shouldLiquidate || health === 'danger') {
        atRiskPositions.push(positionData)
      } else {
        healthyPositions.push(positionData)
      }
    }

    return NextResponse.json({
      totalPositions: allPositions.length,
      atRisk: atRiskPositions.length,
      healthy: healthyPositions.length,
      atRiskPositions,
      healthyPositions,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Error monitoring positions:', error)
    return NextResponse.json(
      { error: 'Failed to monitor positions' },
      { status: 500 }
    )
  }
}
