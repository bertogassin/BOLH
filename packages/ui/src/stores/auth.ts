import { createStore } from 'solid-js/store';
import { createContext, useContext } from 'solid-js';

export interface User {
  id: number;
  phone: string;
  name: string;
  email?: string;
  role: 'client' | 'guard' | 'admin';
  avatarUrl?: string;
  rating?: number;
  verifiedLevel?: number;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
};

const [state, setState] = createStore<AuthState>(initialState);

export const authStore = {
  get state() {
    return state;
  },

  setUser(user: User | null) {
    setState('user', user);
    setState('isAuthenticated', !!user);
  },

  setTokens(accessToken: string | null, refreshToken: string | null) {
    setState('accessToken', accessToken);
    setState('refreshToken', refreshToken);
    
    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
    } else {
      localStorage.removeItem('access_token');
    }
    
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
  },

  setLoading(isLoading: boolean) {
    setState('isLoading', isLoading);
  },

  login(user: User, accessToken: string, refreshToken: string) {
    this.setUser(user);
    this.setTokens(accessToken, refreshToken);
  },

  logout() {
    this.setUser(null);
    this.setTokens(null, null);
    localStorage.removeItem('user');
  },

  async init() {
    this.setLoading(true);
    
    try {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (accessToken) {
        setState('accessToken', accessToken);
        setState('refreshToken', refreshToken);
        
        // TODO: Validate token and fetch user
        // For now, just mark as authenticated if token exists
        // const user = await api.getMe();
        // this.setUser(user);
      }
    } catch (error) {
      console.error('Auth init error:', error);
      this.logout();
    } finally {
      this.setLoading(false);
    }
  },
};

// Context for dependency injection
export const AuthContext = createContext(authStore);

export function useAuth() {
  return useContext(AuthContext);
}
