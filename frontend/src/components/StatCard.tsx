import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  note: string
  icon: LucideIcon
  tone: 'mint' | 'coral' | 'blue' | 'yellow'
}

export function StatCard({ label, value, note, icon: Icon, tone }: StatCardProps) {
  return <article className={`stat-card stat-${tone}`}><div className="stat-icon"><Icon size={18} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>
}
