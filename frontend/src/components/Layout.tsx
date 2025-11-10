import type { ReactNode } from 'react'
import './Layout.css'

type NavItem = {
  key: string
  label: string
  description?: string
}

type LayoutProps = {
  navItems: NavItem[]
  activeKey: string
  onNavigate: (key: string) => void
  children: ReactNode
}

export function Layout({ navItems, activeKey, onNavigate, children }: LayoutProps) {
  return (
    <div className="layout">
      <aside>
        <div className="brand">
          <span>CRM 3.0</span>
          <small>Single-tenant</small>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={item.key === activeKey ? 'active' : ''}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <span>{item.label}</span>
              {item.description && <small>{item.description}</small>}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        <header>
          <h1>{navItems.find((nav) => nav.key === activeKey)?.label}</h1>
          <p>Базовый каркас React SPA для CRM 3.0.</p>
        </header>
        <section className="content">{children}</section>
      </main>
    </div>
  )
}
