import { useEffect, useState } from 'react'
import { Activity, ArrowDownToLine, BarChart3, CheckCircle2, CircleDollarSign, CreditCard, Database, LayoutDashboard, LogOut, Moon, Plus, Search, SlidersHorizontal, Sparkles, Sun, Tag, WalletCards } from 'lucide-react'
import { api, apiBaseUrl } from './api'
import { StatCard } from './components/StatCard'
import { TransactionForm } from './components/TransactionForm'
import { TransactionTable } from './components/TransactionTable'
import type { Transaction, TransactionInput, TransactionPatch } from './types'

const API_KEY_STORAGE = 'ledger-api-key'
const THEME_STORAGE = 'ledger-theme'
const categories = ['Todas las categorías', 'Alimentación', 'Transporte', 'Hogar', 'Salud', 'Ocio', 'Suscripciones', 'Otros']
const formatTotal = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount)
const categoryClassName = (category: string) => ({ Alimentación: 'food', Transporte: 'transport', Hogar: 'home', Salud: 'health', Ocio: 'leisure', Suscripciones: 'subscriptions', Otros: 'other' }[category] ?? 'other')

export function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? import.meta.env.VITE_API_KEY ?? '')
  const [keyDraft, setKeyDraft] = useState(apiKey)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(Boolean(apiKey))
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState(categories[0])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [activeSection, setActiveSection] = useState('Resumen')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(THEME_STORAGE) === 'dark')

  const loadTransactions = async (key = apiKey) => {
    if (!key) return
    setLoading(true)
    setError('')
    try {
      setTransactions(await api.listTransactions(key))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las transacciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (apiKey) void loadTransactions() }, [apiKey])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE, darkMode ? 'dark' : 'light')
  }, [darkMode])

  const connect = (event: React.FormEvent) => {
    event.preventDefault()
    const value = keyDraft.trim()
    localStorage.setItem(API_KEY_STORAGE, value)
    setApiKey(value)
  }

  const openNew = () => { setEditing(null); setDrawerOpen(true) }
  const openEdit = (transaction: Transaction) => { setEditing(transaction); setDrawerOpen(true) }

  const updateTransactionField = async (transaction: Transaction, field: 'category' | 'status', value: string) => {
    setError('')
    try {
      const updated = await api.updateTransaction(apiKey, transaction.id, { [field]: value })
      setTransactions((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar la transacción')
    }
  }

  const saveTransaction = async (input: TransactionInput) => {
    setError('')
    try {
      if (editing) {
        const patch: TransactionPatch = { merchant: input.merchant, description: input.description, occurred_at: input.occurred_at, card_last4: input.card_last4, category: input.category, status: input.status }
        const updated = await api.updateTransaction(apiKey, editing.id, patch)
        setTransactions((current) => current.map((item) => item.id === updated.id ? updated : item))
      } else {
        const created = await api.createTransaction(apiKey, input)
        setTransactions((current) => [created, ...current])
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo guardar la transacción'
      setError(message)
      throw requestError
    }
  }

  const removeTransaction = async (transaction: Transaction) => {
    if (!window.confirm(`¿Eliminar la transacción de ${transaction.merchant || 'este comercio'}?`)) return
    try {
      await api.deleteTransaction(apiKey, transaction.id)
      setTransactions((current) => current.filter((item) => item.id !== transaction.id))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar la transacción')
    }
  }

  const exportTransactions = async () => {
    try {
      const blob = await api.exportTransactions(apiKey)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'transactions.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo exportar el CSV')
    }
  }

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch = `${transaction.merchant ?? ''} ${transaction.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter
    const matchesCategory = categoryFilter === categories[0] || transaction.category === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })
  const totalSpent = transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
  const pendingCount = transactions.filter((transaction) => transaction.status === 'pending_review').length
  const categoryCount = new Set(transactions.map((transaction) => transaction.category).filter(Boolean)).size
  const categoryTotals = transactions.reduce<Record<string, number>>((totals, transaction) => {
    const category = transaction.category || 'Otros'
    totals[category] = (totals[category] ?? 0) + transaction.amount
    return totals
  }, {})
  const topCategories = Object.entries(categoryTotals).sort(([, first], [, second]) => second - first)
  const maxCategoryTotal = topCategories[0]?.[1] ?? 1
  const monthlyTotal = transactions.filter((transaction) => transaction.occurred_at?.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum, transaction) => sum + transaction.amount, 0)
  const transactionWorkspace = <section className="transactions-section"><div className="section-heading"><div><div className="section-title-row"><h2>{activeSection === 'Resumen' ? 'Últimas transacciones' : 'Todas las transacciones'}</h2><span className="count-badge">{filteredTransactions.length}</span></div><p>Una vista de todos tus movimientos registrados.</p></div><button className="text-button" onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter(categories[0]) }}>Limpiar filtros</button></div><div className="toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar comercio o nota..." /></label><div className="toolbar-select"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos los estados</option><option value="pending_review">Por revisar</option><option value="approved">Aprobadas</option><option value="rejected">Rechazadas</option></select><SlidersHorizontal size={15} /></div><div className="toolbar-select category-select"><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></div></div>{loading ? <div className="loading-state"><span className="spinner" />Cargando movimientos...</div> : <TransactionTable transactions={filteredTransactions} onEdit={openEdit} onDelete={removeTransaction} onUpdateField={updateTransactionField} />}</section>

  if (!apiKey) return <ConnectScreen keyDraft={keyDraft} setKeyDraft={setKeyDraft} onSubmit={connect} />

  return <div className={`app-shell ${darkMode ? 'dark-mode' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><WalletCards size={20} /></div><div><strong>ledger</strong><span>personal finance</span></div></div>
      <nav className="main-nav" aria-label="Navegación principal"><span className="nav-label">Workspace</span>{[['Resumen', LayoutDashboard], ['Transacciones', CreditCard], ['Categorías', Tag], ['Análisis', BarChart3]].map(([label, Icon]) => <button key={label as string} className={activeSection === label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection(label as string)}><Icon size={18} /><span>{label as string}</span>{label === 'Transacciones' && <b>{transactions.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}<span>{darkMode ? 'Modo claro' : 'Modo oscuro'}</span></button><div className="api-connection"><span className="connection-dot" /><div><small>API conectada</small><span>{apiBaseUrl.replace('http://', '')}</span></div><Activity size={15} /></div><button className="signout" onClick={() => { localStorage.removeItem(API_KEY_STORAGE); setApiKey('') }}><LogOut size={15} />Cerrar conexión</button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><div className="brand-mark"><WalletCards size={18} /></div><strong>ledger</strong></div><div className="topbar-date">{new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</div><div className="topbar-actions"><span className="live-indicator"><span />Sincronizado</span><button className="icon-button" aria-label="Cambiar tema" title={darkMode ? 'Usar modo claro' : 'Usar modo oscuro'} onClick={() => setDarkMode((current) => !current)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button><button className="icon-button" aria-label="Descargar exportación" title="Descargar CSV" onClick={() => void exportTransactions()}><ArrowDownToLine size={17} /></button><button className="avatar-button">L</button></div></header>
      <div className="content-wrap">
        <section className="page-heading"><div><span className="eyebrow">{activeSection === 'Resumen' ? new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()) : 'Tu dinero, en foco'}</span><h1>{activeSection === 'Resumen' ? 'Buenos días.' : activeSection}</h1><p>{activeSection === 'Resumen' ? 'Aquí tienes una lectura clara de tus gastos recientes.' : 'Organiza y revisa cada movimiento de tu espacio personal.'}</p></div><button className="button button-primary add-button" onClick={openNew}><Plus size={18} />Nueva transacción</button></section>
        {error && <div className="alert"><span>{error}</span><button onClick={() => setError('')}>Cerrar</button></div>}
        {activeSection === 'Resumen' && <><section className="stats-grid"><StatCard label="Gasto acumulado" value={formatTotal(totalSpent)} note="Desde el inicio" icon={CircleDollarSign} tone="mint" /><StatCard label="Por revisar" value={String(pendingCount).padStart(2, '0')} note="Requieren atención" icon={CheckCircle2} tone="coral" /><StatCard label="Categorías activas" value={String(categoryCount).padStart(2, '0')} note="En tus movimientos" icon={Tag} tone="blue" /><StatCard label="Movimientos" value={String(transactions.length).padStart(2, '0')} note="Total registrados" icon={Database} tone="yellow" /></section>{transactionWorkspace}</>}
        {activeSection === 'Transacciones' && transactionWorkspace}
        {activeSection === 'Categorías' && <section className="insight-grid"><article className="insight-card"><div className="section-title-row"><h2>Gasto por categoría</h2><span className="count-badge">{categoryCount}</span></div><p className="insight-intro">Cómo se distribuye tu gasto acumulado.</p><div className="category-list">{topCategories.length ? topCategories.map(([category, total]) => <div className="category-row" key={category}><div className="category-row-label"><span className={`category-dot category-dot-${categoryClassName(category)}`} /><strong>{category}</strong><span>{formatTotal(total)}</span></div><div className="category-bar"><i style={{ width: `${(total / maxCategoryTotal) * 100}%` }} /></div></div>) : <div className="empty-state"><h3>Aún no hay categorías</h3><p>Registra una transacción para empezar.</p></div>}</div></article><article className="insight-card accent-card"><Tag size={22} /><span className="eyebrow">Tu panorama</span><strong>{formatTotal(totalSpent)}</strong><p>distribuidos en {categoryCount || 0} categorías activas.</p><button className="button button-primary" onClick={openNew}><Plus size={17} />Agregar gasto</button></article></section>}
        {activeSection === 'Análisis' && <section className="insight-grid"><article className="insight-card"><div className="section-title-row"><h2>Ritmo de gasto</h2><span className="count-badge">Este mes</span></div><p className="insight-intro">Lectura rápida de tu actividad actual.</p><div className="analysis-total"><strong>{formatTotal(monthlyTotal)}</strong><span>registrado este mes</span></div><div className="analysis-bars">{topCategories.slice(0, 5).map(([category, total], index) => <div className="analysis-bar-row" key={category}><span>{category}</span><div><i style={{ height: `${Math.max(14, (total / maxCategoryTotal) * 100)}%`, animationDelay: `${index * 70}ms` }} /></div><strong>{formatTotal(total)}</strong></div>)}</div></article><article className="insight-card"><div className="section-title-row"><h2>Estado del registro</h2><Activity size={18} /></div><p className="insight-intro">Qué requiere tu atención.</p><div className="analysis-status"><div><strong>{pendingCount}</strong><span>Por revisar</span></div><div><strong>{transactions.length - pendingCount}</strong><span>Resueltas</span></div></div><button className="button button-primary" onClick={() => { setActiveSection('Transacciones'); setStatusFilter('pending_review') }}>Ver pendientes</button></article></section>}
      </div>
    </main>
    {drawerOpen && <TransactionForm transaction={editing} onClose={() => setDrawerOpen(false)} onSubmit={saveTransaction} />}
  </div>
}

function ConnectScreen({ keyDraft, setKeyDraft, onSubmit }: { keyDraft: string; setKeyDraft: (value: string) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <main className="connect-screen"><div className="connect-orbit orbit-one" /><div className="connect-orbit orbit-two" /><div className="connect-card"><div className="brand connect-brand"><div className="brand-mark"><WalletCards size={20} /></div><div><strong>ledger</strong><span>personal finance</span></div></div><span className="eyebrow">Private workspace</span><h1>Tu dinero, con más claridad.</h1><p>Conecta tu API personal para ver y organizar tus movimientos en un solo lugar.</p><form onSubmit={onSubmit}><label className="field">API key<input autoFocus type="password" value={keyDraft} onChange={(event) => setKeyDraft(event.target.value)} placeholder="mi-clave-local" /></label><button className="button button-primary connect-button" type="submit">Entrar al dashboard <Sparkles size={17} /></button></form><small className="connect-note">La clave se guarda únicamente en este navegador.</small></div></main>
}
