/**
 * UserDeposit represents a verified deposit transaction.
 * The signature (transaction hash) serves as the contract/record that associates
 * a specific transaction with a user address.
 */
export interface UserDeposit {
  userAddress: string
  signature: string // Transaction hash - this is the contract/record that associates tx with user
  amount: number // Amount in SOL
  timestamp: string
  verified: boolean
}

/**
 * DepositUsage tracks how much of a user's deposits have been used for positions
 */
export interface DepositUsage {
  userAddress: string
  usedAmount: number // Amount in USDC that has been used for positions
  lastUpdated: string
}

/**
 * SimulatedBridge represents a simulated Polygon bridge for a user
 * This is NOT a real bridge - it's for demo purposes only
 */
export interface SimulatedBridge {
  polygonAddress: string // Simulated Polygon wallet address
  bridgeTxHash: string // Simulated bridge transaction hash
  amount: number // Amount bridged (in SOL)
  timestamp: string
}

import fs from 'fs'
import path from 'path'

const DEPOSITS_FILE = path.join(process.cwd(), '.deposits-store.json')

interface DepositStoreData {
  deposits: Record<string, UserDeposit>
  userDeposits: Record<string, string[]>
  depositUsage: Record<string, DepositUsage>
  simulatedBridges: Record<string, SimulatedBridge>
}

/**
 * DepositStore maintains a record of all user deposits.
 * Each deposit is stored with its transaction hash (signature) as the key,
 * creating a contract that associates the tx hash with the user.
 */
class DepositStore {
  private deposits: Map<string, UserDeposit> = new Map() // Key: signature (tx hash)
  private userDeposits: Map<string, Set<string>> = new Map() // Key: userAddress, Value: Set of transaction signatures
  private depositUsage: Map<string, DepositUsage> = new Map() // Key: userAddress, Value: DepositUsage
  private simulatedBridges: Map<string, SimulatedBridge> = new Map() // Key: userAddress, Value: SimulatedBridge

  constructor() {
    this.loadFromFile()
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(DEPOSITS_FILE)) {
        const data = fs.readFileSync(DEPOSITS_FILE, 'utf-8')
        const parsed: DepositStoreData = JSON.parse(data)
        
        // Restore deposits map
        this.deposits = new Map(Object.entries(parsed.deposits || {}))
        
        // Restore userDeposits map with Sets
        this.userDeposits = new Map(
          Object.entries(parsed.userDeposits || {}).map(([user, sigs]) => [user, new Set(sigs)])
        )
        
        // Restore depositUsage map
        this.depositUsage = new Map(Object.entries(parsed.depositUsage || {}))
        
        // Restore simulatedBridges map
        this.simulatedBridges = new Map(Object.entries(parsed.simulatedBridges || {}))
        
        console.log(`Loaded ${this.deposits.size} deposits from file`)
      }
    } catch (error) {
      console.error('Error loading deposits from file:', error)
    }
  }

  private saveToFile(): void {
    try {
      const data: DepositStoreData = {
        deposits: Object.fromEntries(this.deposits),
        userDeposits: Object.fromEntries(
          Array.from(this.userDeposits.entries()).map(([user, sigs]) => [user, Array.from(sigs)])
        ),
        depositUsage: Object.fromEntries(this.depositUsage),
        simulatedBridges: Object.fromEntries(this.simulatedBridges)
      }
      
      fs.writeFileSync(DEPOSITS_FILE, JSON.stringify(data, null, 2), 'utf-8')
      console.log(`Saved ${this.deposits.size} deposits to file`)
    } catch (error) {
      console.error('Error saving deposits to file:', error)
    }
  }

  /**
   * Adds a verified deposit to the store.
   * This creates the contract/record associating the transaction hash with the user.
   */
  addDeposit(deposit: UserDeposit): void {
    this.deposits.set(deposit.signature, deposit)
    
    if (!this.userDeposits.has(deposit.userAddress)) {
      this.userDeposits.set(deposit.userAddress, new Set())
    }
    this.userDeposits.get(deposit.userAddress)!.add(deposit.signature)
    
    this.saveToFile()
  }

  getDeposit(signature: string): UserDeposit | undefined {
    return this.deposits.get(signature)
  }

  getUserDeposits(userAddress: string): UserDeposit[] {
    const signatures = this.userDeposits.get(userAddress)
    if (!signatures) return []
    
    return Array.from(signatures)
      .map(sig => this.deposits.get(sig))
      .filter((d): d is UserDeposit => d !== undefined && d.verified)
  }

  getUserTotalDeposits(userAddress: string): number {
    const deposits = this.getUserDeposits(userAddress)
    return deposits.reduce((sum, deposit) => sum + deposit.amount, 0)
  }

  /**
   * Gets the amount of deposits used for positions (in USDC)
   */
  getUsedAmount(userAddress: string): number {
    const usage = this.depositUsage.get(userAddress)
    return usage?.usedAmount || 0
  }

  /**
   * Gets the available balance for a user (in USDC)
   * Total deposits (converted to USDC) - used amount
   */
  getAvailableBalance(userAddress: string, solToUsdcRate: number = 150): number {
    const totalDepositsSOL = this.getUserTotalDeposits(userAddress)
    const totalDepositsUSDC = totalDepositsSOL * solToUsdcRate
    const usedAmount = this.getUsedAmount(userAddress)
    return Math.max(0, totalDepositsUSDC - usedAmount)
  }

  /**
   * Deducts an amount from the user's available balance
   * Returns true if successful, false if insufficient balance
   */
  deductBalance(userAddress: string, amountUSDC: number): boolean {
    const usage = this.depositUsage.get(userAddress) || {
      userAddress,
      usedAmount: 0,
      lastUpdated: new Date().toISOString()
    }

    const newUsedAmount = usage.usedAmount + amountUSDC
    
    this.depositUsage.set(userAddress, {
      ...usage,
      usedAmount: newUsedAmount,
      lastUpdated: new Date().toISOString()
    })

    this.saveToFile()
    return true
  }

  /**
   * Returns funds to the user's available balance (when closing a position)
   */
  returnBalance(userAddress: string, amountUSDC: number): void {
    const usage = this.depositUsage.get(userAddress)
    if (!usage) return

    const newUsedAmount = Math.max(0, usage.usedAmount - amountUSDC)
    
    this.depositUsage.set(userAddress, {
      ...usage,
      usedAmount: newUsedAmount,
      lastUpdated: new Date().toISOString()
    })
    
    this.saveToFile()
  }

  hasDeposit(signature: string): boolean {
    return this.deposits.has(signature)
  }

  /**
   * Records a simulated Polygon bridge for a user
   * This is NOT a real bridge - it's for demo/simulation purposes only
   */
  recordSimulatedBridge(userAddress: string, bridge: SimulatedBridge): void {
    this.simulatedBridges.set(userAddress, bridge)
    console.log(`Simulated bridge recorded for ${userAddress}:`, bridge)
    this.saveToFile()
  }

  /**
   * Gets the simulated Polygon bridge info for a user
   */
  getSimulatedBridge(userAddress: string): SimulatedBridge | undefined {
    return this.simulatedBridges.get(userAddress)
  }

  /**
   * Checks if a user has a simulated bridge
   */
  hasSimulatedBridge(userAddress: string): boolean {
    return this.simulatedBridges.has(userAddress)
  }
}

export const depositStore = new DepositStore()
