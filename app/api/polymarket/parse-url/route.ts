import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      )
    }

    const parsedUrl = new URL(url)
    
    if (!parsedUrl.hostname.includes('polymarket.com')) {
      return NextResponse.json(
        { error: 'URL must be from polymarket.com' },
        { status: 400 }
      )
    }

    const pathParts = parsedUrl.pathname.split('/').filter(Boolean)
    
    let slug = ''
    let conditionId = ''
    let type: 'event' | 'market' = 'market'
    let marketSlug = ''

    if (pathParts[0] === 'event' && pathParts[1]) {
      slug = pathParts[1]
      type = 'event'
      if (pathParts[2]) {
        marketSlug = pathParts[2]
        slug = marketSlug
        type = 'market'
      }
    } else if (pathParts[0] === 'market' && pathParts[1]) {
      slug = pathParts[1]
      type = 'market'
    } else {
      return NextResponse.json(
        { error: 'Could not extract market identifier from URL' },
        { status: 400 }
      )
    }

    const searchParams = parsedUrl.searchParams
    if (searchParams.has('id')) {
      conditionId = searchParams.get('id') || ''
    }

    console.log('Parsed URL:', { slug, conditionId, type, originalUrl: url })
    
    return NextResponse.json({
      slug,
      conditionId,
      type,
      originalUrl: url
    })

  } catch (error) {
    console.error('Error parsing URL:', error)
    return NextResponse.json(
      { error: 'Failed to parse URL' },
      { status: 500 }
    )
  }
}
