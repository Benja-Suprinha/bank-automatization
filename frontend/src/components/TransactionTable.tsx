import { Edit3, MoreHorizontal, Trash2 } from 'lucide-react'
import type { Transaction } from '../types'

interface TransactionTableProps {
  transactions: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  onUpdateField: (transaction: Transaction, field: 'category' | 'status', value: string) => Promise<void>
}

const categoryClass: Record<string, string> = { Alimentación: 'category-food', Transporte: 'category-transport', Hogar: 'category-home', Salud: 'category-health', Ocio: 'category-leisure', Suscripciones: 'category-subscriptions', Otros: 'category-other' }

const formatAmount = (transaction: Transaction) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: transaction.currency, maximumFractionDigits: 0 }).format(transaction.amount)
const formatDate = (date: string | null) => date ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`)).replace('.', '') : 'Sin fecha'
const labelStatus = (status: string) => ({ pending_review: 'Por revisar', approved: 'Aprobada', rejected: 'Rechazada' }[status] ?? status)

const categoryOptions = ['Alimentación', 'Transporte', 'Hogar', 'Salud', 'Ocio', 'Suscripciones', 'Otros']

export function TransactionTable({ transactions, onEdit, onDelete, onUpdateField }: TransactionTableProps) {
  if (!transactions.length) return <div className="empty-state"><div className="empty-mark">—</div><h3>No hay transacciones con estos filtros</h3><p>Prueba otra búsqueda o registra un nuevo gasto.</p></div>
  return <div className="table-scroll"><table><thead><tr><th>Comercio</th><th>Fecha</th><th>Categoría</th><th>Estado</th><th className="align-right">Importe</th><th aria-label="Acciones" /></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td><div className="merchant-cell"><span className="merchant-avatar">{(transaction.merchant ?? '?').slice(0, 1).toUpperCase()}</span><div><strong>{transaction.merchant || 'Sin comercio'}</strong><small>{transaction.description || `Transacción #${transaction.id}`}</small></div></div></td><td><span className="date-cell">{formatDate(transaction.occurred_at)}</span></td><td><select className={`inline-select category-pill ${categoryClass[transaction.category ?? 'Otros'] ?? 'category-other'}`} aria-label={`Categoría de ${transaction.merchant ?? 'transacción'}`} value={transaction.category || 'Otros'} onChange={(event) => void onUpdateField(transaction, 'category', event.target.value)}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></td><td><select className={`inline-select status-pill status-${transaction.status}`} aria-label={`Estado de ${transaction.merchant ?? 'transacción'}`} value={transaction.status} onChange={(event) => void onUpdateField(transaction, 'status', event.target.value)}><option value="pending_review">Por revisar</option><option value="approved">Aprobada</option><option value="rejected">Rechazada</option></select></td><td className="align-right"><strong className="amount-cell">{formatAmount(transaction)}</strong></td><td><div className="row-actions"><button className="table-action" onClick={() => onEdit(transaction)} aria-label={`Editar ${transaction.merchant ?? 'transacción'}`}><Edit3 size={15} /></button><button className="table-action danger" onClick={() => onDelete(transaction)} aria-label={`Eliminar ${transaction.merchant ?? 'transacción'}`}><Trash2 size={15} /></button><button className="table-action more" aria-label="Más acciones"><MoreHorizontal size={16} /></button></div></td></tr>)}</tbody></table></div>
}
