import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gamesApi, teamsApi, playersApi, statisticsApi } from '../utils/api';
import { Game, Statistic, Player, Team } from '../types';

interface PlayEvent {
  id: number;
  quarter: number;
  timestamp: string;
  player: Player;
  team: Team;
  actionType: string;
  actionDescription: string;
  homeScore: number;
  awayScore: number;
  assistedBy?: Player;
  reboundedBy?: Player;
}

function PlayByPlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [_players, setPlayers] = useState<{ [key: number]: Player }>({});
  const [_teams, setTeams] = useState<{ [key: number]: Team }>({});
  const [events, setEvents] = useState<PlayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuarter, setSelectedQuarter] = useState<'all' | 1 | 2 | 3 | 4>('all');

  useEffect(() => {
    if (gameId) {
      loadGameData();
    }
  }, [gameId]);

  const loadGameData = async () => {
    if (!gameId) return;
    try {
      setLoading(true);
      
      // 加载比赛信息
      const gameResponse = await gamesApi.getById(Number(gameId));
      const gameData = gameResponse.data;
      setGame(gameData);

      // 加载球队信息
      const [homeResponse, awayResponse] = await Promise.all([
        teamsApi.getById(gameData.home_team_id),
        teamsApi.getById(gameData.away_team_id),
      ]);
      setHomeTeam(homeResponse.data);
      setAwayTeam(awayResponse.data);
      
      const teamsMap: { [key: number]: Team } = {
        [homeResponse.data.id]: homeResponse.data,
        [awayResponse.data.id]: awayResponse.data,
      };
      setTeams(teamsMap);

      // 加载所有球员
      const [homePlayersResponse, awayPlayersResponse] = await Promise.all([
        playersApi.getByTeam(gameData.home_team_id),
        playersApi.getByTeam(gameData.away_team_id),
      ]);
      
      const allPlayers = [...homePlayersResponse.data, ...awayPlayersResponse.data];
      const playersMap: { [key: number]: Player } = {};
      allPlayers.forEach(player => {
        playersMap[player.id] = player;
      });
      setPlayers(playersMap);

      // 加载统计数据
      const statsResponse = await statisticsApi.getByGame(Number(gameId));
      const stats = statsResponse.data;

      // 按时间戳排序
      const sortedStats = [...stats].sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      // 转换为PlayEvent并计算累积比分
      let homeScore = 0;
      let awayScore = 0;
      const playEvents: PlayEvent[] = [];

      sortedStats.forEach((stat) => {
        const player = playersMap[stat.player_id];
        if (!player) return;

        const team = teamsMap[player.team_id];
        if (!team) return;

        // 更新比分
        if (stat.action_type === '2PM') {
          if (team.id === gameData.home_team_id) {
            homeScore += 2;
          } else {
            awayScore += 2;
          }
        } else if (stat.action_type === '3PM') {
          if (team.id === gameData.home_team_id) {
            homeScore += 3;
          } else {
            awayScore += 3;
          }
        } else if (stat.action_type === 'FTM') {
          if (team.id === gameData.home_team_id) {
            homeScore += 1;
          } else {
            awayScore += 1;
          }
        }

        // 获取动作描述
        const actionDescription = getActionDescription(stat, playersMap);

        // 获取助攻和篮板球员
        let assistedBy: Player | undefined;
        let reboundedBy: Player | undefined;
        if (stat.assisted_by_player_id) {
          assistedBy = playersMap[stat.assisted_by_player_id];
        }
        if (stat.rebounded_by_player_id) {
          reboundedBy = playersMap[stat.rebounded_by_player_id];
        }

        playEvents.push({
          id: stat.id,
          quarter: stat.quarter,
          timestamp: stat.timestamp,
          player,
          team,
          actionType: stat.action_type,
          actionDescription,
          homeScore,
          awayScore,
          assistedBy,
          reboundedBy,
        });
      });

      // 按时间倒序排列（最新的在上）
      setEvents(playEvents.reverse());
    } catch (error) {
      console.error('加载比赛数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionDescription = (stat: Statistic, playersMap: { [key: number]: Player }): string => {
    const actionMap: { [key: string]: string } = {
      '2PM': 'scores a two pointer',
      '2PA': 'misses a two pointer',
      '3PM': 'scores a three pointer',
      '3PA': 'misses a three pointer',
      'FTM': 'scores a free throw',
      'FTA': 'misses a free throw',
      'OREB': 'gets an offensive rebound',
      'DREB': 'gets a defensive rebound',
      'AST': 'assists',
      'STL': 'steals the ball',
      'BLK': 'blocks an opponent',
      'TOV': 'loses the ball',
      'PF': 'commits a personal foul',
      'PFD': 'draws a personal foul',
      'SUB_IN': 'subs in',
      'SUB_OUT': 'subs out',
    };

    let description = actionMap[stat.action_type] || stat.action_type;
    
    // 添加助攻信息
    if (stat.assisted_by_player_id) {
      const assistPlayer = playersMap[stat.assisted_by_player_id];
      if (assistPlayer) {
        description += ` (assisted by ${assistPlayer.name})`;
      }
    }
    
    // 添加篮板信息
    if (stat.rebounded_by_player_id) {
      const reboundPlayer = playersMap[stat.rebounded_by_player_id];
      if (reboundPlayer) {
        description += ` (rebounded by ${reboundPlayer.name})`;
      }
    }

    return description;
  };

  const formatTime = (timestamp: string, quarter: number) => {
    if (!game) return `${quarter}° 00:00`;
    
    // 计算该节剩余时间
    // 每节时长（分钟）
    const quarterDurationMinutes = game.duration / game.quarters;
    const quarterDurationSeconds = quarterDurationMinutes * 60;
    
    // 计算从比赛开始到当前事件的总秒数
    const gameStartTime = new Date(game.date).getTime();
    const eventTime = new Date(timestamp).getTime();
    const totalElapsedSeconds = Math.floor((eventTime - gameStartTime) / 1000);
    
    // 计算当前节的已用时间
    const quarterElapsed = totalElapsedSeconds % quarterDurationSeconds;
    const quarterRemaining = quarterDurationSeconds - quarterElapsed;
    
    // 确保时间不为负
    const remaining = Math.max(0, quarterRemaining);
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    
    return `${quarter}° ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const formatTimeForCSV = (timestamp: string, _quarter: number) => {
    if (!game) return '00:00';
    
    // CSV格式：MM:SS（从该节开始的时间）
    const quarterDurationMinutes = game.duration / game.quarters;
    const quarterDurationSeconds = quarterDurationMinutes * 60;
    
    const gameStartTime = new Date(game.date).getTime();
    const eventTime = new Date(timestamp).getTime();
    const totalElapsedSeconds = Math.floor((eventTime - gameStartTime) / 1000);
    
    // 计算当前节的已用时间
    const quarterElapsed = totalElapsedSeconds % quarterDurationSeconds;
    const minutes = Math.floor(quarterElapsed / 60);
    const seconds = quarterElapsed % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes('PM') || actionType === 'FTM') {
      return 'text-green-600';
    } else if (actionType.includes('PA') || actionType === 'FTA' || actionType === 'TOV') {
      return 'text-red-600';
    } else {
      return 'text-gray-700';
    }
  };

  const filteredEvents = selectedQuarter === 'all' 
    ? events 
    : events.filter(e => e.quarter === selectedQuarter);

  const exportToCSV = () => {
    if (!game || !homeTeam || !awayTeam) return;

    // CSV头部
    const headers = [
      'Game',
      'Date',
      'Home player 1', 'Home player 2', 'Home player 3', 'Home player 4', 'Home player 5',
      'Away player 1', 'Away player 2', 'Away player 3', 'Away player 4', 'Away player 5',
      'Quarter',
      'Minutes',
      'Home score',
      'Away score',
      'Play id',
      'Team',
      'Offensive system',
      'Defensive system',
      'Player',
      'Event',
      'Description'
    ];

    // 获取首发球员（简化版本，使用前5个事件中的球员）
    const homeStarters: Player[] = [];
    const awayStarters: Player[] = [];
    
    events.slice(0, 10).forEach(event => {
      if (event.team.id === game.home_team_id && homeStarters.length < 5) {
        if (!homeStarters.find(p => p.id === event.player.id)) {
          homeStarters.push(event.player);
        }
      } else if (event.team.id === game.away_team_id && awayStarters.length < 5) {
        if (!awayStarters.find(p => p.id === event.player.id)) {
          awayStarters.push(event.player);
        }
      }
    });

    // 填充到5个
    while (homeStarters.length < 5) {
      homeStarters.push({ id: 0, name: '', number: 0, team_id: game.home_team_id } as Player);
    }
    while (awayStarters.length < 5) {
      awayStarters.push({ id: 0, name: '', number: 0, team_id: game.away_team_id } as Player);
    }

    const gameName = `${homeTeam.name} vs ${awayTeam.name}`;
    const gameDate = new Date(game.date).toLocaleDateString('en-GB');

    // 生成CSV行（按时间正序）
    const sortedEvents = [...filteredEvents].reverse(); // 反转回正序
    const rows = sortedEvents.map((event, index) => {
      const minutes = formatTimeForCSV(event.timestamp, event.quarter);
      const quarter = event.quarter;

      const eventMap: { [key: string]: string } = {
        '2PM': 'Two pointer made',
        '2PA': 'Two pointer missed',
        '3PM': 'Three pointer made',
        '3PA': 'Three pointer missed',
        'FTM': 'Free throw made',
        'FTA': 'Free throw missed',
        'OREB': 'Offensive rebound',
        'DREB': 'Defensive rebound',
        'AST': 'Assist',
        'STL': 'Steal',
        'BLK': 'Block',
        'TOV': 'Turnover',
        'PF': 'Defensive foul',
        'PFD': 'Personal foul drawn',
        'SUB_IN': 'Sub in',
        'SUB_OUT': 'Sub out',
      };

      const eventName = eventMap[event.actionType] || event.actionType;
      const description = event.actionDescription;

      return [
        gameName,
        gameDate,
        homeStarters[0]?.name || '',
        homeStarters[1]?.name || '',
        homeStarters[2]?.name || '',
        homeStarters[3]?.name || '',
        homeStarters[4]?.name || '',
        awayStarters[0]?.name || '',
        awayStarters[1]?.name || '',
        awayStarters[2]?.name || '',
        awayStarters[3]?.name || '',
        awayStarters[4]?.name || '',
        quarter,
        minutes,
        event.homeScore.toString(),
        event.awayScore.toString(),
        index.toString(),
        event.team.name,
        '',
        '',
        event.player.name,
        eventName,
        description
      ];
    });

    // 组合CSV内容
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // 下载CSV文件
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${gameName.replace(/\s+/g, '_')}_play_by_play.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!game || !homeTeam || !awayTeam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">比赛数据加载失败</p>
          <button
            onClick={() => navigate('/games')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            返回比赛列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-green-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/games')}
              className="flex items-center gap-2 text-green-100 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-xl font-bold">Statistics</h1>
            <button
              onClick={exportToCSV}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-full p-2"
              title="导出CSV"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
          
          {/* 节筛选 */}
          <div className="flex gap-2">
            {(['all', 1, 2, 3, 4] as const).map((q) => (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  selectedQuarter === q
                    ? 'bg-black text-white'
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                {q === 'all' ? 'All' : `Q${q}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 比赛信息 */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-blue-600">{homeTeam.name}</div>
            <div className="text-2xl font-bold">
              {events.length > 0 ? events[events.length - 1].homeScore : 0} - {events.length > 0 ? events[events.length - 1].awayScore : 0}
            </div>
            <div className="text-lg font-semibold text-red-600">{awayTeam.name}</div>
          </div>
          <div className="text-sm text-gray-500 text-center mt-1">
            {new Date(game.date).toLocaleDateString('zh-CN')}
          </div>
        </div>
      </div>

      {/* Play by Play 列表 */}
      <div className="container mx-auto px-4 py-6">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <p className="text-gray-500">暂无比赛事件</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...filteredEvents].reverse().map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-lg shadow-md p-4 flex items-start gap-4"
              >
                {/* 球员头像/号码 */}
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    event.team.id === game.home_team_id ? 'bg-blue-500' : 'bg-red-500'
                  }`}>
                    {event.player.number}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 text-center">
                    #{event.player.number}<br />
                    {event.player.name}
                  </div>
                </div>

                {/* 事件详情 */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-500">
                      {formatTime(event.timestamp, event.quarter)}
                    </div>
                    <div className="text-sm font-semibold">
                      {event.homeScore} - {event.awayScore}
                    </div>
                  </div>
                  <div className={`font-medium ${getActionColor(event.actionType)}`}>
                    {event.actionDescription}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayByPlay;

