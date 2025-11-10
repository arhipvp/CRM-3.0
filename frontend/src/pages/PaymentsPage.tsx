import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Payment } from '../types'

const STATUS_LABELS: Record<Payment['status'], string> = {
  planned: 'Запланирован',
  partial: 'Частично',
  paid: 'Оплачен',
}

const STATUS_COLORS: Record<Payment['status'], string> = {
  planned: 'status-badge info',
  partial: 'status-badge warning',
  paid: 'status-badge success',
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(value)

export const PaymentsPage = () => {
  const [payments, setPayments] = useState<Payment[]>([])
  const [filter, setFilter] = useState<'all' | Payment['status']>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.listPayments()
        if (!ignore) {
          setPayments(data)
        }
      } catch (err) {
        console.error(err)
        if (!ignore) setError('Не удалось загрузить платежи')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [])

  const filteredPayments = useMemo(() => {
    if (filter === 'all') return payments
    return payments.filter((payment) => payment.status === filter)
  }, [payments, filter])

  const totals = useMemo(() => {
    const planned = payments.filter((p) => p.status === 'planned').reduce((acc, p) => acc + (p.amount ?? 0), 0)
    const partial = payments.filter((p) => p.status === 'partial').reduce((acc, p) => acc + (p.amount ?? 0), 0)
    const paid = payments.filter((p) => p.status === 'paid').reduce((acc, p) => acc + (p.amount ?? 0), 0)
    return { planned, partial, paid }
  }, [payments])

  return (
    <div className="payments-page">
      <div className="card-grid">
        <div className="card">
          <p className="card-label">Запланировано</p>
          <p className="card-value">{formatCurrency(totals.planned)}</p>
        </div>
        <div className="card">
          <p className="card-label">Оплачено частично</p>
          <p className="card-value">{formatCurrency(totals.partial)}</p>
        </div>
        <div className="card">
          <p className="card-label">Получено</p>
          <p className="card-value">{formatCurrency(totals.paid)}</p>
        </div>
      </div>

      <div className="table-head">
        <h2>Платежи</h2>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">Все</option>
          <option value="planned">Запланированные</option>
          <option value="partial">Частичные</option>
          <option value="paid">Оплаченные</option>
        </select>
      </div>

      {loading && <p className="muted">Загрузка…</p>}
      {error && <p className="error">{error}</p>}

      <div className="table-wrapper">
        <table className="table-compact">
          <thead>
            <tr>
              <th>Сделка</th>
              <th>Сумма</th>
              <th>Запланировано</th>
              <th>Фактическая дата</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredPayments.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Платежей в этом статусе нет.
                </td>
              </tr>
            )}
            {filteredPayments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.deal_title ?? payment.description ?? 'Без описания'}</td>
                <td>{formatCurrency(payment.amount ?? 0)}</td>
                <td>{payment.scheduled_date ?? '—'}</td>
                <td>{payment.actual_date ?? '—'}</td>
                <td>
                  <span className={STATUS_COLORS[payment.status]}>{STATUS_LABELS[payment.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
