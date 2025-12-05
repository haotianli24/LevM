import { NextRequest, NextResponse } from 'next/server'

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

    const bridgeFeePercent = 0.001
    const gasFee = 0.01
    
    const bridgeFee = amount * bridgeFeePercent
    const totalFees = bridgeFee + gasFee
    const netAmount = amount - totalFees

    const quote = {
      inputAmount: amount,
      inputToken: 'SOL',
      outputAmount: netAmount * 150,
      outputToken: 'USDC',
      bridgeFee,
      gasFee,
      totalFees,
      estimatedTime: 900,
      route: [
        { chain: 'Solana', token: 'SOL', amount },
        { chain: 'Wormhole Bridge', action: 'bridge' },
        { chain: 'Polygon', token: 'USDC', amount: netAmount * 150 }
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
