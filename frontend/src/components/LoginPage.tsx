import React, { useState } from 'react';
import { login } from '../api';
import './LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(username, password);
      // Tokens are already set by the login() function
      // No need to call setAccessToken/setRefreshToken again
      console.log('Login successful, calling onLoginSuccess');
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>CRM 3.0</h1>
        <p>Управление сделками и клиентами</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Имя пользователя</label>
            <input
              id="username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={isLoading} className="login-button">
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <p className="help-text">
          Для тестирования используйте:
          <br />
          Администратор: admin / admin123
          <br />
          Менеджер: manager / manager123
        </p>
      </div>
    </div>
  );
};
