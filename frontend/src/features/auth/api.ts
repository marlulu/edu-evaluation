import axios from 'axios';

export type UserRole = 'ADMIN' | 'TEACHER' | 'ASSISTANT' | 'STUDENT';

export type AuthSession = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  studentId: string | null;
};

const sessionKey = 'edu-evaluation-session';

export async function login(username: string, password: string): Promise<AuthSession> {
  const response = await axios.post<AuthSession>('/api/auth/login', { username, password });
  return response.data;
}

export async function registerTeacher(input: { username: string; password: string; displayName: string }): Promise<AuthSession> {
  const response = await axios.post<AuthSession>('/api/auth/register/teacher', input);
  return response.data;
}

export async function registerStudent(input: {
  username: string; password: string; studentNumber: string; initialPassword: string;
}): Promise<AuthSession> {
  const response = await axios.post<AuthSession>('/api/auth/register/student', input);
  return response.data;
}

export async function fetchCurrentSession(): Promise<AuthSession> {
  const response = await axios.get<AuthSession>('/api/auth/me');
  return response.data;
}

export function getStoredSession(): AuthSession | undefined {
  const value = localStorage.getItem(sessionKey);
  if (!value) return undefined;
  try {
    return JSON.parse(value) as AuthSession;
  } catch {
    localStorage.removeItem(sessionKey);
    return undefined;
  }
}

export function persistSession(session: AuthSession): void {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(sessionKey);
}

axios.interceptors.request.use((config) => {
  const session = getStoredSession();
  if (session?.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`;
  return config;
});
