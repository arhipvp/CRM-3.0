import React, { useState } from 'react';

import { changePassword } from '../../api';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

export const SettingsView: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Заполните все поля для смены пароля.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Новый пароль и подтверждение не совпадают.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Пароль обновлен.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось обновить пароль.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Настройки</h2>
        <p className="text-sm text-slate-600 mt-2">
          Обновите пароль для доступа в систему. Используйте надежную комбинацию и не
          повторяйте старые пароли.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && <p className="app-alert app-alert-danger">{error}</p>}
        {success && <p className="app-alert app-alert-success">{success}</p>}

        <div className="space-y-2">
          <label htmlFor="current-password" className="app-label">
            Текущий пароль
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            disabled={loading}
            required
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="new-password" className="app-label">
            Новый пароль
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={loading}
            required
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="app-label">
            Подтвердите новый пароль
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={loading}
            required
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="flex items-center justify-end pt-2">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Сохраняем...' : 'Обновить пароль'}
          </button>
        </div>
      </form>
    </div>
  );
};
