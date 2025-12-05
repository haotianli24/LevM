/**
 * Hybrid Position Store
 * 
 * Combines file-based storage with on-chain verification for reliability
 */

import { LeveragedPosition } from './liquidation-engine'
import { getSolanaPositionStore } from './solana-position-store'
import fs from 'fs'
import path from 'path'

const POSITIONS_FILE = path.join(process.cwd(), '.positions-store.json')

interface PositionStoreData {
  positions: Record<string, LeveragedPosition>
  userPositions: Record<string, string[]>
  metadata: {
    lastUpdated: string
    version: string
  }
}

class HybridPositionStore {
  private positions: Map<string, LeveragedPosition> = new Map()
  private userPositions: Map<string, Set<string>> = new Map()
  private solanaStore = getSolanaPositionStore()
  private pendingSync: Set<string> = new Set()

  constructor() {
    this.loadFromFile()
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(POSITIONS_FILE)) {
        const data = fs.readFileSync(POSITIONS_FILE, 'utf-8')
        const parsed: PositionStoreData = JSON.parse(data)
        
        // Restore positions map
        this.positions = new Map(Object.entries(parsed.positions || {}))
        
        // Restore userPositions map with Sets
        this.userPositions = new Map(
          Object.entries(parsed.userPositions || {}).map(([user, ids]) => [user, new Set(ids)])
        )
        
        console.log(`[HybridStore] Loaded ${this.positions.size} positions from file`)
      } else {
        console.log('[HybridStore] No existing positions file, starting fresh')
      }
    } catch (error) {
      console.error('[HybridStore] Error loading positions from file:', error)
      // Initialize empty stores on error
      this.positions = new Map()
      this.userPositions = new Map()
    }
  }

  private saveToFile(): void {
    try {
      const data: PositionStoreData = {
        positions: Object.fromEntries(this.positions),
        userPositions: Object.fromEntries(
          Array.from(this.userPositions.entries()).map(([user, ids]) => [user, Array.from(ids)])
        ),
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0.0'
        }
      }
      
      fs.writeFileSync(POSITIONS_FILE, JSON.stringify(data, null, 2), 'utf-8')
      console.log(`[HybridStore] Saved ${this.positions.size} positions to file`)
    } catch (error) {
      console.error('[HybridStore] Error saving positions to file:', error)
    }
  }

  /**
   * Add a new position to both local storage and on-chain
   */
  async addPosition(position: LeveragedPosition): Promise<void> {
    console.log(`🔷 [HybridStore] Starting addPosition for ${position.id}`)
    console.log(`🔷 [HybridStore] User: ${position.userAddress}`)
    
    // Store locally first for immediate availability
    console.log(`🔷 [HybridStore] Storing position locally...`)
    this.positions.set(position.id, position)
    
    if (!this.userPositions.has(position.userAddress)) {
      this.userPositions.set(position.userAddress, new Set())
    }
    this.userPositions.get(position.userAddress)!.add(position.id)
    console.log(`✅ [HybridStore] Position stored locally`)
    
    // Save to file
    console.log(`🔷 [HybridStore] Saving to file...`)
    this.saveToFile()
    console.log(`✅ [HybridStore] Saved to file`)
    
    // Store on-chain asynchronously
    console.log(`🔷 [HybridStore] Starting on-chain storage...`)
    console.log(`🔷 [HybridStore] About to call solanaStore.storePosition...`)
    try {
      await this.solanaStore.storePosition(position)
      console.log(`✅ [HybridStore] Position ${position.id} stored on-chain`)
    } catch (error) {
      console.error('❌ [HybridStore] Failed to store position on-chain:', error)
      console.error('❌ [HybridStore] Error stack:', error instanceof Error ? error.stack : 'No stack')
      // Mark for retry
      this.pendingSync.add(position.id)
      console.log(`⚠️ [HybridStore] Position ${position.id} marked for retry`)
    }
    console.log(`🔷 [HybridStore] addPosition completed for ${position.id}`)
  }

  /**
   * Get a specific position
   */
  getPosition(positionId: string): LeveragedPosition | undefined {
    return this.positions.get(positionId)
  }

  /**
   * Get all positions for a user
   * Attempts to fetch from both local and on-chain sources
   */
  async getUserPositions(userAddress: string): Promise<LeveragedPosition[]> {
    console.log(`[HybridStore] Fetching positions for user ${userAddress}`)
    
    // Get from local storage first
    const positionIds = this.userPositions.get(userAddress)
    const localPositions = positionIds 
      ? Array.from(positionIds)
          .map(id => this.positions.get(id))
          .filter((p): p is LeveragedPosition => p !== undefined && p.status === 'active')
      : []
    
    console.log(`[HybridStore] Found ${localPositions.length} local positions`)
    
    // Also try to fetch from on-chain (async, don't block)
    try {
      const onChainPositions = await this.solanaStore.getUserPositions(userAddress)
      console.log(`[HybridStore] Found ${onChainPositions.length} on-chain positions`)
      
      // Merge with local positions (local takes precedence)
      const localIds = new Set(localPositions.map(p => p.id))
      const additionalPositions = onChainPositions
        .filter(p => !localIds.has(p.positionId))
        .map(p => this.convertOnChainToPosition(p))
      
      if (additionalPositions.length > 0) {
        console.log(`[HybridStore] Adding ${additionalPositions.length} positions from on-chain`)
        // Add them to local store
        additionalPositions.forEach(pos => {
          this.positions.set(pos.id, pos)
          if (!this.userPositions.has(userAddress)) {
            this.userPositions.set(userAddress, new Set())
          }
          this.userPositions.get(userAddress)!.add(pos.id)
        })
        this.saveToFile()
        
        return [...localPositions, ...additionalPositions]
      }
    } catch (error) {
      console.error('[HybridStore] Error fetching on-chain positions:', error)
    }
    
    return localPositions
  }

  /**
   * Get all active positions (for liquidation monitoring)
   */
  getAllActivePositions(): LeveragedPosition[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'active')
  }

  /**
   * Update a position
   */
  async updatePosition(positionId: string, updates: Partial<LeveragedPosition>): Promise<boolean> {
    const position = this.positions.get(positionId)
    if (!position) {
      console.error(`[HybridStore] Position ${positionId} not found`)
      return false
    }
    
    const updatedPosition = { ...position, ...updates }
    this.positions.set(positionId, updatedPosition)
    this.saveToFile()
    
    // Update on-chain asynchronously
    try {
      await this.solanaStore.updatePosition(positionId, position.userAddress, {
        ...updates,
        userAddress: position.userAddress,
        positionId,
      } as any)
    } catch (error) {
      console.error('[HybridStore] Failed to update position on-chain:', error)
    }
    
    return true
  }

  /**
   * Close a position
   */
  async closePosition(positionId: string): Promise<boolean> {
    const result = await this.updatePosition(positionId, { status: 'closed' })
    
    if (result) {
      const position = this.positions.get(positionId)
      if (position) {
        await this.solanaStore.closePosition(positionId, position.userAddress)
      }
    }
    
    return result
  }

  /**
   * Liquidate a position
   */
  async liquidatePosition(positionId: string): Promise<boolean> {
    const result = await this.updatePosition(positionId, { status: 'liquidated' })
    
    if (result) {
      const position = this.positions.get(positionId)
      if (position) {
        await this.solanaStore.liquidatePosition(positionId, position.userAddress)
      }
    }
    
    return result
  }

  /**
   * Delete a position (use with caution)
   */
  deletePosition(positionId: string): boolean {
    const position = this.positions.get(positionId)
    if (!position) return false
    
    this.positions.delete(positionId)
    this.userPositions.get(position.userAddress)?.delete(positionId)
    this.saveToFile()
    return true
  }

  /**
   * Convert on-chain position to LeveragedPosition
   */
  private convertOnChainToPosition(onChainPos: any): LeveragedPosition {
    return {
      id: onChainPos.positionId,
      marketId: onChainPos.marketId,
      marketName: onChainPos.marketName,
      side: onChainPos.side,
      entryPrice: onChainPos.entryPrice,
      currentPrice: onChainPos.currentPrice,
      collateral: onChainPos.collateral,
      leverage: onChainPos.leverage,
      liquidationPrice: onChainPos.liquidationPrice,
      maintenanceMargin: onChainPos.maintenanceMargin,
      userAddress: onChainPos.userAddress,
      createdAt: onChainPos.createdAt,
      status: onChainPos.status,
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalPositions: this.positions.size,
      activePositions: this.getAllActivePositions().length,
      totalUsers: this.userPositions.size,
      pendingSync: this.pendingSync.size,
    }
  }
}

// Singleton instance
export const hybridPositionStore = new HybridPositionStore()

