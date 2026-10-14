// ============================================================
// Auth Context - Manage user session
// ============================================================
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { api, TOKEN_KEY, USER_KEY, setSessionEndedHandler } from '../api/client';

export type UserRole = 'job_seeker' | 'employer' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  account_status: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const userStr = await AsyncStorage.getItem(USER_KEY);
        if (token && userStr) {
          setUser(JSON.parse(userStr));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Several requests can fail at once when a session ends: sign out and explain only once.
  const endingSession = useRef(false);
  useEffect(() => {
    setSessionEndedHandler(async (message: string) => {
      if (endingSession.current) return;
      endingSession.current = true;
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      setUser(null);
      router.replace('/');
      Alert.alert('Signed Out', message);
    });
    return () => setSessionEndedHandler(null);
  }, []);

  const login = async (token: string, u: AuthUser) => {
    endingSession.current = false;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      const u: AuthUser = res.data.user;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
      setUser(u);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
