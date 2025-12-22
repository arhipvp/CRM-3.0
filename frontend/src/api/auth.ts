import { API_BASE, clearTokens, request, setAccessToken, setRefreshToken } from './request';

export interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    is_staff: boolean;
    user_roles: UserRole[];
    roles: string[];
    date_joined: string;
  };
}

export interface UserRole {
  role?: {
    name?: string;
  };
}

export interface CurrentUserResponse {
  id: number;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  is_authenticated?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  user_roles?: UserRole[];
  roles?: string[];
}

export interface ChangePasswordResponse {
  detail?: string;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Login failed');
  }

  const data = (await response.json()) as LoginResponse;
  setAccessToken(data.access);
  setRefreshToken(data.refresh);
  console.log('Login successful, tokens stored');
  return data;
}

export function logout(): void {
  clearTokens();
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResponse> {
  return request<ChangePasswordResponse>('/auth/password/', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  return request<CurrentUserResponse>('/auth/me/');
}
