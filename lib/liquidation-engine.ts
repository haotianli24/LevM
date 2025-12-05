export interface LeveragedPosition {
  id: string
  marketId: string
  marketName: string
  side: 'long' | 'short'
  entryPrice: number
  currentPrice: number
  collateral: number
  leverage: number
  liquidationPrice: number
  maintenanceMargin: number | null
  userAddress: string
  createdAt: string
  status: 'active' | 'liquidated' | 'closed'
}

export interface LiquidationResult {
  positionId: string
  liquidated: boolean
  remainingCollateral: number
  liquidationPrice: number
  marketPrice: number
  pnl: number
  timestamp: string
}

export class LiquidationEngine {
  private static readonly DEFAULT_MAINTENANCE_MARGIN = 0.06
  private static readonly MIN_MAINTENANCE_MARGIN = 0.05
  private static readonly MAX_MAINTENANCE_MARGIN = 0.075

  static calculateLiquidationPrice(
    entryPrice: number,
    side: 'long' | 'short',
    leverage: number,
    maintenanceMargin: number | null
  ): number {
    const initialMargin = 1 / leverage
    const effectiveMaintenanceMargin = maintenanceMargin ?? 0

    if (side === 'long') {
      const priceMove = initialMargin - effectiveMaintenanceMargin
      return entryPrice * (1 - priceMove)
    } else {
      const priceMove = initialMargin - effectiveMaintenanceMargin
      return entryPrice * (1 + priceMove)
    }
  }

  static calculateMarginRatio(
    entryPrice: number,
    currentPrice: number,
    side: 'long' | 'short',
    collateral: number,
    leverage: number
  ): number {
    const positionSize = collateral * leverage
    let pnl: number

    if (side === 'long') {
      pnl = ((currentPrice - entryPrice) / entryPrice) * positionSize
    } else {
      pnl = ((entryPrice - currentPrice) / entryPrice) * positionSize
    }

    const remainingCollateral = collateral + pnl
    const marginRatio = remainingCollateral / positionSize

    return marginRatio
  }

  static shouldLiquidate(
    position: LeveragedPosition,
    currentPrice: number
  ): boolean {
    if (position.side === 'long') {
      return currentPrice <= position.liquidationPrice
    } else {
      return currentPrice >= position.liquidationPrice
    }
  }

  static calculateLiquidationOutcome(
    position: LeveragedPosition,
    marketPrice: number
  ): LiquidationResult {
    const positionSize = position.collateral * position.leverage
    let pnl: number

    if (position.side === 'long') {
      pnl = ((marketPrice - position.entryPrice) / position.entryPrice) * positionSize
    } else {
      pnl = ((position.entryPrice - marketPrice) / position.entryPrice) * positionSize
    }

    const remainingCollateral = Math.max(0, position.collateral + pnl)

    return {
      positionId: position.id,
      liquidated: true,
      remainingCollateral,
      liquidationPrice: position.liquidationPrice,
      marketPrice,
      pnl,
      timestamp: new Date().toISOString(),
    }
  }

  static validateMaintenanceMargin(margin: number | null): number | null {
    if (margin === null) return null
    
    if (margin < this.MIN_MAINTENANCE_MARGIN || margin > this.MAX_MAINTENANCE_MARGIN) {
      throw new Error(
        `Maintenance margin must be between ${this.MIN_MAINTENANCE_MARGIN * 100}% and ${this.MAX_MAINTENANCE_MARGIN * 100}%`
      )
    }
    
    return margin
  }

  static getMarginHealth(
    marginRatio: number,
    maintenanceMargin: number | null
  ): 'healthy' | 'warning' | 'danger' {
    if (maintenanceMargin === null) {
      if (marginRatio > 0.03) return 'healthy'
      if (marginRatio > 0.01) return 'warning'
      return 'danger'
    }

    const warningThreshold = maintenanceMargin * 1.5
    
    if (marginRatio > warningThreshold) return 'healthy'
    if (marginRatio > maintenanceMargin) return 'warning'
    return 'danger'
  }
}
