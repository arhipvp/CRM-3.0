import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Deal } from '../types'

export function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.listDeals()
        if (!ignore) {
          setDeals(data)
        }
      } catch (err) {
        console.error(err)
        if (!ignore) {
          setError('Не удалось загрузить сделки')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [])

  const columns = useMemo(() => {
    const grouped = new Map<string, Deal[]>()
    deals.forEach((deal) => {
      const stage = deal.stage_name || 'Без этапа'
      grouped.set(stage, [...(grouped.get(stage) ?? []), deal])
    })

    return Array.from(grouped.entries()).map(([stage, stageDeals]) => ({
      stage,
      deals: stageDeals,
    }))
  }, [deals])

  return (
    <div>
      {loading && <p className="muted">Загрузка…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && deals.length === 0 && <p className="muted">Сделок пока нет.</p>}

      <div className="kanban">
        {columns.map((column) => (
          <div key={column.stage} className="kanban-column">
            <header>
              <h3>{column.stage}</h3>
              <span>{column.deals.length}</span>
            </header>
            <ul>
              {column.deals.map((deal) => (
                <li key={deal.id}>
                  <strong>{deal.title}</strong>
                  <div className="muted">{deal.client_name ?? deal.client ?? 'Без клиента'}</div>
                  <small className="muted">{deal.amount ? `${deal.amount} ₽` : ''}</small>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
