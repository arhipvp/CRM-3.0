import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import './components/MainLayout.css'
import { MainLayout, type View } from './components/MainLayout'
import { AddDealModal } from './components/modals/AddDealModal'
import { StatCard } from './components/StatCard'
import { ClientsPage } from './pages/ClientsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DealsPage } from './pages/DealsPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { FinancesPage } from './pages/FinancesPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { PoliciesPage } from './pages/PoliciesPage'
import { SettingsPage } from './pages/SettingsPage'
import { TasksPage } from './pages/TasksPage'
import { api } from './lib/api'
import type { Client } from './types'

type SummaryStats = {
  clients: number
  deals: number
  tasks: number
  documents: number
}

function App() {
  const [view, setView] = useState<View>('deals')
  const [showDealModal, setShowDealModal] = useState(false)
  const [summary, setSummary] = useState<SummaryStats>({
    clients: 0,
    deals: 0,
    tasks: 0,
    documents: 0,
  })
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const [clientsData, dealsData, tasksData, documentsData] = await Promise.all([
        api.listClients(),
        api.listDeals(),
        api.listTasks(),
        api.listDocuments(),
      ])
      setClients(clientsData)
      setSummary({
        clients: clientsData.length,
        deals: dealsData.length,
        tasks: tasksData.length,
        documents: documentsData.length,
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
    switch (view) {
      case 'dashboard':
        return <DashboardPage summary={summary} />
      case 'clients':
        return <ClientsPage onDataChange={loadSummary} />
      case 'deals':
        return <DealsPage onAddDeal={() => setShowDealModal(true)} />
      case 'tasks':
        return <TasksPage />
      case 'documents':
        return <DocumentsPage />
      case 'payments':
        return <PaymentsPage />
      case 'finance':
        return <FinancesPage />
      case 'policies':
        return <PoliciesPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <div className="muted">Раздел появится позже.</div>
    }
  }, [view, loadSummary, summary])

  return (
    <>
      <MainLayout activeView={view} onNavigate={setView}>
        {view === 'dashboard' && (
          <>
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
          </>
        )}
        {view !== 'dashboard' && summaryError && <div className="error">{summaryError}</div>}
        <div className="view">{content}</div>
      </MainLayout>

      {showDealModal && (
        <AddDealModal
          clients={clients}
          onClose={() => setShowDealModal(false)}
          onCreated={() => loadSummary()}
        />
      )}
    </>
  )
}

export default App
