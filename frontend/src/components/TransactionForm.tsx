import { useEffect, useState } from 'react'
import { CalendarDays, Check, ChevronDown, X } from 'lucide-react'
import type { Transaction, TransactionInput } from '../types'

interface TransactionFormProps {
  transaction: Transaction | null
  onClose: () => void
  onSubmit: (input: TransactionInput) => Promise<void>
}

const initialForm: TransactionInput = {
  source: 'manual',
  amount: 0,
  currency: 'CLP',
  merchant: '',
  description: '',
  occurred_at: new Date().toISOString().slice(0, 10),
  card_last4: '',
  category: 'Otros',
  status: 'pending_review',
}

const categories = ['Alimentación', 'Transporte', 'Hogar', 'Salud', 'Ocio', 'Suscripciones', 'Otros']

export function TransactionForm({ transaction, onClose, onSubmit }: TransactionFormProps) {
  const [form, setForm] = useState<TransactionInput>(initialForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!transaction) {
      setForm(initialForm)
      return
    }
    setForm({
      source: transaction.source,
      amount: transaction.amount,
      currency: transaction.currency,
      merchant: transaction.merchant ?? '',
      description: transaction.description ?? '',
      occurred_at: transaction.occurred_at ?? '',
      card_last4: transaction.card_last4 ?? '',
      category: transaction.category ?? 'Otros',
      status: transaction.status,
    })
  }, [transaction])

  const setField = <K extends keyof TransactionInput>(field: K, value: TransactionInput[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ ...form, amount: Number(form.amount) })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="transaction-drawer" aria-labelledby="transaction-form-title">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">{transaction ? 'Edit transaction' : 'New transaction'}</span>
            <h2 id="transaction-form-title">{transaction ? 'Ajusta los detalles' : 'Registra un gasto'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar formulario"><X size={19} /></button>
        </div>
        <form className="transaction-form" onSubmit={submit}>
          <label className="field field-wide">Comercio<input required value={form.merchant ?? ''} onChange={(event) => setField('merchant', event.target.value)} placeholder="Ej. Jumbo Oneclick" /></label>
          <div className="form-grid">
            <label className="field">Monto<div className="input-with-prefix"><span>$</span><input required min="1" type="number" value={form.amount || ''} onChange={(event) => setField('amount', Number(event.target.value))} placeholder="0" /></div></label>
            <label className="field">Moneda<input maxLength={3} value={form.currency} onChange={(event) => setField('currency', event.target.value.toUpperCase())} /></label>
          </div>
          <div className="form-grid">
            <label className="field">Fecha<div className="input-with-icon"><input required type="date" value={form.occurred_at ?? ''} onChange={(event) => setField('occurred_at', event.target.value)} /><CalendarDays size={16} /></div></label>
            <label className="field">Categoría<div className="select-wrap"><select value={form.category ?? ''} onChange={(event) => setField('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={16} /></div></label>
          </div>
          <label className="field field-wide">Descripción<textarea rows={3} value={form.description ?? ''} onChange={(event) => setField('description', event.target.value)} placeholder="Añade una nota para tu futuro yo" /></label>
          <div className="form-grid">
            <label className="field">Últimos 4 dígitos<input maxLength={4} inputMode="numeric" value={form.card_last4 ?? ''} onChange={(event) => setField('card_last4', event.target.value.replace(/\D/g, ''))} placeholder="0000" /></label>
            <label className="field">Estado<div className="select-wrap"><select value={form.status} onChange={(event) => setField('status', event.target.value)}><option value="pending_review">Por revisar</option><option value="approved">Aprobada</option><option value="rejected">Rechazada</option></select><ChevronDown size={16} /></div></label>
          </div>
          <div className="drawer-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : <><Check size={17} />Guardar transacción</>}</button></div>
        </form>
      </aside>
    </div>
  )
}
