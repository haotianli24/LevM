import { NextRequest, NextResponse } from 'next/server'
import { createBridgeInstance } from '@/lib/wormhole-bridge'

interface BridgeRequest {
  solAddress: string
  polygonAddress: string
  amount: number
  transactionSignature?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: BridgeRequest = await request.json()
    const { solAddress, polygonAddress, amount, transactionSignature } = body

    if (!solAddress || !polygonAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: solAddress, polygonAddress, amount' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    const bridge = createBridgeInstance('Mainnet')

    console.log('Initiating Wormhole bridge:', {
      from: solAddress,
      to: polygonAddress,
      amount,
      timestamp: Date.now()
    })

    const fees = await bridge.estimateFees('Solana', 'Polygon')
    const totalFees = parseFloat(fees.relayerFee) + parseFloat(fees.estimatedGas)

    if (!transactionSignature) {
      return NextResponse.json({
        success: true,
        requiresSignature: true,
        transaction: {
          id: `bridge_prepare_${Date.now()}`,
          sourceChain: 'Solana',
          targetChain: 'Polygon',
          sourceAddress: solAddress,
          targetAddress: polygonAddress,
          amount,
          estimatedTime: 900,
          relayerFee: fees.relayerFee,
          gasFee: fees.estimatedGas,
          totalFees,
          netAmount: amount - totalFees,
          status: 'awaiting_signature'
        },
        message: 'Transaction prepared. Please sign in your wallet.',
      })
    }

    const transferResult = await bridge.transferTokens({
      fromAddress: solAddress,
      toAddress: polygonAddress,
      amount,
      fromChain: 'Solana',
      toChain: 'Polygon'
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: transactionSignature,
        status: 'processing',
        sourceChain: 'Solana',
        targetChain: 'Polygon',
        sourceAddress: solAddress,
        targetAddress: polygonAddress,
        amount,
        estimatedTime: 900,
        totalFees,
        netAmount: amount - totalFees,
        createdAt: new Date().toISOString()
      },
      message: 'Bridge transaction submitted. Waiting for VAA attestation.',
      nextSteps: [
        'Transaction submitted to Solana',
        'Waiting for Wormhole guardian signatures',
        'Will be redeemable on Polygon in 10-15 minutes'
      ]
    })

  } catch (error) {
    console.error('Bridge error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initiate bridge transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const txId = searchParams.get('txId')
    const sourceChain = searchParams.get('sourceChain') as 'Solana' | 'Polygon' || 'Solana'

    if (!txId) {
      return NextResponse.json(
        { error: 'Transaction ID required' },
        { status: 400 }
      )
    }

    const bridge = createBridgeInstance('Mainnet')
    const status = await bridge.getTransferStatus(txId, sourceChain)

    return NextResponse.json({
      id: txId,
      ...status,
      sourceChain,
      targetChain: sourceChain === 'Solana' ? 'Polygon' : 'Solana',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to check transaction status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
