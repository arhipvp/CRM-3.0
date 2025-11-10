import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Client, Deal } from '../types'

type PolicyRow = {
  id: string
  clientName: string
  dealTitle: string
  status: string
  comment?: string
  budget?: number
  createdAt?: string
}

export const PoliciesPage = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [clientData, dealsData] = await Promise.all([api.listClients(), api.listDeals()])
        if (!ignore) {
          setClients(clientData)
          setDeals(dealsData)
        }
      } catch (err) {
        console.error(err)
        if (!ignore) setError('Не удалось загрузить данные')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [])

  const policies: PolicyRow[] = useMemo(() => {
    return deals.map((deal) => {
      const client = clients.find((c) => c.id === deal.client) || null
      return {
        id: deal.id,
        clientName: client?.name ?? deal.client_name ?? 'Без клиента',
        dealTitle: deal.title,
        status: deal.status ?? 'open',
        comment: deal.stage_name || '',
        budget: deal.amount,
        createdAt: deal.created_at,
      }
    })
  }, [deals, clients])

  const filteredPolicies = useMemo(() => {
    if (!search.trim()) return policies
    const q = search.trim().toLowerCase()
    return policies.filter((policy) =>
      [policy.clientName, policy.dealTitle, policy.comment ?? ''].some((value) =>
        value.toLowerCase().includes(q),
      ),
    )
  }, [policies, search])

  return (
    <div className="policies-page">
      <div className="table-head">
        <h2>Полисы (на основе сделок)</h2>
        <input
          type="search"
          placeholder="Поиск по клиенту или сделке"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading && <p className="muted">Загрузка…</p>}
      {error && <p className="error">{error}</p>}

      <div className="table-wrapper">
        <table className="table-compact">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Сделка</th>
              <th>Комментарий</th>
              <th>Сумма</th>
              <th>Создан</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredPolicies.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Полисы не найдены.
                </td>
              </tr>
            )}
            {filteredPolicies.map((policy) => (
              <tr key={policy.id}>
                <td>{policy.clientName}</td>
                <td>{policy.dealTitle}</td>
                <td>{policy.comment || '—'}</td>
                <td>{policy.budget ? formatCurrency(policy.budget) : '—'}</td>
                <td>{policy.createdAt ? formatDate(policy.createdAt) : '—'}</td>
                <td>
                  <span className={`status-badge ${policy.status}`}>{statusLabel(policy.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(value)

const formatDate = (value: string) => {
  const date = new Date(value)
  return date.toLocaleDateString('ru-RU')
}

const statusLabel = (value: string) => {
  switch (value) {
    case 'won':
      return 'Выполнен'
    case 'lost':
      return 'Закрыт'
    case 'on_hold':
      return 'На паузе'
    default:
      return 'В работе'
  }
}
