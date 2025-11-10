import { useMemo, useState } from 'react'
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

  const content = useMemo(() => {
    switch (activeView) {
      case 'clients':
        return <ClientsPage />
      case 'deals':
        return <DealsPage />
      case 'tasks':
        return <TasksPage />
      case 'documents':
        return <DocumentsPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage />
    }
  }, [activeView])

  return (
    <Layout navItems={navItems} activeKey={activeView} onNavigate={setActiveView}>
      <div className="grid">
        <StatCard label="Активные клиенты" value="24" hint="+3 за неделю" />
        <StatCard label="Открытые сделки" value="12" hint="4 на финальном этапе" />
        <StatCard label="Просроченные задачи" value="2" hint="нужно завершить сегодня" />
      </div>
      <div className="view">{content}</div>
    </Layout>
  )
}

export default App
