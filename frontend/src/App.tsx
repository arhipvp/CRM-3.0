import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import './components/Layout.css'
import { Layout } from './components/Layout'
import { StatCard } from './components/StatCard'
import { ClientsPage } from './pages/ClientsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DealsPage } from './pages/DealsPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TasksPage } from './pages/TasksPage'
import { api } from './lib/api'

type SummaryStats = {
  clients: number
  deals: number
  tasks: number
  documents: number
}

const navItems = [
  { key: 'dashboard', label: 'Дашборд', description: 'метрики и активности' },
  { key: 'clients', label: 'Клиенты', description: 'карточки и контакты' },
  { key: 'deals', label: 'Сделки', description: 'воронка + таблица' },
  { key: 'tasks', label: 'Задачи', description: 'личные и командные' },
  { key: 'documents', label: 'Документы', description: 'файлы и шаблоны' },
  { key: 'settings', label: 'Настройки', description: 'пользователи и справочники' },
]

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [summary, setSummary] = useState<SummaryStats>({
    clients: 0,
    deals: 0,
    tasks: 0,
    documents: 0,
  })
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const [clients, deals, tasks, documents] = await Promise.all([
        api.listClients(),
        api.listDeals(),
        api.listTasks(),
        api.listDocuments(),
      ])

      setSummary({
        clients: clients.length,
        deals: deals.length,
        tasks: tasks.length,
        documents: documents.length,
      })
    } catch (error) {
      console.error(error)
      setSummaryError('Не удалось загрузить сводку')
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const content = useMemo(() => {
    switch (activeView) {
      case 'clients':
        return <ClientsPage onDataChange={loadSummary} />
      case 'deals':
        return <DealsPage />
      case 'tasks':
        return <TasksPage />
      case 'documents':
        return <DocumentsPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage summary={summary} />
    }
  }, [activeView, loadSummary, summary])

  return (
    <Layout navItems={navItems} activeKey={activeView} onNavigate={setActiveView}>
      <div className="grid">
        <StatCard
          label="Клиенты"
          value={summaryLoading ? '…' : summary.clients.toString()}
          hint="в системе"
        />
        <StatCard
          label="Сделки"
          value={summaryLoading ? '…' : summary.deals.toString()}
          hint="на всех этапах"
        />
        <StatCard
          label="Задачи"
          value={summaryLoading ? '…' : summary.tasks.toString()}
          hint="в работе"
        />
        <StatCard
          label="Документы"
          value={summaryLoading ? '…' : summary.documents.toString()}
          hint="загружено"
        />
      </div>
      {summaryError && <div className="error">{summaryError}</div>}
      <div className="view">{content}</div>
    </Layout>
  )
}

export default App
