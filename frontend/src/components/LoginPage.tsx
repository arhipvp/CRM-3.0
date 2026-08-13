import { useState, type FormEvent } from 'react';

import { login } from '../api';
import { Button } from './common/Button';
import { FORM_INPUT_DISABLED } from './common/forms/formClassNames';
import { FormField } from './common/forms/FormField';
import { InlineAlert } from './common/InlineAlert';
import { formatErrorMessage } from '../utils/formatErrorMessage';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-10">
      <div className="app-panel w-full max-w-sm border-t-4 border-t-[var(--app-primary)] p-6">
        <div className="space-y-1 text-center">
          <p className="app-label text-[var(--app-primary)]">CRM 3.0</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Insure Desk</h1>
          <p className="text-sm text-slate-500">Рабочее пространство страхового брокера</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField label="Имя пользователя" htmlFor="username">
            <input
              id="username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className={FORM_INPUT_DISABLED}
            />
          </FormField>

          <FormField label="Пароль" htmlFor="password">
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className={FORM_INPUT_DISABLED}
            />
          </FormField>

          {error && <InlineAlert as="p">{error}</InlineAlert>}

          <Button
            type="submit"
            variant="primary"
            size="block"
            isLoading={isLoading}
            loadingLabel="Входим…"
          >
            Войти
          </Button>
        </form>
      </div>
    </div>
  );
}
