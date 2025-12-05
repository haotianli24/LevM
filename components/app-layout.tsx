"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { TrendingUp, Wallet, Coins, Menu, X } from "lucide-react"
import WalletMultiButton from '@/components/wallet-button'
import Link from "next/link"
import Image from "next/image"

const navItems = [
  { id: "markets", label: "Markets", icon: TrendingUp, path: "/markets" },
  { id: "stake", label: "Stake", icon: Coins, path: "/stake" },
  { id: "portfolio", label: "Portfolio", icon: Wallet, path: "/portfolio" },
]

export function AppLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-accent border-r border-zinc-800 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:relative lg:translate-x-0`}
      >
        <div className="h-[81px] px-6 border-b border-zinc-800 flex items-center">
          <Link href="/markets" className="flex items-center">
            <Image 
              src="/levm-logo.png" 
              alt="LevM Logo" 
              width={120} 
              height={40}
              className="h-10 w-auto"
              priority
            />
          </Link>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path || pathname?.startsWith(item.path + "/")
            return (
              <Link
                key={item.id}
                href={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
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
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <div className="wallet-button-wrapper">
            <WalletMultiButton />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

