import axios from 'axios';

// 优先使用环境变量，如果没有则使用相对路径（通过Vite代理）
// 外网访问时，应该设置 VITE_API_URL 为实际的后端地址，例如：http://192.168.31.38:8000/api/v1
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加Token（排除登录和注册接口）
api.interceptors.request.use(
  (config) => {
    // 登录和注册接口不需要token
    const isAuthEndpoint = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');
    if (!isAuthEndpoint) {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理401错误（未授权）
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token过期或无效，清除本地存储
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 只在非登录/注册页面时跳转，避免在注册页面时跳转
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && !currentPath.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Teams API
export const teamsApi = {
  getAll: () => api.get('/teams/'),
  getById: (id: number) => api.get(`/teams/${id}`),
  create: (data: { name: string; logo?: string; league_id?: number }) => api.post('/teams/', data),
  update: (id: number, data: { name: string; logo?: string; league_id?: number }) => api.put(`/teams/${id}`, data),
  delete: (id: number, cascadeDeleteGames: boolean = false) => 
    api.delete(`/teams/${id}`, { params: { cascade_delete_games: cascadeDeleteGames } }),
  getRelatedGames: (id: number) => api.get(`/teams/${id}/related-games`),
};

// Players API
export const playersApi = {
  getByTeam: (teamId: number) => api.get(`/players/team/${teamId}`),
  getById: (id: number) => api.get(`/players/${id}`),
  create: (data: {
    team_id: number;
    name: string;
    number: number;
    avatar?: string;
    position?: string;
    display_order?: number;
  }) => api.post('/players/', data),
  update: (id: number, data: {
    team_id: number;
    name: string;
    number: number;
    avatar?: string;
    position?: string;
    display_order?: number;
  }) => api.put(`/players/${id}`, data),
  delete: (id: number) => api.delete(`/players/${id}`),
  updateOrder: (teamId: number, orders: Array<{ player_id: number; display_order: number }>) =>
    api.put(`/players/team/${teamId}/order`, orders),
};

// Games API
export const gamesApi = {
  getAll: (seasonType?: 'regular' | 'playoff') => {
    const params = seasonType ? { season_type: seasonType } : {};
    return api.get('/games/', { params });
  },
  getById: (id: number) => api.get(`/games/${id}`),
  create: (data: {
    league_id?: number;
    home_team_id: number;
    away_team_id: number;
    date: string;
    duration?: number;
    quarters?: number;
    season_type?: 'regular' | 'playoff';
    player_ids?: number[];
  }) => api.post('/games/', data),
  start: (id: number) => api.put(`/games/${id}/start`),
  pause: (id: number) => api.put(`/games/${id}/pause`),
  finish: (id: number) => api.put(`/games/${id}/finish`),
  delete: (id: number) => api.delete(`/games/${id}`),
  batchDelete: (gameIds: number[]) => api.post('/games/batch-delete', gameIds),
  getStatistics: (id: number) => api.get(`/games/${id}/statistics`),
};

// Statistics API
export const statisticsApi = {
  create: (data: {
    game_id: number;
    player_id: number;
    quarter: number;
    action_type: string;
    shot_x?: number | null;
    shot_y?: number | null;
    assisted_by_player_id?: number | null;
    rebounded_by_player_id?: number | null;
  }) => api.post('/statistics/', data),
  getByGame: (gameId: number) => api.get(`/statistics/game/${gameId}`),
  getByPlayer: (gameId: number, playerId: number) =>
    api.get(`/statistics/game/${gameId}/player/${playerId}`),
  getByLeague: (leagueId: number, seasonType?: 'regular' | 'playoff') => {
    const params = seasonType ? { season_type: seasonType } : {};
    return api.get(`/statistics/league/${leagueId}`, { params });
  },
};

// Player Time API
export const playerTimeApi = {
  enter: (gameId: number, playerId: number, quarter: number) =>
    api.post('/player-time/enter', null, {
      params: { game_id: gameId, player_id: playerId, quarter },
    }),
  exit: (gameId: number, playerId: number) =>
    api.post('/player-time/exit', null, {
      params: { game_id: gameId, player_id: playerId },
    }),
  getByPlayer: (gameId: number, playerId: number) =>
    api.get(`/player-time/game/${gameId}/player/${playerId}`),
  getAll: (gameId: number) => api.get(`/player-time/game/${gameId}/total`),
};

// Auth API
export const authApi = {
  login: (username: string, password: string, leagueId?: number, role?: 'player' | 'team_admin') => {
    return api.post('/auth/login', {
      username,
      password,
      league_id: leagueId,
      role: role,
    });
  },
  register: (data: {
    username: string;
    email?: string;
    password: string;
    role: 'player' | 'team_admin';
    league_id?: number;
  }) => {
    // 如果email为空字符串，转换为undefined
    const registerData = {
      ...data,
      email: data.email && data.email.trim() ? data.email.trim() : undefined,
      league_id: data.league_id || undefined,
    };
    return api.post('/auth/register', registerData);
  },
  getMe: () => api.get('/auth/me'),
  getMyLeagues: () => api.get('/auth/my-leagues'),
  switchLeague: (leagueId: number, role?: 'player' | 'team_admin') => {
    return api.post('/auth/switch-league', {
      league_id: leagueId,
      role: role,
    });
  },
  enrollLeague: (leagueId: number) => {
    return api.post('/auth/enroll-league', {
      league_id: leagueId,
    });
  },
  unenrollLeague: (leagueId: number) => {
    return api.delete(`/auth/enroll-league/${leagueId}`);
  },
};

// Users API (管理员)
export const usersApi = {
  getAll: (leagueId?: number, role?: string) => {
    const params: any = {};
    if (leagueId) params.league_id = leagueId;
    if (role) params.role = role;
    return api.get('/users/', { params });
  },
  getById: (id: number) => api.get(`/users/${id}`),
  update: (id: number, data: {
    email?: string;
    role?: string;
    league_id?: number;
    league_ids?: number[];
    is_active?: boolean;
    password?: string;
  }) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  batchEnroll: (userIds: number[], leagueId: number) => 
    api.post('/users/batch-enroll', { user_ids: userIds, league_id: leagueId }),
};

// Leagues API
export const leaguesApi = {
  getAll: () => api.get('/leagues/'),
  getPublic: () => {
    // 公开API，不需要token
    return axios.get(`${API_BASE_URL}/leagues/public`);
  },
  getById: (id: number) => api.get(`/leagues/${id}`),
  create: (data: {
    name: string;
    description?: string;
    regular_season_name?: string;
    playoff_name?: string;
  }) => api.post('/leagues/', data),
  update: (id: number, data: {
    name?: string;
    description?: string;
    regular_season_name?: string;
    playoff_name?: string;
    is_active?: boolean;
  }) => api.put(`/leagues/${id}`, data),
  delete: (id: number) => api.delete(`/leagues/${id}`),
};

