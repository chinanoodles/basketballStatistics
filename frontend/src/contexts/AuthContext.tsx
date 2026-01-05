import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../utils/api';

interface League {
  id: number;
  name: string;
  description?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  leagues: League[];
  login: (username: string, password: string, leagueId?: number, role?: 'player' | 'team_admin') => Promise<void>;
  register: (username: string, email: string, password: string, role: 'player' | 'team_admin', leagueId?: number) => Promise<void>;
  logout: () => void;
  switchLeague: (leagueId: number, role?: 'player' | 'team_admin') => Promise<void>;
  loadLeagues: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTeamAdmin: boolean;
  isPlayer: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始化：从localStorage恢复用户信息
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
        // 验证token是否有效
        authApi.getMe()
          .then((response) => {
            setUser(response.data);
            localStorage.setItem('user', JSON.stringify(response.data));
          })
          .catch(() => {
            // Token无效，清除
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          })
          .finally(() => {
            setLoading(false);
          });
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const loadLeagues = async () => {
    try {
      const response = await authApi.getMyLeagues();
      setLeagues(response.data);
    } catch (error: any) {
      console.error('加载leagues失败:', error);
      setLeagues([]);
    }
  };

  const login = async (username: string, password: string, leagueId?: number, role?: 'player' | 'team_admin') => {
    try {
      const response = await authApi.login(username, password, leagueId, role);
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // 登录后加载leagues
      await loadLeagues();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || '登录失败');
    }
  };

  const register = async (username: string, email: string, password: string, role: 'player' | 'team_admin', leagueId?: number) => {
    try {
      await authApi.register({
        username,
        email,
        password,
        role,
        league_id: leagueId,
      });
      // 注册成功后自动登录
      await login(username, password);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || '注册失败');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setLeagues([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const switchLeague = async (leagueId: number, role?: 'player' | 'team_admin') => {
    try {
      const response = await authApi.switchLeague(leagueId, role);
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // 切换league后重新加载leagues（虽然通常不会变化）
      await loadLeagues();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || '切换league失败');
    }
  };

  // 登录后自动加载leagues
  useEffect(() => {
    if (user && token) {
      loadLeagues();
    }
  }, [user, token]);

  const value: AuthContextType = {
    user,
    token,
    leagues,
    login,
    register,
    logout,
    switchLeague,
    loadLeagues,
    isAuthenticated: !!user && !!token,
    isAdmin: user?.role === 'admin',
    isTeamAdmin: user?.role === 'team_admin' || user?.role === 'admin',
    isPlayer: user?.role === 'player',
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

