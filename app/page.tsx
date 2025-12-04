"use client"

import { useState } from "react"
import { Home, TrendingUp, Wallet, Settings, Menu, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

interface Market {
  id: string
  name: string
  liquidity: number
  oraclePrice: number
  change24h: number
}

interface Position {
  id: string
  market: string
  side: "long" | "short"
  entryPrice: number
  currentPrice: number
  collateral: number
  leverage: number
  liquidationPrice: number
  status: "active" | "liquidated"
}

const MOCK_MARKETS: Market[] = [
  { id: "1", name: "Trump vs Harris 2024", liquidity: 98, oraclePrice: 0.55, change24h: 2.5 },
  { id: "2", name: "Fed Rates Q1 2025", liquidity: 92, oraclePrice: 0.42, change24h: -1.2 },
  { id: "3", name: "Bitcoin Above 50k", liquidity: 88, oraclePrice: 0.78, change24h: 5.3 },
]

export default function PolyLeverage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState<"dashboard" | "markets" | "portfolio" | "settings">("dashboard")
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [polymarketUrl, setPolymarketUrl] = useState("")
  const [selectedTab, setSelectedTab] = useState<"long" | "short">("long")
  const [collateral, setCollateral] = useState("1000")
  const [leverage, setLeverage] = useState(2)
  const [oraclePrice, setOraclePrice] = useState(0.5)
  const [positions, setPositions] = useState<Position[]>([])
  const { toast } = useToast()

  const handleAnalyzeMarket = () => {
    if (!polymarketUrl.trim()) {
      toast({
        title: "Error",
        description: "Please paste a Polymarket URL",
        variant: "destructive",
      })
      return
    }
    setSelectedMarket(MOCK_MARKETS[0])
    toast({
      title: "Market Analyzed",
      description: "PLV score calculated. Ready to trade.",
    })
  }

  const handlePlacePosition = () => {
    const positionSize = Number.parseFloat(collateral) * leverage
    const liquidationPrice = (Number.parseFloat(collateral) / positionSize) * 0.95

    const newPosition: Position = {
      id: Math.random().toString(),
      market: selectedMarket?.name || "Unknown",
      side: selectedTab,
      entryPrice: selectedMarket?.oraclePrice || 0.5,
      currentPrice: oraclePrice,
      collateral: Number.parseFloat(collateral),
      leverage,
      liquidationPrice,
      status: "active",
    }

    setPositions([...positions, newPosition])
    toast({
      title: "Position Opened",
      description: `${selectedTab.toUpperCase()} position created at $${newPosition.entryPrice.toFixed(2)}`,
    })
  }

  const calculatePnL = (position: Position) => {
    if (position.side === "long") {
      return ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100 * position.leverage
    }
    return ((position.entryPrice - position.currentPrice) / position.entryPrice) * 100 * position.leverage
  }

  const navItems = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "markets", label: "Markets", icon: TrendingUp },
    { id: "portfolio", label: "Portfolio", icon: Wallet },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-accent border-r border-zinc-800 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:relative lg:translate-x-0`}
      >
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">PolyLeverage</span>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id as any)
                  setSidebarOpen(false)
                  // Reset selected market when going to dashboard
                  if (item.id === "dashboard") {
                    setSelectedMarket(null)
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentPage === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-[81px] border-b border-zinc-800 bg-card px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-lg font-semibold">
              {currentPage === "dashboard" && "Dashboard"}
              {currentPage === "markets" && "Markets"}
              {currentPage === "portfolio" && "Portfolio"}
              {currentPage === "settings" && "Settings"}
            </h2>
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Connect Wallet</Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {currentPage === "dashboard" && (
            <div className="space-y-6">
              {!selectedMarket ? (
                <Card className="bg-card border-zinc-800 p-8">
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold mb-2">Link to Leverage</h3>
                      <p className="text-muted-foreground">
                        Paste a Polymarket URL and we'll analyze the PLV (Price, Liquidity, Volume)
                      </p>
                    </div>

                    <div className="space-y-4">
                      <Input
                        placeholder="Paste Polymarket URL"
                        value={polymarketUrl}
                        onChange={(e) => setPolymarketUrl(e.target.value)}
                        className="bg-accent border-zinc-700 h-12 placeholder-muted-foreground"
                      />
                      <Button
                        onClick={handleAnalyzeMarket}
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      >
                        Analyze PLV
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Market Info */}
                  <Card className="bg-card border-zinc-800 p-6 lg:col-span-1">
                    <h3 className="text-lg font-bold mb-6">Market Info</h3>

                    <div className="space-y-6">
                      <div className="pb-6 border-b border-zinc-800">
                        <p className="text-xs text-muted-foreground mb-1">Market Title</p>
                        <p className="font-mono text-sm">{selectedMarket.name}</p>
                      </div>

                      <div className="pb-6 border-b border-zinc-800">
                        <div className="bg-primary/10 border border-primary/30 rounded px-3 py-2">
                          <p className="text-primary font-mono text-sm">PLV: {selectedMarket.liquidity}/100</p>
                          <p className="text-primary/80 font-mono text-xs">High Liquidity</p>
                        </div>
                      </div>

                      <div className="pb-6 border-b border-zinc-800">
                        <p className="text-xs text-muted-foreground mb-1">Oracle Price</p>
                        <p className="font-mono text-2xl font-bold">${oraclePrice.toFixed(2)}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Source</p>
                        <div className="bg-accent px-3 py-2 rounded text-xs font-mono text-muted-foreground border border-zinc-800">
                          Polymarket Gamma API
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Trading Form */}
                  <Card className="bg-card border-zinc-800 p-6 lg:col-span-2">
                    <h3 className="text-lg font-bold mb-6">Execution</h3>

                    <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)} className="mb-6">
                      <TabsList className="bg-accent border-zinc-800">
                        <TabsTrigger
                          value="long"
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          Long
                        </TabsTrigger>
                        <TabsTrigger
                          value="short"
                          className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
                        >
                          Short
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="mb-6">
                      <label className="text-xs text-muted-foreground mb-2 block">Collateral (USDC)</label>
                      <Input
                        type="number"
                        value={collateral}
                        onChange={(e) => setCollateral(e.target.value)}
                        className="bg-accent border-zinc-700 font-mono"
                      />
                    </div>

                    <div className="mb-8">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs text-muted-foreground">Leverage</label>
                        <span className="font-mono text-primary font-bold">{leverage.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.1"
                        value={leverage}
                        onChange={(e) => setLeverage(Number.parseFloat(e.target.value))}
                        className="w-full h-2 bg-accent rounded accent-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-accent rounded border border-zinc-800">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Position Size</p>
                        <p className="font-mono text-lg font-bold">
                          ${(Number.parseFloat(collateral) * leverage).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Liquidation Price</p>
                        <p className="font-mono text-lg font-bold text-secondary">
                          $
                          {(
                            (Number.parseFloat(collateral) / (Number.parseFloat(collateral) * leverage)) *
                            0.95
                          ).toFixed(4)}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={handlePlacePosition}
                      className={`w-full h-12 font-semibold ${selectedTab === "long"
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                        }`}
                    >
                      Open Position
                    </Button>
                  </Card>
                </div>
              )}

              {/* Positions Table */}
              {positions.length > 0 && (
                <Card className="bg-card border-zinc-800 p-6">
                  <h3 className="text-lg font-bold mb-4">Active Positions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Market</th>
                          <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Side</th>
                          <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Entry</th>
                          <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Current</th>
                          <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">P&L</th>
                          <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((pos) => {
                          const pnl = calculatePnL(pos)
                          return (
                            <tr key={pos.id} className="border-b border-zinc-800 hover:bg-accent/50">
                              <td className="py-4 px-4 font-mono text-xs truncate">{pos.market}</td>
                              <td className="py-4 px-4 font-mono text-sm">
                                <span
                                  className={`font-bold ${pos.side === "long" ? "text-primary" : "text-secondary"}`}
                                >
                                  {pos.side.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-4 px-4 font-mono text-xs">${pos.entryPrice.toFixed(2)}</td>
                              <td className="py-4 px-4 font-mono text-xs">${pos.currentPrice.toFixed(2)}</td>
                              <td className="py-4 px-4 font-mono text-sm">
                                <span className={pnl >= 0 ? "text-primary" : "text-secondary"}>
                                  {pnl >= 0 ? "+" : ""}
                                  {pnl.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-4 px-4 font-mono text-sm">
                                <span className={pos.status === "active" ? "text-primary" : "text-secondary"}>
                                  {pos.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* God Mode */}
              {selectedMarket && (
                <Card className="bg-card border-zinc-800 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        God Mode - Oracle Simulator
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Simulate oracle price to test liquidation mechanics
                      </p>
                    </div>
                  </div>

                  <div className="max-w-md space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-muted-foreground">Simulate Oracle Price</label>
                      <span className="font-mono text-primary font-bold">${oraclePrice.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.01"
                      value={oraclePrice}
                      onChange={(e) => setOraclePrice(Number.parseFloat(e.target.value))}
                      className="w-full h-2 bg-accent rounded accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">Original: ${selectedMarket.oraclePrice.toFixed(2)}</p>
                  </div>
                </Card>
              )}
            </div>
          )}

          {currentPage === "markets" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">Recent Markets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MOCK_MARKETS.map((market) => (
                  <Card
                    key={market.id}
                    className="bg-card border-zinc-800 p-4 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => {
                      setSelectedMarket(market)
                      setCurrentPage("dashboard")
                    }}
                  >
                    <p className="font-semibold text-sm mb-3">{market.name}</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Liquidity</span>
                        <span className="font-mono text-primary">{market.liquidity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-mono">${market.oraclePrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">24h Change</span>
                        <span className={`font-mono ${market.change24h >= 0 ? "text-primary" : "text-secondary"}`}>
                          {market.change24h >= 0 ? "+" : ""}
                          {market.change24h.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {currentPage === "portfolio" && (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Portfolio</h3>
              <p className="text-muted-foreground">Connect your wallet to view your positions</p>
            </div>
          )}

          {currentPage === "settings" && (
            <div className="text-center py-12">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Settings</h3>
              <p className="text-muted-foreground">Coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
