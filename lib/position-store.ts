import { LeveragedPosition } from './liquidation-engine'

class PositionStore {
  private positions: Map<string, LeveragedPosition> = new Map()
  private userPositions: Map<string, Set<string>> = new Map()

  addPosition(position: LeveragedPosition): void {
    this.positions.set(position.id, position)
    
    if (!this.userPositions.has(position.userAddress)) {
      this.userPositions.set(position.userAddress, new Set())
    }
    this.userPositions.get(position.userAddress)!.add(position.id)
  }

  getPosition(positionId: string): LeveragedPosition | undefined {
    return this.positions.get(positionId)
  }

  getUserPositions(userAddress: string): LeveragedPosition[] {
    const positionIds = this.userPositions.get(userAddress)
    if (!positionIds) return []
    
    return Array.from(positionIds)
      .map(id => this.positions.get(id))
      .filter((p): p is LeveragedPosition => p !== undefined && p.status === 'active')
  }

  getAllActivePositions(): LeveragedPosition[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'active')
  }

  updatePosition(positionId: string, updates: Partial<LeveragedPosition>): boolean {
    const position = this.positions.get(positionId)
    if (!position) return false
    
    this.positions.set(positionId, { ...position, ...updates })
    return true
  }

  closePosition(positionId: string): boolean {
    return this.updatePosition(positionId, { status: 'closed' })
  }

  liquidatePosition(positionId: string): boolean {
    return this.updatePosition(positionId, { status: 'liquidated' })
  }

  deletePosition(positionId: string): boolean {
    const position = this.positions.get(positionId)
    if (!position) return false
    
    this.positions.delete(positionId)
    this.userPositions.get(position.userAddress)?.delete(positionId)
    return true
  }
}

export const positionStore = new PositionStore()
