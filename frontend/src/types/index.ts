// 类型定义

export interface Team {
  id: number;
  name: string;
  logo?: string;
  created_at?: string;
}

export interface Player {
  id: number;
  team_id: number;
  name: string;
  number: number;
  avatar?: string;
  position?: string;
  display_order?: number;  // 显示顺序，用于排序和确定首发
  created_at?: string;
}

export interface Game {
  id: number;
  home_team_id: number;
  away_team_id: number;
  date: string;
  duration: number;
  quarters: number;
  status: 'pending' | 'live' | 'paused' | 'finished';
}

export interface Statistic {
  id: number;
  game_id: number;
  player_id: number;
  quarter: number;
  action_type: string;
  shot_x?: number | null;
  shot_y?: number | null;
  assisted_by_player_id?: number | null;
  rebounded_by_player_id?: number | null;
  timestamp: string;
}

export type ActionType = 
  | '2PM' | '2PA' 
  | '3PM' | '3PA' 
  | 'FTM' | 'FTA' 
  | 'OREB' | 'DREB' 
  | 'AST' | 'STL' | 'BLK' | 'TOV' | 'PF' | 'PFD'
  | 'SUB_IN' | 'SUB_OUT';

