# LevM - Leverage Trading on Polymarket

A platform for leveraged trading on Polymarket prediction markets with SOL bridging to Polygon.

## Features

- Connect Polymarket account to view positions
- Bridge SOL from Solana to USDC on Polygon
- Analyze Polymarket markets with PLV scoring
- View real-time market data from Polymarket Gamma API
- Track your positions and portfolio

## Setup

### Prerequisites

- Node.js 18+ installed
- A Polymarket API key

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file in the project root:
```bash
POLYMARKET_API_KEY=your_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Architecture

### Backend API Routes

- `/api/polymarket/parse-url` - Parse Polymarket URLs
- `/api/polymarket/market` - Fetch individual market data
- `/api/polymarket/markets` - List active markets
- `/api/polymarket/positions` - Fetch user positions from CLOB
- `/api/bridge/quote` - Get bridge quote for SOL to Polygon
- `/api/bridge/sol-to-polygon` - Initiate bridge transaction

### Frontend Features

- **Markets Page**: Browse and analyze active Polymarket markets
- **Portfolio Page**: View your Polymarket positions
- **Settings Page**: Bridge SOL to Polygon for trading

## PLV Score Calculation

PLV (Price, Liquidity, Volume) score is calculated using:

- **Price Score** (30%): Based on distance from 0.5 (more directional = higher score)
- **Volume Score** (30%): Normalized to $1M cap
- **Liquidity Score** (40%): Normalized to $100k cap

Formula:
```
priceScore = min(|price - 0.5| * 2 * 100, 100)
volumeScore = min((volume / 1,000,000) * 100, 100)
liquidityScore = min((liquidity / 100,000) * 100, 100)
plvScore = round(priceScore * 0.3 + volumeScore * 0.3 + liquidityScore * 0.4)
```

## Bridge Flow

1. User enters SOL amount to deposit
2. System fetches bridge quote (fees, output amount, estimated time)
3. User approves bridge transaction
4. SOL is converted to USDC on Polygon
5. USDC becomes available for Polymarket trading

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Solana Wallet Adapter
- Polymarket Gamma API
- TailwindCSS
- shadcn/ui components

## License

MIT
