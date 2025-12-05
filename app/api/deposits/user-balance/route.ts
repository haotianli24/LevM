import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { depositStore } from '@/lib/deposit-store'

// Central deposit address
const DEPOSIT_ADDRESS = 'CXi538rhqgJx56Edrqg1HMmZK4xfKgTDz7r2df4CnJQL'

// SOL to USDC conversion rate (you might want to fetch this from an oracle in production)
const SOL_TO_USDC_RATE = 150 // Approximate rate, should be fetched from price oracle

// RPC endpoint - uses devnet by default
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { error: 'Address required' },
        { status: 400 }
      )
    }

    // Fetch user's REAL deposits from Solana blockchain
    console.log('Fetching deposits from blockchain for user:', address)

    const connection = new Connection(RPC_URL, 'confirmed')
    const depositPubkey = new PublicKey(DEPOSIT_ADDRESS)
    const userPubkey = new PublicKey(address)

    // Get all signatures for the deposit address
    const signatures = await connection.getSignaturesForAddress(depositPubkey, { limit: 1000 })
    
    console.log(`Found ${signatures.length} total transactions to deposit address`)

    const deposits = []
    let totalDepositsSOL = 0

    // Fetch transaction details for each signature
    for (const sigInfo of signatures) {
      try {
        const tx = await connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0
        })

        if (!tx || !tx.meta) continue

        // Get account keys - handle both versioned and legacy transactions
        const accountKeys = tx.transaction.message.getAccountKeys 
          ? tx.transaction.message.getAccountKeys().keySegments().flat()
          : (tx.transaction.message as any).accountKeys
        
        const accountKeyStrings = accountKeys.map((key: PublicKey) => key.toString())
        
        // Check if this transaction involves the user address
        const userIndex = accountKeyStrings.findIndex((key: string) => key === userPubkey.toString())
        const depositIndex = accountKeyStrings.findIndex((key: string) => key === depositPubkey.toString())

        if (userIndex === -1 || depositIndex === -1) continue

        // Calculate the amount deposited (increase in deposit address balance)
        const depositPreBalance = tx.meta.preBalances[depositIndex]
        const depositPostBalance = tx.meta.postBalances[depositIndex]
        const amount = (depositPostBalance - depositPreBalance) / LAMPORTS_PER_SOL

        // Only count if amount is positive (user sent to deposit address)
        if (amount > 0) {
          const deposit = {
            signature: sigInfo.signature,
            amount,
            timestamp: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : new Date().toISOString(),
            userAddress: address
          }
          deposits.push(deposit)
          totalDepositsSOL += amount
        }
      } catch (error) {
        console.error(`Error fetching transaction ${sigInfo.signature}:`, error)
        // Continue processing other transactions
      }
    }

    const totalDepositsUSDC = totalDepositsSOL * SOL_TO_USDC_RATE
    
    // Get used amount from deposit store
    const usedAmount = depositStore.getUsedAmount(address)
    const availableBalance = Math.max(0, totalDepositsUSDC - usedAmount)

    console.log('User deposit balance fetched from blockchain:', {
      address,
      depositCount: deposits.length,
      totalDepositsSOL,
      totalDepositsUSDC,
      usedAmount,
      availableBalance,
      deposits: deposits.map(d => ({ signature: d.signature, amount: d.amount }))
    })

    // Note: Positions are simulated/demo, but balance is REAL from deposits
    return NextResponse.json({
      success: true,
      address,
      totalDepositsSOL,
      totalDepositsUSDC,
      usedAmount,
      availableBalance,
      deposits,
      note: 'Balance is from real Solana deposits. Positions are simulated (no actual Polymarket orders).'
    })

  } catch (error) {
    console.error('Error getting user deposit balance:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get deposit balance' },
      { status: 500 }
    )
  }
}
