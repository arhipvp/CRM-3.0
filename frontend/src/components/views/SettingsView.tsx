import React from "react";

export const SettingsView: React.FC = () => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6">
    <h2 className="text-xl font-semibold text-slate-900">Настройки</h2>
    <p className="text-sm text-slate-600 mt-2">
      Здесь можно будет управлять уведомлениями, интеграциями и доступами. Пока раздел работает в режиме read-only.
    </p>
  </div>
);
