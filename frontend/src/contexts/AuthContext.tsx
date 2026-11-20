import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api.js';
import { User } from '../types/index.js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithGoogle: () => void;
  devLogin: (email?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check URL parameters for token on initial load (from Google OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      // Clean query parameter from URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, []);

  // Fetch current user from /api/auth/me
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const response = await api.get('/auth/me');
        if (response.data.success && response.data.user) {
          setUser(response.data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMe();
  }, []);

  const loginWithGoogle = () => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    window.location.href = `${apiBase}/auth/google`;
  };

  const devLogin = async (email?: string, name?: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/dev-login', { email, name });
      if (response.data.success) {
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        setUser(response.data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // ignore
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, devLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
