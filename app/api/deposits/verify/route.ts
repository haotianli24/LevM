import { NextRequest, NextResponse } from 'next/server'
import { solanaDepositService } from '@/lib/solana-deposit'
import { depositStore } from '@/lib/deposit-store'

// Central deposit address - SOL deposits are sent to this address
const DEPOSIT_ADDRESS_STRING = "CXi538rhqgJx56Edrqg1HMmZK4xfKgTDz7r2df4CnJQL"

// Generate a simulated Polygon address for a user
function generateSimulatedPolygonAddress(solanaAddress: string): string {
  // Create a deterministic "Polygon" address based on Solana address
  // This is just for UI purposes - not a real Polygon address
  const hash = solanaAddress.slice(0, 8)
  return `0x${hash}${'0'.repeat(32)}` // Simulated Polygon address format
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { signature, userAddress } = body

    if (!signature || !userAddress) {
      return NextResponse.json(
        { error: 'Signature and user address required' },
        { status: 400 }
      )
    }

    // Verify transaction is confirmed on blockchain
    const isValid = await solanaDepositService.verifyDeposit(signature)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Deposit transaction not confirmed on blockchain' },
        { status: 400 }
      )
    }

    // Get deposit details and verify it's from userAddress to depositAddress
    const details = await solanaDepositService.getDepositDetails(
      signature,
      DEPOSIT_ADDRESS_STRING,
      userAddress
    )

    // Verify the transaction is from the correct user
    if (details.fromAddress !== userAddress) {
      return NextResponse.json(
        { error: 'Transaction does not match the provided user address' },
        { status: 400 }
      )
    }

    // Verify the transaction is to the deposit address
    if (details.toAddress !== DEPOSIT_ADDRESS_STRING) {
      return NextResponse.json(
        { error: 'Transaction is not to the deposit address' },
        { status: 400 }
      )
    }

    console.log(`Deposit verified: ${signature} - ${details.amount} SOL from ${userAddress} to ${DEPOSIT_ADDRESS_STRING}`)

    // Simulate Polygon bridge for the user
    const simulatedPolygonAddress = generateSimulatedPolygonAddress(userAddress)
    const simulatedBridgeTxHash = `0xsimulated_${signature.slice(0, 16)}`
    
    // Store simulated bridge info (this would be in a database in production)
    depositStore.recordSimulatedBridge(userAddress, {
      polygonAddress: simulatedPolygonAddress,
      bridgeTxHash: simulatedBridgeTxHash,
      amount: details.amount,
      timestamp: details.timestamp
    })

    console.log(`Simulated Polygon bridge created for ${userAddress}:`, {
      polygonAddress: simulatedPolygonAddress,
      bridgeTxHash: simulatedBridgeTxHash
    })

    return NextResponse.json({
      success: true,
      verified: true,
      amount: details.amount,
      timestamp: details.timestamp,
      signature,
      message: `Deposit of ${details.amount.toFixed(4)} SOL confirmed on blockchain`,
      simulatedBridge: {
        polygonAddress: simulatedPolygonAddress,
        bridgeTxHash: simulatedBridgeTxHash,
        note: 'Polygon bridge simulated - leveraged positions are paper trading only'
      }
    })

  } catch (error) {
    console.error('Error verifying deposit:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify deposit' },
      { status: 500 }
    )
  }
}