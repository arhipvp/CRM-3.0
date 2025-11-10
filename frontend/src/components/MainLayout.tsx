import type { ReactNode } from 'react'
import './MainLayout.css'

export type View =
  | 'deals'
  | 'clients'
  | 'policies'
  | 'payments'
  | 'finance'
  | 'tasks'
  | 'documents'
  | 'settings'
  | 'dashboard'

type NavItem = {
  key: View
  label: string
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Дашборд' },
  { key: 'deals', label: 'Сделки' },
  { key: 'clients', label: 'Клиенты' },
  { key: 'policies', label: 'Полисы' },
  { key: 'payments', label: 'Платежи' },
  { key: 'finance', label: 'Финансы' },
  { key: 'tasks', label: 'Задачи' },
  { key: 'documents', label: 'Документы' },
  { key: 'settings', label: 'Настройки' },
]

type MainLayoutProps = {
  activeView: View
  onNavigate: (view: View) => void
  children: ReactNode
}

export const MainLayout = ({ activeView, onNavigate, children }: MainLayoutProps) => {
  return (
    <div className="main-layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div>
            <span className="brand__title">CRM 3.0</span>
            <small className="brand__subtitle">single-tenant</small>
          </div>
        </div>
        <nav>
          <ul>
            {navItems.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={activeView === item.key ? 'active' : ''}
                  onClick={() => onNavigate(item.key)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="main-content">
        <header className="main-header">
          <div className="main-header__left">
            <div className="toggle">
              <span className="dot online" />
              <span>Сессия активна</span>
            </div>
          </div>
        </header>
        <section className="main-body">{children}</section>
      </div>
    </div>
  )
}
