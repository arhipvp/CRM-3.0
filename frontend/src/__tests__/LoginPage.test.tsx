import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../components/LoginPage';
import { login, type LoginResponse } from '../api';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    login: vi.fn(),
  };
});

const mockedLogin = vi.mocked(login);
const mockUser: LoginResponse['user'] = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  first_name: 'Admin',
  last_name: 'User',
  is_active: true,
  is_staff: true,
  user_roles: [],
  roles: [],
  date_joined: new Date().toISOString(),
};

describe('LoginPage', () => {
  beforeEach(() => {
    mockedLogin.mockReset();
  });

  it('renders the login form with empty fields', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);

    const usernameField = screen.getByLabelText(/имя пользователя/i);
    const passwordField = screen.getByLabelText(/пароль/i);

    expect(usernameField).toHaveValue('');
    expect(passwordField).toHaveValue('');
    expect(usernameField).toHaveAttribute('placeholder', 'admin');
    expect(passwordField).toHaveAttribute('placeholder', '••••••••');
    expect(screen.getByRole('button', { name: /войти/i })).toBeEnabled();
  });

  it('calls onLoginSuccess when the login request succeeds', async () => {
    const onLoginSuccess = vi.fn();
    mockedLogin.mockResolvedValue({ access: 'token', refresh: 'token', user: mockUser });
    const user = userEvent.setup();

    render(<LoginPage onLoginSuccess={onLoginSuccess} />);

    await user.type(screen.getByLabelText(/имя пользователя/i), 'admin');
    await user.type(screen.getByLabelText(/пароль/i), 'admin123');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalled());
    expect(mockedLogin).toHaveBeenCalledWith('admin', 'admin123');
  });

  it('shows an error message when the login fails', async () => {
    const onLoginSuccess = vi.fn();
    mockedLogin.mockRejectedValue(new Error('Некорректный пароль'));
    const user = userEvent.setup();

    render(<LoginPage onLoginSuccess={onLoginSuccess} />);

    await user.type(screen.getByLabelText(/имя пользователя/i), 'admin');
    await user.type(screen.getByLabelText(/пароль/i), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(screen.getByText(/некорректный пароль/i)).toBeInTheDocument();
    });
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });
});
