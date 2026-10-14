// ============================================================
// API Client - Axios instance with JWT auth
// ============================================================
import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Inject token from AsyncStorage
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('peso_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A request sent with a saved login that the server no longer accepts (expired or invalid login, or the
// account was deactivated or is pending) ends the session, so the app does not stay "signed in" with every
// screen failing. Requests without a login (e.g. a wrong password on the sign-in screen) are not affected.
let sessionEndedHandler: ((message: string) => void) | null = null;
export function setSessionEndedHandler(handler: ((message: string) => void) | null) {
  sessionEndedHandler = handler;
}

api.interceptors.response.use(
  (response) => response,
  (err) => {
    const status = err?.response?.status;
    const message: string = err?.response?.data?.error || '';
    const sentWithLogin = !!err?.config?.headers?.Authorization;
    const accountBlocked = status === 403 && /^Account (suspended|pending)/.test(message);
    if (sentWithLogin && (status === 401 || accountBlocked) && sessionEndedHandler) {
      sessionEndedHandler(accountBlocked ? message : 'Your session has ended. Please sign in again.');
    }
    return Promise.reject(err);
  },
);

// Generic error normaliser
export function getApiError(err: any): string {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.message) return err.message;
  return 'Network error. Please try again.';
}

export const TOKEN_KEY = 'peso_token';
export const USER_KEY = 'peso_user';
