import { NextRequest, NextResponse } from 'next/server'
import { hybridPositionStore } from '@/lib/hybrid-position-store'
import { depositStore } from '@/lib/deposit-store'
import { LiquidationEngine, LeveragedPosition } from '@/lib/liquidation-engine'
import { Connection, PublicKey } from '@solana/web3.js'

// SOL to USDC conversion rate (should be fetched from an oracle in production)
const SOL_TO_USDC_RATE = 150

// RPC endpoint
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// Central deposit address
const DEPOSIT_ADDRESS = 'CXi538rhqgJx56Edrqg1HMmZK4xfKgTDz7r2df4CnJQL'

export async function POST(request: NextRequest) {
  console.log('🚀 [CREATE POSITION] Request received')
  try {
    const body = await request.json()
    console.log('📦 [CREATE POSITION] Request body:', body)
    
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

    console.log('✅ [CREATE POSITION] Fields extracted:', { marketId, marketName, side, entryPrice, collateral, leverage, userAddress })

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

    console.log('✅ [CREATE POSITION] Validation passed')

    // Fetch user's REAL deposits from Solana blockchain
    console.log('🔍 [CREATE POSITION] Starting deposit fetch from Solana...')
    let totalDepositsUSDC = 0
    try {
      console.log('🔗 [CREATE POSITION] Connecting to Solana RPC:', RPC_URL)
      const connection = new Connection(RPC_URL, 'confirmed')
      const depositPubkey = new PublicKey(DEPOSIT_ADDRESS)
      const userPubkey = new PublicKey(userAddress)

      console.log('📡 [CREATE POSITION] Fetching signatures for deposit address...')
      const signatures = await connection.getSignaturesForAddress(depositPubkey, { limit: 1000 })
      console.log(`📝 [CREATE POSITION] Found ${signatures.length} signatures`)
      let totalDepositsSOL = 0

      console.log('🔄 [CREATE POSITION] Processing transactions...')
      for (const sigInfo of signatures) {
        try {
          const tx = await connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0
          })

          if (!tx || !tx.meta) continue

          const accountKeys = tx.transaction.message.getAccountKeys 
            ? tx.transaction.message.getAccountKeys().keySegments().flat()
            : (tx.transaction.message as any).accountKeys
          
          const accountKeyStrings = accountKeys.map((key: PublicKey) => key.toString())
          const userIndex = accountKeyStrings.findIndex((key: string) => key === userPubkey.toString())
          const depositIndex = accountKeyStrings.findIndex((key: string) => key === depositPubkey.toString())

          if (userIndex === -1 || depositIndex === -1) continue

          const depositPreBalance = tx.meta.preBalances[depositIndex]
          const depositPostBalance = tx.meta.postBalances[depositIndex]
          const amount = (depositPostBalance - depositPreBalance) / 1000000000 // LAMPORTS_PER_SOL

          if (amount > 0) {
            totalDepositsSOL += amount
          }
        } catch (error) {
          console.error(`Error fetching transaction ${sigInfo.signature}:`, error)
        }
      }

      console.log(`✅ [CREATE POSITION] Transaction processing complete. Total SOL: ${totalDepositsSOL}`)
      totalDepositsUSDC = totalDepositsSOL * SOL_TO_USDC_RATE
      console.log(`💰 [CREATE POSITION] Total deposits USDC: ${totalDepositsUSDC}`)
    } catch (error) {
      console.error('❌ [CREATE POSITION] Error fetching deposits:', error)
      return NextResponse.json(
        { error: 'Failed to verify deposit balance' },
        { status: 500 }
      )
    }

    // Check available balance (total REAL deposits - used amount)
    console.log('💳 [CREATE POSITION] Checking available balance...')
    const usedAmount = depositStore.getUsedAmount(userAddress)
    const availableBalance = totalDepositsUSDC - usedAmount

    console.log('💳 [CREATE POSITION] Balance check:', {
      userAddress,
      totalDepositsUSDC,
      usedAmount,
      availableBalance,
      requiredCollateral: collateral
    })

    // Check if user has sufficient balance
    if (availableBalance < collateral) {
      console.log('❌ [CREATE POSITION] Insufficient balance')
      return NextResponse.json(
        { 
          error: 'Insufficient balance',
          details: {
            required: collateral,
            available: availableBalance,
            totalDeposits: totalDepositsUSDC,
            used: usedAmount
          }
        },
        { status: 400 }
      )
    }

    // Deduct collateral from available balance
    console.log('💸 [CREATE POSITION] Deducting collateral from balance...')
    depositStore.deductBalance(userAddress, collateral)

    console.log('🧮 [CREATE POSITION] Calculating liquidation price...')
    const validatedMaintenanceMargin = maintenanceMargin === null 
      ? null 
      : LiquidationEngine.validateMaintenanceMargin(parseFloat(maintenanceMargin))

    const liquidationPrice = LiquidationEngine.calculateLiquidationPrice(
      entryPrice,
      side,
      leverage,
      validatedMaintenanceMargin
    )
    console.log(`📊 [CREATE POSITION] Liquidation price: ${liquidationPrice}`)

    console.log('📝 [CREATE POSITION] Creating position object...')
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

    // Store position using hybrid store (local + on-chain)
    console.log('💾 [CREATE POSITION] Storing position (hybrid - local + on-chain)...')
    console.log('🔄 [CREATE POSITION] About to call hybridPositionStore.addPosition...')
    await hybridPositionStore.addPosition(position)
    console.log('✅ [CREATE POSITION] Position stored successfully')
    
    console.log('🎉 [API] Position created and stored:', {
      positionId: position.id,
      userAddress: position.userAddress,
      marketName: position.marketName,
      side: position.side,
      leverage: position.leverage
    })

    const newAvailableBalance = availableBalance - collateral

    console.log('✅ [CREATE POSITION] Preparing success response...')
    const response = {
      success: true,
      position,
      message: `Leveraged position created with ${leverage}x leverage. Liquidation price: $${liquidationPrice.toFixed(4)}`,
      isSimulated: true,
      note: 'Position is stored on-chain and locally. Balance is from real deposits.',
      balance: {
        previousAvailable: availableBalance,
        newAvailable: newAvailableBalance,
        used: collateral
      }
    }
    
    console.log('📤 [CREATE POSITION] Returning success response')
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ [CREATE POSITION] Error creating position:', error)
    console.error('❌ [CREATE POSITION] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create position' },
      { status: 500 }
    )
  }
}
