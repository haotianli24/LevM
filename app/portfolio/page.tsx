"use client"

import { useState, useEffect, useMemo } from "react"
import { Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import WalletMultiButton from '@/components/wallet-button'
import { AppLayout } from "@/components/app-layout"
import { Position } from "@/lib/types"
import { PolymarketLinkDialog } from "@/components/polymarket-link-dialog"
import { PositionDetailDialog } from "@/components/position-detail-dialog"

// Central deposit address - SOL deposits are sent to this address
const DEPOSIT_ADDRESS_STRING = "CXi538rhqgJx56Edrqg1HMmZK4xfKgTDz7r2df4CnJQL"

const getDepositAddress = (publicKey: PublicKey | null) => {
  try {
    return new PublicKey(DEPOSIT_ADDRESS_STRING)
  } catch (error) {
    console.error('Invalid deposit address:', error)
    return publicKey
  }
}

// Polymarket address for executing trades
const polymarketAddress = "0x2C7492fb6caDA189bb20f72cFe29520E07508683"

export default function PortfolioPage() {
  const { publicKey, connected, signTransaction, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const { toast } = useToast()
  
  const [positions, setPositions] = useState<Position[]>([])
  const [userPositions, setUserPositions] = useState<any[]>([])
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null)
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState("")
  const [solBalance, setSolBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [depositing, setDepositing] = useState(false)
  const [depositSignature, setDepositSignature] = useState<string | null>(null)
  const [verifyingDeposit, setVerifyingDeposit] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [depositBalanceUSDC, setDepositBalanceUSDC] = useState(0)
  const [availableBalanceUSDC, setAvailableBalanceUSDC] = useState(0)
  const [usedBalanceUSDC, setUsedBalanceUSDC] = useState(0)
  const [pnlTimeframe, setPnlTimeframe] = useState<"24h" | "7d" | "30d">("24h")
  const [positionsTab, setPositionsTab] = useState<"leveraged" | "polymarket">("leveraged")
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false)
  const [dateJoined] = useState(() => {
    const daysAgo = Math.floor(Math.random() * 335) + 30
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return date
  })

  // Deterministic PnL data generation
  const generatePnLData = (timeframe: "24h" | "7d" | "30d") => {
    const dataPoints = timeframe === "24h" ? 24 : timeframe === "7d" ? 7 : 30
    const data = []
    const now = new Date()
    const seed = timeframe === "24h" ? 12345 : timeframe === "7d" ? 67890 : 11111
    let seedValue = seed
    const seededRandom = () => {
      seedValue = (seedValue * 9301 + 49297) % 233280
      return seedValue / 233280
    }
    let basePnl = timeframe === "24h" ? 20 : timeframe === "7d" ? 50 : 100
    
    for (let i = 0; i < dataPoints; i++) {
      const variation = (seededRandom() - 0.5) * 200
      basePnl += variation
      const pnl = Math.max(-500, Math.min(1500, basePnl))
      
      let timeLabel = ""
      let date = new Date()
      
      if (timeframe === "24h") {
        date.setHours(now.getHours() - (dataPoints - 1 - i))
        const hours = date.getHours()
        const minutes = date.getMinutes()
        timeLabel = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      } else if (timeframe === "7d") {
        date.setDate(now.getDate() - (dataPoints - 1 - i))
        const month = date.getMonth() + 1
        const day = date.getDate()
        timeLabel = `${month}/${day}`
      } else {
        date.setDate(now.getDate() - (dataPoints - 1 - i))
        const month = date.getMonth() + 1
        const day = date.getDate()
        timeLabel = `${month}/${day}`
      }
      
      data.push({
        time: timeLabel,
        pnl: Math.round(pnl),
      })
    }
    
    return data
  }

  const pnlData = useMemo(() => generatePnLData(pnlTimeframe), [pnlTimeframe])

  useEffect(() => {
    if (connected && publicKey) {
      fetchLeveragedPositions()
      fetchUserPositions()
      fetchSolBalance()
      fetchDepositBalance()
    }
  }, [connected, publicKey])

  // Recalculate wallet balance whenever positions or deposits change
  useEffect(() => {
    const polymarketBalance = userPositions.reduce((sum: number, pos: any) => sum + (parseFloat(pos.size) || 0), 0)
    // Use available balance instead of total deposits for wallet balance calculation
    const totalBalance = polymarketBalance + availableBalanceUSDC
    console.log('Wallet balance calculation:', {
      polymarketBalance,
      depositBalanceUSDC,
      availableBalanceUSDC,
      usedBalanceUSDC,
      totalBalance,
      userPositionsCount: userPositions.length
    })
    setWalletBalance(totalBalance)
  }, [userPositions, depositBalanceUSDC, availableBalanceUSDC, usedBalanceUSDC])

  const fetchLeveragedPositions = async () => {
    if (!publicKey) return

    setLoadingPositions(true)
    try {
      const response = await fetch(`/api/positions/list?userAddress=${encodeURIComponent(publicKey.toString())}`)
      if (response.ok) {
        const data = await response.json()
        setPositions(data.positions || [])
      }
    } catch (error) {
      console.error('Error fetching positions:', error)
    } finally {
      setLoadingPositions(false)
    }
  }

  const fetchUserPositions = async () => {
    if (!publicKey) return

    setLoadingPositions(true)
    try {
      const address = publicKey.toString()
      const url = `/api/polymarket/positions?address=${encodeURIComponent(address)}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setUserPositions(data.positions || [])
        setPendingOrders(data.pendingOrders || [])
        // Wallet balance will be updated by useEffect when userPositions changes
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast({
          title: "Error Fetching Positions",
          description: errorData.error || `Failed to fetch Polymarket positions (HTTP ${response.status})`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error fetching positions:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch positions",
        variant: "destructive",
      })
    } finally {
      setLoadingPositions(false)
    }
  }

  const fetchSolBalance = async () => {
    if (!publicKey) return

    setLoadingBalance(true)
    try {
      // Fetch balance directly from the wallet connection
      const balance = await connection.getBalance(publicKey)
      setSolBalance(balance / LAMPORTS_PER_SOL)
      console.log('Fetched SOL balance:', balance / LAMPORTS_PER_SOL, 'SOL')
    } catch (error) {
      console.error('Error fetching SOL balance:', error)
      toast({
        title: "Error Fetching Balance",
        description: "Failed to fetch wallet balance. Please check your connection.",
        variant: "destructive",
      })
    } finally {
      setLoadingBalance(false)
    }
  }

  const fetchDepositBalance = async () => {
    if (!publicKey) return

    try {
      const response = await fetch(`/api/deposits/user-balance?address=${encodeURIComponent(publicKey.toString())}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Deposit balance fetched:', {
          totalDepositsSOL: data.totalDepositsSOL,
          totalDepositsUSDC: data.totalDepositsUSDC,
          usedAmount: data.usedAmount,
          availableBalance: data.availableBalance,
          depositCount: data.deposits?.length || 0,
          deposits: data.deposits,
          address: data.address
        })
        const newBalance = data.totalDepositsUSDC || 0
        const newAvailable = data.availableBalance || 0
        const newUsed = data.usedAmount || 0
        console.log(`Setting balances - Total: ${newBalance} USDC, Available: ${newAvailable} USDC, Used: ${newUsed} USDC (${data.totalDepositsSOL || 0} SOL)`)
        setDepositBalanceUSDC(newBalance)
        setAvailableBalanceUSDC(newAvailable)
        setUsedBalanceUSDC(newUsed)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch deposit balance:', {
          status: response.status,
          error: errorData
        })
      }
    } catch (error) {
      console.error('Error fetching deposit balance:', error)
    }
  }

  const handleClosePosition = async (positionId: string) => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    setClosingPositionId(positionId)
    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          positionId,
          userAddress: publicKey.toString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to close position')
      }

      const data = await response.json()
      toast({
        title: "Position Closed",
        description: data.message || `Position closed. Final balance: $${data.finalBalance.toFixed(2)}`,
      })

      await fetchLeveragedPositions()
    } catch (error) {
      console.error('Error closing position:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to close position",
        variant: "destructive",
      })
    } finally {
      setClosingPositionId(null)
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    setCancelingOrderId(orderId)
    try {
      const response = await fetch('/api/polymarket/cancel-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          userAddress: publicKey.toString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to cancel order')
      }

      const data = await response.json()
      toast({
        title: "Order Cancelled",
        description: data.message || "Order cancelled successfully",
      })

      await fetchUserPositions()
    } catch (error) {
      console.error('Error canceling order:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel order",
        variant: "destructive",
      })
    } finally {
      setCancelingOrderId(null)
    }
  }

  const handleDeposit = async () => {
    if (!connected || !publicKey || !signTransaction || !sendTransaction) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your Solana wallet first",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(depositAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    if (solBalance !== null && amount > solBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${solBalance.toFixed(4)} SOL`,
        variant: "destructive",
      })
      return
    }

    setDepositing(true)
    try {
      const depositAddress = getDepositAddress(publicKey)
      if (!depositAddress) {
        throw new Error('Deposit address not configured')
      }

      const lamports = Math.floor(amount * LAMPORTS_PER_SOL)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: depositAddress,
          lamports,
        })
      )

      let blockhash: string
      let lastValidBlockHeight: number
      try {
        const blockhashResult = await connection.getLatestBlockhash()
        blockhash = blockhashResult.blockhash
        lastValidBlockHeight = blockhashResult.lastValidBlockHeight
      } catch (error: any) {
        if (error?.message?.includes('403') || error?.message?.includes('Access forbidden')) {
          toast({
            title: "RPC Rate Limit",
            description: "Please try again in a moment, or configure a custom RPC endpoint",
            variant: "destructive",
          })
          throw new Error('RPC endpoint rate limited.')
        }
        throw error
      }
      
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const signed = await signTransaction(transaction)
      const signature = await sendTransaction(signed, connection)

      setDepositSignature(signature)

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed')

      toast({
        title: "Deposit Transaction Sent",
        description: `Transaction ${signature.slice(0, 8)}... sent. Verifying...`,
      })

      await verifyDeposit(signature)

    } catch (error) {
      console.error('Error creating deposit:', error)
      toast({
        title: "Deposit Failed",
        description: error instanceof Error ? error.message : "Failed to create deposit transaction",
        variant: "destructive",
      })
      setDepositSignature(null)
    } finally {
      setDepositing(false)
    }
  }

  const verifyDeposit = async (signature: string) => {
    if (!publicKey) return

    setVerifyingDeposit(true)
    try {
      let verified = false
      let attempts = 0
      const maxAttempts = 10

      while (!verified && attempts < maxAttempts) {
        const response = await fetch('/api/deposits/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signature,
            userAddress: publicKey.toString(),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('Verification response:', data)
          if (data.verified) {
            verified = true
            console.log('Deposit verified successfully:', {
              signature,
              amount: data.amount,
              userAddress: publicKey.toString()
            })
            toast({
              title: "Deposit Verified",
              description: data.message || `Deposit of ${data.amount?.toFixed(4) || '0'} SOL confirmed`,
            })
            setDepositAmount('')
            setDepositSignature(null)
            await fetchSolBalance()
            // Wait a bit for the deposit to be stored, then refresh
            await new Promise(resolve => setTimeout(resolve, 1000))
            console.log('Refreshing deposit balance after verification...')
            await fetchDepositBalance() // Refresh deposit balance after verification
            break
          } else {
            console.log('Deposit not yet verified, response:', data)
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error('Deposit verification failed:', {
            status: response.status,
            error: errorData
          })
          toast({
            title: "Verification Failed",
            description: errorData.error || `Failed to verify deposit (${response.status})`,
            variant: "destructive",
          })
        }

        await new Promise(resolve => setTimeout(resolve, 2000))
        attempts++
      }

      if (!verified) {
        toast({
          title: "Verification Pending",
          description: "Deposit transaction is still being confirmed. Please check again later.",
          variant: "default",
        })
      }
    } catch (error) {
      console.error('Error verifying deposit:', error)
      toast({
        title: "Verification Error",
        description: error instanceof Error ? error.message : "Failed to verify deposit",
        variant: "destructive",
      })
    } finally {
      setVerifyingDeposit(false)
    }
  }

  const calculatePnL = (pos: Position) => {
    if (pos.pnlPercentage !== undefined) return pos.pnlPercentage
    const priceDiff = pos.side === "long" 
      ? pos.currentPrice - pos.entryPrice
      : pos.entryPrice - pos.currentPrice
    return (priceDiff / pos.entryPrice) * 100 * pos.leverage
  }

  const getHealthBadge = (health?: "healthy" | "warning" | "danger") => {
    if (!health) return null
    const colors = {
      healthy: "bg-green-500/20 text-green-500 border-green-500/30",
      warning: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
      danger: "bg-red-500/20 text-red-500 border-red-500/30",
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-mono border ${colors[health]}`}>
        {health.toUpperCase()}
      </span>
    )
  }

  return (
    <AppLayout title="Portfolio">
      <div className="space-y-6">
        {!connected ? (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Portfolio</h3>
            <p className="text-muted-foreground mb-4">Connect your wallet to view your positions</p>
            <div className="wallet-button-wrapper">
              <WalletMultiButton />
            </div>
          </div>
        ) : (
          <>
            {/* Profile and PnL Boxes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profile Info Box */}
              <Card className="bg-card border-zinc-800 p-6">
                <h3 className="text-lg font-bold mb-4">Profile</h3>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm break-all mb-2">
                      {publicKey?.toString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {dateJoined.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Wallet Balance</p>
                      <Button
                        onClick={async () => {
                          await fetchDepositBalance()
                          await fetchUserPositions()
                          toast({
                            title: "Balance Refreshed",
                            description: `Available: ${availableBalanceUSDC.toFixed(2)} USDC`,
                          })
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                      >
                        Refresh
                      </Button>
                    </div>
                    <p className="text-2xl font-bold font-mono">
                      ${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: ${availableBalanceUSDC.toFixed(2)} USDC
                    </p>
                    {usedBalanceUSDC > 0 && (
                      <p className="text-xs text-yellow-500 mt-1">
                        In positions: ${usedBalanceUSDC.toFixed(2)} USDC
                      </p>
                    )}
                    {depositBalanceUSDC > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Total deposited: {(depositBalanceUSDC / 150).toFixed(4)} SOL (${depositBalanceUSDC.toFixed(2)} USDC)
                      </p>
                    )}
                    {depositBalanceUSDC === 0 && (
                      <p className="text-xs text-yellow-500 mt-1">
                        No deposits found. If you deposited, verify the transaction.
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Polymarket Account</p>
                      <PolymarketLinkDialog />
                    </div>
                    {polymarketAddress && (
                      <p className="font-mono text-xs break-all text-muted-foreground">
                        {polymarketAddress}
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* PnL Graph Box */}
              <Card className="bg-card border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Profit & Loss</h3>
                  <Tabs value={pnlTimeframe} onValueChange={(v) => setPnlTimeframe(v as "24h" | "7d" | "30d")}>
                    <TabsList className="bg-accent border-zinc-800">
                      <TabsTrigger value="24h" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
                        24h
                      </TabsTrigger>
                      <TabsTrigger value="7d" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
                        7d
                      </TabsTrigger>
                      <TabsTrigger value="30d" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
                        30d
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="h-[200px] w-full overflow-hidden bg-accent/20 rounded-lg p-2">
                  <ChartContainer
                    config={{
                      pnl: {
                        label: "PnL",
                        color: "#8b5cf6",
                      },
                    }}
                    className="h-full w-full"
                  >
                    <LineChart 
                      data={pnlData}
                      margin={{ top: 10, right: 15, bottom: 10, left: 15 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" opacity={0.3} />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: "#e2e8f0", fontSize: 11, fontWeight: 500 }}
                        tickLine={{ stroke: "#e2e8f0" }}
                        axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                      />
                      <YAxis
                        tick={{ fill: "#e2e8f0", fontSize: 11, fontWeight: 500 }}
                        tickLine={{ stroke: "#e2e8f0" }}
                        axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                        tickFormatter={(value) => `$${value}`}
                        width={70}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem"
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
                        connectNulls={true}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              </Card>
            </div>

            {/* Deposit Box */}
            <Card className="bg-card border-zinc-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Deposit SOL</h3>
                <Button
                  onClick={fetchSolBalance}
                  disabled={loadingBalance}
                  variant="outline"
                  size="sm"
                >
                  {loadingBalance ? "Loading..." : "Refresh"}
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-accent border border-zinc-800 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
                  <p className="text-2xl font-bold font-mono">
                    {loadingBalance ? (
                      <span className="text-muted-foreground">Loading...</span>
                    ) : solBalance !== null ? (
                      `${solBalance.toFixed(4)} SOL`
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Deposit Amount (SOL)</label>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="bg-accent border-zinc-700 font-mono"
                    disabled={depositing || verifyingDeposit}
                  />
                  {solBalance !== null && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDepositAmount((solBalance * 0.25).toFixed(4))}
                        disabled={depositing || verifyingDeposit}
                        className="text-xs"
                      >
                        25%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDepositAmount((solBalance * 0.5).toFixed(4))}
                        disabled={depositing || verifyingDeposit}
                        className="text-xs"
                      >
                        50%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDepositAmount((solBalance * 0.75).toFixed(4))}
                        disabled={depositing || verifyingDeposit}
                        className="text-xs"
                      >
                        75%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDepositAmount(solBalance.toFixed(4))}
                        disabled={depositing || verifyingDeposit}
                        className="text-xs"
                      >
                        Max
                      </Button>
                    </div>
                  )}
                </div>

                {depositSignature && (
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Transaction Signature</p>
                    <p className="font-mono text-xs break-all text-primary">
                      {depositSignature}
                    </p>
                    {verifyingDeposit && (
                      <p className="text-xs text-muted-foreground mt-2">Verifying deposit...</p>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleDeposit}
                  disabled={depositing || verifyingDeposit || !depositAmount || parseFloat(depositAmount) <= 0}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {depositing ? "Creating Transaction..." : verifyingDeposit ? "Verifying..." : "Deposit SOL"}
                </Button>
              </div>
            </Card>

            {/* Positions - Combined with Tabs */}
            <Card className="bg-card border-zinc-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <Tabs value={positionsTab} onValueChange={(v) => setPositionsTab(v as "leveraged" | "polymarket")}>
                  <TabsList className="bg-accent border-zinc-800">
                    <TabsTrigger value="leveraged" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      Leveraged
                    </TabsTrigger>
                    <TabsTrigger value="polymarket" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      Polymarket
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  onClick={() => {
                    if (positionsTab === "leveraged") {
                      fetchLeveragedPositions()
                    } else {
                      fetchUserPositions()
                    }
                  }}
                  disabled={loadingPositions}
                  variant="outline"
                  size="sm"
                >
                  {loadingPositions ? "Loading..." : "Refresh"}
                </Button>
              </div>

              {/* Leveraged Positions Tab */}
              {positionsTab === "leveraged" && (
                <>
                  
                  {loadingPositions ? (
                    <p className="text-center py-8 text-muted-foreground">Loading positions...</p>
                  ) : positions.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No leveraged positions found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800">
                            <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Market</th>
                            <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Side</th>
                            <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Entry</th>
                            <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Current</th>
                            <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Liquidation</th>
                            <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">P&L</th>
                            <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Margin</th>
                            <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Health</th>
                            <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {positions.map((pos) => {
                            const pnl = calculatePnL(pos)
                            const pnlAmount = pos.pnl ?? 0
                            return (
                              <tr 
                                key={pos.id} 
                                className="border-b border-zinc-800 hover:bg-accent/50 cursor-pointer"
                                onClick={() => {
                                  setSelectedPosition(pos)
                                  setIsPositionDialogOpen(true)
                                }}
                              >
                                <td className="py-4 px-4 font-mono text-xs truncate max-w-[200px]" title={pos.marketName}>
                                  {pos.marketName}
                                </td>
                                <td className="py-4 px-4 font-mono text-sm">
                                  <span className={`font-bold ${pos.side === "long" ? "text-primary" : "text-secondary"}`}>
                                    {pos.side.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-4 px-4 font-mono text-xs">${pos.entryPrice.toFixed(4)}</td>
                                <td className="py-4 px-4 font-mono text-xs">${pos.currentPrice.toFixed(4)}</td>
                                <td className="py-4 px-4 font-mono text-xs text-red-400">${pos.liquidationPrice.toFixed(4)}</td>
                                <td className="py-4 px-4 font-mono text-sm">
                                  <div className="flex flex-col">
                                    <span className={pnl >= 0 ? "text-primary" : "text-secondary"}>
                                      {pnl >= 0 ? "+" : ""}
                                      {pnl.toFixed(2)}%
                                    </span>
                                    <span className={`text-xs ${pnlAmount >= 0 ? "text-primary/70" : "text-secondary/70"}`}>
                                      ${pnlAmount >= 0 ? "+" : ""}{pnlAmount.toFixed(2)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-4 font-mono text-xs">
                                  {pos.marginRatio !== undefined ? `${pos.marginRatio.toFixed(2)}%` : "N/A"}
                                </td>
                                <td className="py-4 px-4">
                                  {getHealthBadge(pos.health)}
                                </td>
                                <td className="py-4 px-4">
                                  {pos.status === "active" && (
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleClosePosition(pos.id)
                                      }}
                                      disabled={closingPositionId === pos.id}
                                      variant="outline"
                                      size="sm"
                                      className="text-xs"
                                    >
                                      {closingPositionId === pos.id ? "Closing..." : "Close"}
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Polymarket Positions Tab */}
              {positionsTab === "polymarket" && (
                <>
                  {/* Pending Orders */}
                  {pendingOrders.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold mb-3 text-yellow-500">Pending Orders ({pendingOrders.length})</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-800">
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Market</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Side</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Size</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Price</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Filled</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Status</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingOrders.map((order: any) => (
                              <tr key={order.id} className="border-b border-zinc-800 hover:bg-accent/50">
                                <td className="py-4 px-4 font-mono text-xs truncate max-w-[200px]" title={order.market}>
                                  {order.market}
                                </td>
                                <td className="py-4 px-4 font-mono text-sm">
                                  <span className={`font-bold ${order.side === "long" ? "text-primary" : "text-secondary"}`}>
                                    {order.side === "long" ? "YES" : "NO"}
                                  </span>
                                </td>
                                <td className="py-4 px-4 font-mono text-xs">{order.size.toLocaleString()}</td>
                                <td className="py-4 px-4 font-mono text-xs">${order.price.toFixed(4)}</td>
                                <td className="py-4 px-4 font-mono text-xs">
                                  {order.filledSize > 0 ? `${order.filledSize.toLocaleString()} / ${order.size.toLocaleString()}` : "0"}
                                </td>
                                <td className="py-4 px-4 font-mono text-sm">
                                  <span className="text-yellow-500">{order.status.toUpperCase()}</span>
                                </td>
                                <td className="py-4 px-4">
                                  <Button
                                    onClick={() => handleCancelOrder(order.orderId || order.id)}
                                    disabled={cancelingOrderId === (order.orderId || order.id)}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                  >
                                    {cancelingOrderId === (order.orderId || order.id) ? "Canceling..." : "Cancel"}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Filled Positions */}
                  {loadingPositions ? (
                    <p className="text-center py-8 text-muted-foreground">Loading positions...</p>
                  ) : userPositions.length === 0 && pendingOrders.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No positions or orders found</p>
                  ) : userPositions.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 text-primary">Filled Positions ({userPositions.length})</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-800">
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Market</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Side</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Size</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Entry Price</th>
                              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-mono">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userPositions.map((pos: any) => (
                              <tr key={pos.id} className="border-b border-zinc-800 hover:bg-accent/50">
                                <td className="py-4 px-4 font-mono text-xs truncate max-w-[200px]" title={pos.market}>
                                  {pos.market}
                                </td>
                                <td className="py-4 px-4 font-mono text-sm">
                                  <span className={`font-bold ${pos.side === "long" ? "text-primary" : "text-secondary"}`}>
                                    {pos.side === "long" ? "YES" : "NO"}
                                  </span>
                                </td>
                                <td className="py-4 px-4 font-mono text-xs">{pos.size.toLocaleString()}</td>
                                <td className="py-4 px-4 font-mono text-xs">${pos.price.toFixed(4)}</td>
                                <td className="py-4 px-4 font-mono text-sm">
                                  <span className="text-primary">{pos.status.toUpperCase()}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Position Detail Dialog */}
      <PositionDetailDialog
        position={selectedPosition}
        isOpen={isPositionDialogOpen}
        onClose={() => {
          setIsPositionDialogOpen(false)
          setSelectedPosition(null)
        }}
        onClosePosition={handleClosePosition}
        closingPositionId={closingPositionId}
      />
    </AppLayout>
  )
}

