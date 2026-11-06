import type { Transaction, TransactionInput, TransactionPatch } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://gastos.supralinks.cl'

async function request<T>(path: string, apiKey: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload?.detail ?? `Request failed (${response.status})`
    throw new Error(typeof message === 'string' ? message : 'No se pudo completar la operación')
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  listTransactions: (apiKey: string) => request<Transaction[]>('/api/v1/transactions', apiKey),
  createTransaction: (apiKey: string, input: TransactionInput) => request<Transaction>('/api/v1/transactions', apiKey, { method: 'POST', body: JSON.stringify(input) }),
  updateTransaction: (apiKey: string, id: number, patch: TransactionPatch) => request<Transaction>(`/api/v1/transactions/${id}`, apiKey, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTransaction: (apiKey: string, id: number) => request<void>(`/api/v1/transactions/${id}`, apiKey, { method: 'DELETE' }),
  exportTransactions: async (apiKey: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/transactions/export.csv`, { headers: { 'X-API-Key': apiKey } })
    if (!response.ok) throw new Error('No se pudo exportar el CSV')
    return response.blob()
  },
}

export const apiBaseUrl = API_BASE_URL
