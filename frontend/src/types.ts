export type TransactionStatus = 'pending_review' | 'approved' | 'rejected' | string

export interface Transaction {
  id: number
  notification_id: number
  source: string
  amount: number
  currency: string
  merchant: string | null
  description: string | null
  occurred_at: string | null
  card_last4: string | null
  category: string | null
  status: TransactionStatus
  created_at: string
  updated_at: string
}

export interface TransactionInput {
  source: string
  amount: number
  currency: string
  merchant: string | null
  description: string | null
  occurred_at: string | null
  card_last4: string | null
  category: string | null
  status: string
}

export type TransactionPatch = Partial<Omit<TransactionInput, 'source' | 'amount' | 'currency'>>
