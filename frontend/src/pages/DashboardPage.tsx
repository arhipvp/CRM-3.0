import { useEffect, useState } from 'react'
import { StatCard } from '../components/StatCard'
import { api } from '../lib/api'
import type { Task } from '../types'

type DashboardProps = {
  summary: {
    clients: number
    deals: number
    tasks: number
    documents: number
  }
}

export function DashboardPage({ summary }: DashboardProps) {
  const [activities, setActivities] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const tasks = await api.listTasks()
        if (!ignore) {
          setActivities(tasks.slice(0, 5))
        }
      } catch (err) {
        console.error(err)
        if (!ignore) {
          setError('Не удалось загрузить задачи')
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

  return (
    <div className="dashboard">
      <div className="grid">
        <StatCard label="Клиентов" value={summary.clients.toString()} hint="в системе" />
        <StatCard label="Сделок" value={summary.deals.toString()} hint="активных" />
        <StatCard label="Задач" value={summary.tasks.toString()} hint="в работе" />
        <StatCard label="Документов" value={summary.documents.toString()} hint="загружено" />
      </div>

      <section>
        <div className="table-head">
          <h2>Ближайшие задачи</h2>
        </div>
        {loading && <p className="muted">Загрузка…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && activities.length === 0 && <p className="muted">Пока нет задач.</p>}

        <ul className="timeline">
          {activities.map((activity) => (
            <li key={activity.id}>
              <span>{formatTime(activity.due_at)}</span>
              <p>
                {activity.title}
                {activity.client_name && (
                  <>
                    <br />
                    <small className="muted">Клиент: {activity.client_name}</small>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
