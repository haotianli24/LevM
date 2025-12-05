import { NextRequest, NextResponse } from 'next/server'

const WORMHOLE_API = 'https://api.wormholescan.io'

interface BridgeRequest {
  solAddress: string
  polygonAddress: string
  amount: number
  signature: string
}

export async function POST(request: NextRequest) {
  try {
    const body: BridgeRequest = await request.json()
    const { solAddress, polygonAddress, amount, signature } = body

    if (!solAddress || !polygonAddress || !amount || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: solAddress, polygonAddress, amount, signature' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    console.log('Initiating bridge:', {
      from: solAddress,
      to: polygonAddress,
      amount,
      timestampVerified: Date.now()
    })

    const bridgeTransaction = {
      id: `bridge_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: 'pending',
      sourceChain: 'solana',
      targetChain: 'polygon',
      sourceAddress: solAddress,
      targetAddress: polygonAddress,
      amount,
      estimatedTime: 900,
      fee: amount * 0.001,
      netAmount: amount * 0.999,
      createdAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      transaction: bridgeTransaction,
      message: 'Bridge transaction initiated. Please approve in your wallet.',
      nextSteps: [
        'Approve SOL transfer on Solana',
        'Wait for bridge confirmation (10-15 mins)',
        'USDC will arrive on Polygon address'
      ]
    })

  } catch (error) {
    console.error('Bridge error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate bridge transaction' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const txId = searchParams.get('txId')

    if (!txId) {
      return NextResponse.json(
        { error: 'Transaction ID required' },
        { status: 400 }
      )
    }

    const mockStatus = {
      id: txId,
      status: 'completed',
      sourceChain: 'solana',
      targetChain: 'polygon',
      confirmations: 15,
      estimatedCompletion: new Date(Date.now() + 300000).toISOString()
    }

    return NextResponse.json(mockStatus)

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check transaction status' },
      { status: 500 }
    )
  }
}
