import React from "react";
import { User } from "../types";

export type View = "deals" | "clients" | "policies" | "payments" | "finance" | "tasks" | "settings";

interface MainLayoutProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onAddDeal: () => void;
  onAddClient: () => void;
  currentUser?: User;
  onLogout?: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ view: View; label: string; icon: string }> = [
  { view: "deals", label: "Сделки", icon: "📋" },
  { view: "clients", label: "Клиенты", icon: "👥" },
  { view: "policies", label: "Полисы", icon: "📄" },
  { view: "payments", label: "Платежи", icon: "💳" },
  { view: "finance", label: "Финансы", icon: "📊" },
  { view: "tasks", label: "Задачи", icon: "✅" },
  { view: "settings", label: "Настройки", icon: "⚙️" },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ activeView, onNavigate, onAddDeal, onAddClient, currentUser, onLogout, children }) => {
  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-400">CRM 3.0</p>
          <h1 className="text-2xl font-bold text-sky-600">Insure Desk</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.view}>
                <button
                  onClick={() => onNavigate(item.view)}
                  className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === item.view
                      ? "bg-sky-100 text-sky-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-slate-200 space-y-3">
          <button onClick={onAddDeal} className="w-full bg-sky-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-sky-700">
            + Новая сделка
          </button>
          <button onClick={onAddClient} className="w-full border border-slate-300 text-slate-700 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
            + Новый клиент
          </button>
          {currentUser && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="text-xs">
                <p className="font-semibold text-slate-700">{currentUser.username}</p>
                <p className="text-slate-500">
                  {currentUser.roles && currentUser.roles.length > 0
                    ? currentUser.roles.join(", ")
                    : "Нет ролей"
                  }
                </p>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full bg-red-50 text-red-600 rounded-lg py-2 text-sm font-semibold hover:bg-red-100"
                >
                  Выход
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 min-h-screen">
        {children}
      </main>
    </div>
  );
};
