import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Document } from '../types'

export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.listDocuments()
        if (!ignore) {
          setDocuments(data)
        }
      } catch (err) {
        console.error(err)
        if (!ignore) {
          setError('Не удалось загрузить документы')
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
    <div className="table-wrapper">
      <div className="table-head">
        <h2>Документы</h2>
      </div>
      {loading && <p className="muted">Загрузка…</p>}
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Тип</th>
            <th>Сделка</th>
            <th>Обновлено</th>
          </tr>
        </thead>
        <tbody>
          {!loading && documents.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Документы пока не добавлены.
              </td>
            </tr>
          )}
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.title}</td>
              <td>{doc.doc_type || '—'}</td>
              <td>{doc.deal_title ?? '—'}</td>
              <td>{formatDate(doc.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
  })
}
