import { LeveragedPosition } from './liquidation-engine'
import fs from 'fs'
import path from 'path'

const POSITIONS_FILE = path.join(process.cwd(), '.positions-store.json')

interface PositionStoreData {
  positions: Record<string, LeveragedPosition>
  userPositions: Record<string, string[]>
}

class PositionStore {
  private positions: Map<string, LeveragedPosition> = new Map()
  private userPositions: Map<string, Set<string>> = new Map()

  constructor() {
    this.loadFromFile()
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(POSITIONS_FILE)) {
        const data = fs.readFileSync(POSITIONS_FILE, 'utf-8')
        const parsed: PositionStoreData = JSON.parse(data)
        
        // Restore positions map
        this.positions = new Map(Object.entries(parsed.positions))
        
        // Restore userPositions map with Sets
        this.userPositions = new Map(
          Object.entries(parsed.userPositions).map(([user, ids]) => [user, new Set(ids)])
        )
        
        console.log(`Loaded ${this.positions.size} positions from file`)
      }
    } catch (error) {
      console.error('Error loading positions from file:', error)
    }
  }

  private saveToFile(): void {
    try {
      const data: PositionStoreData = {
        positions: Object.fromEntries(this.positions),
        userPositions: Object.fromEntries(
          Array.from(this.userPositions.entries()).map(([user, ids]) => [user, Array.from(ids)])
        )
      }
      
      fs.writeFileSync(POSITIONS_FILE, JSON.stringify(data, null, 2), 'utf-8')
      console.log(`Saved ${this.positions.size} positions to file`)
    } catch (error) {
      console.error('Error saving positions to file:', error)
    }
  }

  addPosition(position: LeveragedPosition): void {
    this.positions.set(position.id, position)
    
    if (!this.userPositions.has(position.userAddress)) {
      this.userPositions.set(position.userAddress, new Set())
    }
    this.userPositions.get(position.userAddress)!.add(position.id)
    
    this.saveToFile()
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
    this.saveToFile()
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
    this.saveToFile()
    return true
  }
}

export const positionStore = new PositionStore()
