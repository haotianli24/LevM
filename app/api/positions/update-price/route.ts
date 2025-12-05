import { NextRequest, NextResponse } from 'next/server'
import { hybridPositionStore } from '@/lib/hybrid-position-store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { marketId, newPrice } = body

    if (!marketId || newPrice === undefined) {
      return NextResponse.json(
        { error: 'Market ID and new price required' },
        { status: 400 }
      )
    }

    if (newPrice <= 0) {
      return NextResponse.json(
        { error: 'Price must be positive' },
        { status: 400 }
      )
    }

    const allPositions = hybridPositionStore.getAllActivePositions()
    const updatedPositions = allPositions.filter(p => p.marketId === marketId)

    let updated = 0
    for (const position of updatedPositions) {
      const success = await hybridPositionStore.updatePosition(position.id, {
        currentPrice: newPrice,
      })
      if (success) updated++
    }

    return NextResponse.json({
      success: true,
      marketId,
      newPrice,
      updatedPositions: updated,
      message: `Updated ${updated} position(s) with new price $${newPrice.toFixed(4)}`,
    })

  } catch (error) {
    console.error('Error updating price:', error)
    return NextResponse.json(
      { error: 'Failed to update price' },
      { status: 500 }
    )
  }
}
