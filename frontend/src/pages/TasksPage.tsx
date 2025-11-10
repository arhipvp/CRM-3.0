import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Task } from '../types'

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.listTasks()
        if (!ignore) {
          setTasks(data)
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
    <div className="tasks">
      <div className="table-head">
        <h2>Задачи</h2>
      </div>
      {loading && <p className="muted">Загрузка…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && tasks.length === 0 ? (
        <p className="muted">Задач пока нет.</p>
      ) : (
        <ul className="tasks-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <small>{formatDate(task.due_at)}</small>
              </div>
              <span>{task.client_name ?? task.deal_title ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
