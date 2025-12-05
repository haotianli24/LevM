"use client"

import { Position } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ExternalLink, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"

interface PositionDetailDialogProps {
  position: Position | null
  isOpen: boolean
  onClose: () => void
  onClosePosition?: (positionId: string) => void
  closingPositionId?: string | null
}

export function PositionDetailDialog({
  position,
  isOpen,
  onClose,
  onClosePosition,
  closingPositionId,
}: PositionDetailDialogProps) {
  if (!position) return null

  const calculatePnL = () => {
    if (position.pnlPercentage !== undefined) return position.pnlPercentage
    const priceDiff = position.side === "long" 
      ? position.currentPrice - position.entryPrice
      : position.entryPrice - position.currentPrice
    return (priceDiff / position.entryPrice) * 100 * position.leverage
  }

  const pnl = calculatePnL()
  const pnlAmount = position.pnl ?? 0
  const positionSize = position.positionSize ?? (position.collateral * position.leverage)
  const distanceToLiquidation = position.side === "long"
    ? ((position.currentPrice - position.liquidationPrice) / position.currentPrice) * 100
    : ((position.liquidationPrice - position.currentPrice) / position.currentPrice) * 100

  const getHealthColor = (health?: "healthy" | "warning" | "danger") => {
    if (!health) return "text-muted-foreground"
    const colors = {
      healthy: "text-green-500",
      warning: "text-yellow-500",
      danger: "text-red-500",
    }
    return colors[health]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Position Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Market Info */}
          <Card className="rounded-none bg-accent/50 border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Market</h3>
                <p className="text-lg font-bold break-words">{position.marketName}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0"
                onClick={() => window.open(`/markets/${position.marketId}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 text-sm font-bold ${
                position.side === "long" 
                  ? "bg-green-500/20 text-green-500" 
                  : "bg-red-500/20 text-red-500"
              }`}>
                {position.side === "long" ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 mr-1" />
                )}
                {position.side.toUpperCase()}
              </span>
              <span className={`px-3 py-1 text-sm font-mono border ${
                position.status === "active" 
                  ? "bg-blue-500/20 text-blue-500 border-blue-500/30"
                  : position.status === "closed"
                  ? "bg-gray-500/20 text-gray-500 border-gray-500/30"
                  : "bg-red-500/20 text-red-500 border-red-500/30"
              }`}>
                {position.status.toUpperCase()}
              </span>
            </div>
          </Card>

          {/* Price Information with P&L */}
          <Card className="rounded-none bg-accent/50 border-zinc-800 p-4">
            <h3 className="text-sm font-semibold mb-3">Price & Performance</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <h4 className="text-xs text-muted-foreground mb-1">Entry Price</h4>
                <p className="text-lg font-bold font-mono">${position.entryPrice.toFixed(4)}</p>
              </div>
              <div>
                <h4 className="text-xs text-muted-foreground mb-1">Current Price</h4>
                <p className="text-lg font-bold font-mono">${position.currentPrice.toFixed(4)}</p>
                <div className="mt-2">
                  <p className={`text-sm font-bold font-mono ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-xs text-muted-foreground mb-1">Liquidation Price</h4>
                <p className="text-lg font-bold font-mono text-red-400">${position.liquidationPrice.toFixed(4)}</p>
              </div>
            </div>
          </Card>

          {/* Position Metrics - All in One Box */}
          <Card className="rounded-none bg-accent/50 border-zinc-800 p-4">
            <h3 className="text-sm font-semibold mb-3">Position Metrics</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <h4 className="text-xs text-muted-foreground mb-1">Position Size</h4>
                <p className="text-xl font-bold font-mono">${positionSize.toFixed(2)}</p>
              </div>
              <div>
                <h4 className="text-xs text-muted-foreground mb-1">Collateral</h4>
                <p className="text-xl font-bold font-mono">${position.collateral.toFixed(2)}</p>
              </div>
              <div>
                <h4 className="text-xs text-muted-foreground mb-1">Leverage</h4>
                <p className="text-xl font-bold font-mono">{position.leverage}x</p>
              </div>
              <div>
                <h4 className="text-xs text-muted-foreground mb-1">Margin Ratio</h4>
                <p className="text-xl font-bold font-mono">
                  {position.marginRatio !== undefined ? `${position.marginRatio.toFixed(2)}%` : "N/A"}
                </p>
              </div>
            </div>
          </Card>

          {/* Health & Liquidation Risk */}
          <Card className="rounded-none bg-accent/50 border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Position Health</h3>
              {position.health && (
                <span className={`px-3 py-1 text-xs font-bold border ${
                  position.health === "healthy"
                    ? "bg-green-500/20 text-green-500 border-green-500/30"
                    : position.health === "warning"
                    ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                    : "bg-red-500/20 text-red-500 border-red-500/30"
                }`}>
                  {position.health.toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Distance to Liquidation</span>
                <span className={`font-mono font-bold ${
                  distanceToLiquidation > 20 ? "text-green-500" :
                  distanceToLiquidation > 10 ? "text-yellow-500" :
                  "text-red-500"
                }`}>
                  {distanceToLiquidation.toFixed(2)}%
                </span>
              </div>
              {distanceToLiquidation < 15 && (
                <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 text-xs">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  <span className="text-yellow-500">Warning: Position is close to liquidation</span>
                </div>
              )}
            </div>
          </Card>

          {/* Timestamps & Metadata */}
          <Card className="rounded-none bg-accent/50 border-zinc-800 p-4">
            <h3 className="text-sm font-semibold mb-3">Position Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Position ID</span>
                <span className="font-mono text-xs">{position.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created At</span>
                <span className="font-mono">{formatDate(position.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">User Address</span>
                <span className="font-mono text-xs truncate max-w-[200px]" title={position.userAddress}>
                  {position.userAddress}
                </span>
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          {position.status === "active" && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => onClosePosition?.(position.id)}
                disabled={closingPositionId === position.id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {closingPositionId === position.id ? "Closing..." : "Close Position"}
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

