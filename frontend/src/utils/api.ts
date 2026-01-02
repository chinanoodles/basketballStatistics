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

// Teams API
export const teamsApi = {
  getAll: () => api.get('/teams/'),
  getById: (id: number) => api.get(`/teams/${id}`),
  create: (data: { name: string; logo?: string }) => api.post('/teams/', data),
  update: (id: number, data: { name: string; logo?: string }) => api.put(`/teams/${id}`, data),
  delete: (id: number) => api.delete(`/teams/${id}`),
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
  getAll: () => api.get('/games/'),
  getById: (id: number) => api.get(`/games/${id}`),
  create: (data: {
    home_team_id: number;
    away_team_id: number;
    date: string;
    duration?: number;
    quarters?: number;
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

