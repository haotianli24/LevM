import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'

const WORMHOLE_BRIDGE_ADDRESS = 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth'

export interface BridgeTransaction {
  fromAddress: string
  toAddress: string
  amount: number
  fromChain: 'Solana' | 'Polygon'
  toChain: 'Solana' | 'Polygon'
}

export async function initiateSolanaBridge(
  connection: Connection,
  wallet: any,
  config: BridgeTransaction
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected')
  }

  const { amount, toAddress } = config
  const lamports = Math.floor(amount * LAMPORTS_PER_SOL)

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: new PublicKey(WORMHOLE_BRIDGE_ADDRESS),
      lamports,
    })
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = wallet.publicKey

  const signed = await wallet.signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize())

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  })

  return signature
}

export async function getBridgeQuote(amount: number): Promise<any> {
  const response = await fetch(`/api/bridge/quote?amount=${amount}`)
  if (!response.ok) {
    throw new Error('Failed to get bridge quote')
  }
  return response.json()
}

export async function submitBridgeTransaction(
  solAddress: string,
  polygonAddress: string,
  amount: number,
  transactionSignature?: string
): Promise<any> {
  const response = await fetch('/api/bridge/sol-to-polygon', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      solAddress,
      polygonAddress,
      amount,
      transactionSignature,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Bridge transaction failed')
  }

  return response.json()
}

export async function checkBridgeStatus(txId: string, sourceChain: 'Solana' | 'Polygon' = 'Solana'): Promise<any> {
  const response = await fetch(`/api/bridge/sol-to-polygon?txId=${txId}&sourceChain=${sourceChain}`)
  if (!response.ok) {
    throw new Error('Failed to check bridge status')
  }
  return response.json()
}
