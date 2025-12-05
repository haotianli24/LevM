import { NextRequest, NextResponse } from 'next/server'
import { createBridgeInstance } from '@/lib/wormhole-bridge'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const amount = parseFloat(searchParams.get('amount') || '0')

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    const bridge = createBridgeInstance('Mainnet')
    const fees = await bridge.estimateFees('Solana', 'Polygon')
    
    const relayerFee = parseFloat(fees.relayerFee)
    const gasFee = parseFloat(fees.estimatedGas)
    const totalFees = relayerFee + gasFee
    const netAmount = amount - totalFees

    const solToUsdcRate = 150

    const quote = {
      inputAmount: amount,
      inputToken: 'SOL',
      outputAmount: netAmount * solToUsdcRate,
      outputToken: 'USDC',
      bridgeFee: relayerFee,
      gasFee: gasFee,
      totalFees,
      estimatedTime: 900,
      route: [
        { chain: 'Solana', token: 'SOL', amount },
        { chain: 'Wormhole Bridge', action: 'bridge' },
        { chain: 'Polygon', token: 'USDC', amount: netAmount * solToUsdcRate }
      ],
      expiresAt: new Date(Date.now() + 300000).toISOString()
    }

    return NextResponse.json(quote)

  } catch (error) {
    console.error('Quote error:', error)
    return NextResponse.json(
      { error: 'Failed to get bridge quote' },
      { status: 500 }
    )
  }
}
