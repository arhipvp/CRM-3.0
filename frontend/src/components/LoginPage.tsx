import React, { useState } from 'react';

import { login } from '../api';
import { BTN_PRIMARY } from './common/buttonStyles';
import { FORM_INPUT_DISABLED } from './common/forms/formClassNames';
import { InlineAlert } from './common/InlineAlert';
import { formatErrorMessage } from '../utils/formatErrorMessage';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(username, password);
      onLoginSuccess();
    } catch (err) {
      setError(formatErrorMessage(err, 'Ошибка входа'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-4 py-10">
      <div className="app-panel w-full max-w-md p-8 shadow-lg">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-slate-900">CRM 3.0</h1>
          <p className="text-sm text-slate-600">Управление сделками и клиентами</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="app-label">
              Имя пользователя
            </label>
            <input
              id="username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className={FORM_INPUT_DISABLED}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="app-label">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className={FORM_INPUT_DISABLED}
            />
          </div>

          {error && <InlineAlert as="p">{error}</InlineAlert>}

          <button
            type="submit"
            disabled={isLoading}
            className={`${BTN_PRIMARY} w-full justify-center`}
          >
            {isLoading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};
