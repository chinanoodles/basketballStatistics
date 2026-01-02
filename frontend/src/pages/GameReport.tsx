import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gamesApi, teamsApi, playersApi, statisticsApi, playerTimeApi } from '../utils/api';
import { Game, Team, Player, Statistic } from '../types';
import ShotChart from '../components/ShotChart';
import ScoreChart from '../components/ScoreChart';
import TeamComparisonBoard from '../components/TeamComparisonBoard';

interface PlayerStats {
  player: Player;
  minutes: string;
  points: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  fg2m: number;
  fg2a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  pf: number;
  pfd: number;
  shots: Array<{ x: number; y: number; made: boolean; type: '2PM' | '3PM' | '2PA' | '3PA' }>;
}

interface TeamStats {
  team: Team;
  players: PlayerStats[];
  totalPoints: number;
  totalRebounds: number;
  totalAssists: number;
  totalTurnovers: number;
  totalSteals: number;
  totalBlocks: number;
      quarterPoints: number[]; // 每节得分
      pointsOffTurnovers: number; // 失误得分
  pointsInPaint: number; // 内线得分
  secondChancePoints: number; // 二次进攻得分
  fastBreakPoints: number; // 快攻得分
  startersPoints: number; // 首发得分
  benchPoints: number; // 替补得分
  fieldGoalPercentage: number; // 投篮命中率
  threePointPercentage: number; // 三分命中率
  twoPointPercentage: number; // 两分命中率
  freeThrowPercentage: number; // 罚球命中率
}

interface ScorePoint {
  x: number; // 回合序号
  homeScore: number;
  awayScore: number;
}

interface GameSummary {
  homeQuarterPoints: number[];
  awayQuarterPoints: number[];
  homeLeaders: {
    points: { player: Player; value: number };
    assists: { player: Player; value: number };
    rebounds: { player: Player; value: number };
    efficiency: { player: Player; value: number };
  };
  awayLeaders: {
    points: { player: Player; value: number };
    assists: { player: Player; value: number };
    rebounds: { player: Player; value: number };
    efficiency: { player: Player; value: number };
  };
  scoreProgression: ScorePoint[]; // 累积得分曲线数据
}

function GameReport() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [homeStats, setHomeStats] = useState<TeamStats | null>(null);
  const [awayStats, setAwayStats] = useState<TeamStats | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) {
      loadGameData();
    }
  }, [gameId]);

  const loadGameData = async () => {
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

      // 加载球员信息
      const [homePlayersResponse, awayPlayersResponse] = await Promise.all([
        playersApi.getByTeam(gameData.home_team_id),
        playersApi.getByTeam(gameData.away_team_id),
      ]);

      // 加载统计数据
      const statsResponse = await statisticsApi.getByGame(Number(gameId));
      const allStats = statsResponse.data;

      // 计算主队统计
      const homeStatsData = await calculateTeamStats(
        homeResponse.data,
        homePlayersResponse.data,
        allStats,
        gameData.home_team_id,
        Number(gameId)
      );
      setHomeStats(homeStatsData);

      // 计算客队统计
      const awayStatsData = await calculateTeamStats(
        awayResponse.data,
        awayPlayersResponse.data,
        allStats,
        gameData.away_team_id,
        Number(gameId)
      );
      setAwayStats(awayStatsData);

      // 计算比赛摘要
      const homePlayerIds = homePlayersResponse.data.map((p: Player) => p.id);
      const awayPlayerIds = awayPlayersResponse.data.map((p: Player) => p.id);
      const summary = calculateGameSummary(
        homeStatsData,
        awayStatsData,
        homePlayersResponse.data,
        awayPlayersResponse.data,
        allStats,
        homePlayerIds,
        awayPlayerIds
      );
      setGameSummary(summary);

    } catch (error) {
      console.error('加载比赛数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTeamStats = async (
    team: Team,
    players: Player[],
    allStats: Statistic[],
    _teamId: number,
    gameId: number
  ): Promise<TeamStats> => {
    const playerStatsMap: { [key: number]: PlayerStats } = {};

    // 初始化每个球员的统计数据
    players.forEach((player) => {
      playerStatsMap[player.id] = {
        player,
        minutes: '0:00',
        points: 0,
        fgm: 0,
        fga: 0,
        fg3m: 0,
        fg3a: 0,
        fg2m: 0,
        fg2a: 0,
        ftm: 0,
        fta: 0,
        oreb: 0,
        dreb: 0,
        reb: 0,
        ast: 0,
        tov: 0,
        stl: 0,
        blk: 0,
        pf: 0,
        pfd: 0,
        shots: [],
      };
    });

    // 获取球员出场时间
    let playerTimesData: { [key: number]: number } = {};
    try {
      const timesResponse = await playerTimeApi.getAll(gameId);
      playerTimesData = timesResponse.data;
    } catch (error) {
      console.error('加载出场时间失败:', error);
    }

    // 处理统计数据
    allStats.forEach((stat) => {
      const playerStat = playerStatsMap[stat.player_id];
      if (!playerStat) return;

      switch (stat.action_type) {
        case '2PM':
          playerStat.fg2m++;
          playerStat.fg2a++;
          playerStat.fgm++;
          playerStat.fga++;
          playerStat.points += 2;
          // 添加出手点（如果有）
          if ((stat as any).shot_x !== null && (stat as any).shot_x !== undefined) {
            playerStat.shots.push({
              x: (stat as any).shot_x,
              y: (stat as any).shot_y || 50,
              made: true,
              type: '2PM',
            });
          }
          break;
        case '2PA':
          playerStat.fg2a++;
          playerStat.fga++;
          // 添加出手点（如果有）
          if ((stat as any).shot_x !== null && (stat as any).shot_x !== undefined) {
            playerStat.shots.push({
              x: (stat as any).shot_x,
              y: (stat as any).shot_y || 50,
              made: false,
              type: '2PA',
            });
          }
          break;
        case '3PM':
          playerStat.fg3m++;
          playerStat.fg3a++;
          playerStat.fgm++;
          playerStat.fga++;
          playerStat.points += 3;
          // 添加出手点（如果有）
          if ((stat as any).shot_x !== null && (stat as any).shot_x !== undefined) {
            playerStat.shots.push({
              x: (stat as any).shot_x,
              y: (stat as any).shot_y || 50,
              made: true,
              type: '3PM',
            });
          }
          break;
        case '3PA':
          playerStat.fg3a++;
          playerStat.fga++;
          // 添加出手点（如果有）
          if ((stat as any).shot_x !== null && (stat as any).shot_x !== undefined) {
            playerStat.shots.push({
              x: (stat as any).shot_x,
              y: (stat as any).shot_y || 50,
              made: false,
              type: '3PA',
            });
          }
          break;
        case 'FTM':
          playerStat.ftm++;
          playerStat.fta++;
          playerStat.points += 1;
          break;
        case 'FTA':
          playerStat.fta++;
          break;
        case 'OREB':
          playerStat.oreb++;
          playerStat.reb++;
          break;
        case 'DREB':
          playerStat.dreb++;
          playerStat.reb++;
          break;
        case 'AST':
          playerStat.ast++;
          break;
        case 'STL':
          playerStat.stl++;
          break;
        case 'BLK':
          playerStat.blk++;
          break;
        case 'TOV':
          playerStat.tov++;
          break;
        case 'PF':
          playerStat.pf++;
          break;
        case 'PFD':
          playerStat.pfd++;
          break;
      }
    });

    // 计算出场时间
    Object.keys(playerStatsMap).forEach((playerIdStr) => {
      const playerId = Number(playerIdStr);
      const totalSeconds = playerTimesData[playerId] || 0;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      playerStatsMap[playerId].minutes = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    });

    const playerStats = Object.values(playerStatsMap).filter(
      (ps) => ps.fga > 0 || ps.fta > 0 || ps.reb > 0 || ps.ast > 0 || ps.tov > 0 || ps.stl > 0 || ps.blk > 0
    );

    // 计算总数据
    const totalPoints = playerStats.reduce((sum, ps) => sum + ps.points, 0);
    const totalRebounds = playerStats.reduce((sum, ps) => sum + ps.reb, 0);
    const totalAssists = playerStats.reduce((sum, ps) => sum + ps.ast, 0);
    const totalTurnovers = playerStats.reduce((sum, ps) => sum + ps.tov, 0);
    const totalSteals = playerStats.reduce((sum, ps) => sum + ps.stl, 0);
    const totalBlocks = playerStats.reduce((sum, ps) => sum + ps.blk, 0);

    // 计算每节得分
    const quarterPoints: number[] = [];
    const maxQuarter = Math.max(...allStats.map(s => s.quarter), 0);
    for (let q = 1; q <= maxQuarter; q++) {
      const quarterStats = allStats.filter(s => s.quarter === q && playerStatsMap[s.player_id]);
      const quarterPointsForQ = quarterStats.reduce((sum, stat) => {
        const playerStat = playerStatsMap[stat.player_id];
        if (!playerStat) return sum;
        if (stat.action_type === '2PM') return sum + 2;
        if (stat.action_type === '3PM') return sum + 3;
        if (stat.action_type === 'FTM') return sum + 1;
        return sum;
      }, 0);
      quarterPoints.push(quarterPointsForQ);
    }

    // 计算其他统计数据（简化版本）
    const pointsOffTurnovers = 0; // TODO: 需要根据失误后的得分计算
    const pointsInPaint = 0; // TODO: 需要根据投篮位置计算
    const secondChancePoints = 0; // TODO: 需要根据进攻篮板后的得分计算
    const fastBreakPoints = 0; // TODO: 需要根据快攻统计计算
    
    // 计算首发和替补得分（前5个球员为首发）
    const sortedPlayers = [...playerStats].sort((a, b) => (a.player.display_order || 0) - (b.player.display_order || 0));
    const starters = sortedPlayers.slice(0, 5);
    const bench = sortedPlayers.slice(5);
    const startersPoints = starters.reduce((sum, ps) => sum + ps.points, 0);
    const benchPoints = bench.reduce((sum, ps) => sum + ps.points, 0);

    // 计算命中率
    const totalFGM = playerStats.reduce((sum, ps) => sum + ps.fgm, 0);
    const totalFGA = playerStats.reduce((sum, ps) => sum + ps.fga, 0);
    const totalFG3M = playerStats.reduce((sum, ps) => sum + ps.fg3m, 0);
    const totalFG3A = playerStats.reduce((sum, ps) => sum + ps.fg3a, 0);
    const totalFG2M = playerStats.reduce((sum, ps) => sum + ps.fg2m, 0);
    const totalFG2A = playerStats.reduce((sum, ps) => sum + ps.fg2a, 0);
    const totalFTM = playerStats.reduce((sum, ps) => sum + ps.ftm, 0);
    const totalFTA = playerStats.reduce((sum, ps) => sum + ps.fta, 0);

    const fieldGoalPercentage = totalFGA > 0 ? (totalFGM / totalFGA) * 100 : 0;
    const threePointPercentage = totalFG3A > 0 ? (totalFG3M / totalFG3A) * 100 : 0;
    const twoPointPercentage = totalFG2A > 0 ? (totalFG2M / totalFG2A) * 100 : 0;
    const freeThrowPercentage = totalFTA > 0 ? (totalFTM / totalFTA) * 100 : 0;

    return {
      team,
      players: playerStats,
      totalPoints,
      totalRebounds,
      totalAssists,
      totalTurnovers,
      totalSteals,
      totalBlocks,
      quarterPoints,
      pointsOffTurnovers,
      pointsInPaint,
      secondChancePoints,
      fastBreakPoints,
      startersPoints,
      benchPoints,
      fieldGoalPercentage,
      threePointPercentage,
      twoPointPercentage,
      freeThrowPercentage,
    };
  };

  const calculateGameSummary = (
    homeStats: TeamStats,
    awayStats: TeamStats,
    homePlayers: Player[],
    awayPlayers: Player[],
    allStats: Statistic[],
    homePlayerIds: number[],
    _awayPlayerIds: number[]
  ): GameSummary => {
    // 计算球队领袖
    const homeLeaders = {
      points: homeStats.players.reduce((max, ps) => ps.points > max.value ? { player: ps.player, value: ps.points } : max, { player: homePlayers[0] || { id: 0, name: '', number: 0, team_id: 0 } as Player, value: 0 }),
      assists: homeStats.players.reduce((max, ps) => ps.ast > max.value ? { player: ps.player, value: ps.ast } : max, { player: homePlayers[0] || { id: 0, name: '', number: 0, team_id: 0 } as Player, value: 0 }),
      rebounds: homeStats.players.reduce((max, ps) => ps.reb > max.value ? { player: ps.player, value: ps.reb } : max, { player: homePlayers[0] || { id: 0, name: '', number: 0, team_id: 0 } as Player, value: 0 }),
      efficiency: homeStats.players.reduce((max, ps) => {
        const eff = ps.points + ps.reb + ps.ast + ps.stl + ps.blk - (ps.fga - ps.fgm) - (ps.fta - ps.ftm) - ps.tov - ps.pf;
        return eff > max.value ? { player: ps.player, value: eff } : max;
      }, { player: homePlayers[0] || { id: 0, name: '', number: 0, team_id: 0 } as Player, value: 0 }),
    };

    const awayLeaders = {
      points: awayStats.players.reduce((max, ps) => ps.points > max.value ? { player: ps.player, value: ps.points } : max, { player: awayPlayers[0] || { id: 0, name: '', number: 0, team_id: 0 } as Player, value: 0 }),
      assists: awayStats.players.reduce((max, ps) => ps.ast > max.value ? { player: ps.player, value: ps.ast } : max, { player: awayPlayers[0] || { id: 0, name: '', number: 0, team_id: 0 } as Player, value: 0 }),
      rebounds: awayStats.players.reduce((max, ps) => ps.reb > max.value ? { player: ps.player, value: ps.reb } : max, { player: awayPlayers[0] || { id: 0, name: '', number: 0, team_id: 0 } as Player, value: 0 }),
      efficiency: awayStats.players.reduce((max, ps) => {
        const eff = ps.points + ps.reb + ps.ast + ps.stl + ps.blk - (ps.fga - ps.fgm) - (ps.fta - ps.ftm) - ps.tov - ps.pf;
        return eff > max.value ? { player: ps.player, value: eff } : max;
      }, { player: awayPlayers[0] || { id: 0, name: '', number: 0, team_id: 0 } as Player, value: 0 }),
    };

    // 计算累积得分曲线（按时间顺序）
    const scoreProgression: ScorePoint[] = [];
    let homeCumulativeScore = 0;
    let awayCumulativeScore = 0;
    let playIndex = 0;

    // 按时间戳排序统计数据
    const sortedStats = [...allStats].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    // 初始点
    scoreProgression.push({ x: 0, homeScore: 0, awayScore: 0 });

    sortedStats.forEach((stat) => {
      const isHomePlayer = homePlayerIds.includes(stat.player_id);
      let points = 0;
      
      if (stat.action_type === '2PM') points = 2;
      else if (stat.action_type === '3PM') points = 3;
      else if (stat.action_type === 'FTM') points = 1;

      if (points > 0) {
        if (isHomePlayer) {
          homeCumulativeScore += points;
        } else {
          awayCumulativeScore += points;
        }
        playIndex++;
        scoreProgression.push({
          x: playIndex,
          homeScore: homeCumulativeScore,
          awayScore: awayCumulativeScore,
        });
      }
    });

    return {
      homeQuarterPoints: homeStats.quarterPoints,
      awayQuarterPoints: awayStats.quarterPoints,
      homeLeaders,
      awayLeaders,
      scoreProgression,
    };
  };

  const formatPercentage = (made: number, attempted: number) => {
    if (attempted === 0) return '0.0%';
    return ((made / attempted) * 100).toFixed(1) + '%';
  };

  const getCurrentTeamStats = () => {
    return selectedTeam === 'home' ? homeStats : awayStats;
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

  if (!game || !homeTeam || !awayTeam || !homeStats || !awayStats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">比赛数据加载失败</p>
      </div>
    );
  }

  const currentStats = getCurrentTeamStats();
  
  if (!currentStats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">统计数据加载失败</p>
      </div>
    );
  }

  const handleExportPDF = async () => {
    try {
      const { exportGameReportToPDF } = await import('../utils/pdfExport');
      const filename = `${homeTeam.name}_vs_${awayTeam.name}_${new Date(game.date).toLocaleDateString('zh-CN').replace(/\//g, '-')}`;
      await exportGameReportToPDF('game-report-content', filename);
    } catch (error) {
      console.error('导出PDF失败:', error);
      alert('导出PDF失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/games')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← 返回比赛记录
            </button>
            <h1 className="text-xl font-bold text-gray-800">
              {homeTeam.name} vs {awayTeam.name}
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                导出PDF
              </button>
              <div className="text-sm text-gray-500">
                {new Date(game.date).toLocaleDateString('zh-CN')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="game-report-content">
      {/* 比分摘要 */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{homeTeam.name}</div>
              <div className="text-3xl font-bold mt-2">{homeStats.totalPoints}</div>
            </div>
            <div className="text-gray-400 text-xl">VS</div>
            <div>
              <div className="text-2xl font-bold text-red-600">{awayTeam.name}</div>
              <div className="text-3xl font-bold mt-2">{awayStats.totalPoints}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 比赛整体统计 */}
      {gameSummary && (
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 得分表格 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-center text-sm">得分</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5"></th>
                      {gameSummary.homeQuarterPoints.map((_, i) => (
                        <th key={i} className="text-center py-1.5">Q{i + 1}</th>
                      ))}
                      <th className="text-center py-1.5">总分</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-medium py-1.5 text-xs">{homeTeam.name}</td>
                      {gameSummary.homeQuarterPoints.map((pts, i) => (
                        <td key={i} className="text-center py-1.5">{pts}</td>
                      ))}
                      <td className="text-center font-bold py-1.5">{homeStats.totalPoints}</td>
                    </tr>
                    <tr>
                      <td className="font-medium py-1.5 text-xs">{awayTeam.name}</td>
                      {gameSummary.awayQuarterPoints.map((pts, i) => (
                        <td key={i} className="text-center py-1.5">{pts}</td>
                      ))}
                      <td className="text-center font-bold py-1.5">{awayStats.totalPoints}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 球队领袖 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-center text-sm">球队领袖</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5"></th>
                      <th className="text-center py-1.5">{homeTeam.name}</th>
                      <th className="text-center py-1.5">{awayTeam.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-medium py-1.5">得分</td>
                      <td className="text-center py-1.5">
                        {gameSummary.homeLeaders.points.player.name} ({gameSummary.homeLeaders.points.value})
                      </td>
                      <td className="text-center py-1.5">
                        {gameSummary.awayLeaders.points.player.name} ({gameSummary.awayLeaders.points.value})
                      </td>
                    </tr>
                    <tr>
                      <td className="font-medium py-1.5">助攻</td>
                      <td className="text-center py-1.5">
                        {gameSummary.homeLeaders.assists.player.name} ({gameSummary.homeLeaders.assists.value})
                      </td>
                      <td className="text-center py-1.5">
                        {gameSummary.awayLeaders.assists.player.name} ({gameSummary.awayLeaders.assists.value})
                      </td>
                    </tr>
                    <tr>
                      <td className="font-medium py-1.5">篮板</td>
                      <td className="text-center py-1.5">
                        {gameSummary.homeLeaders.rebounds.player.name} ({gameSummary.homeLeaders.rebounds.value})
                      </td>
                      <td className="text-center py-1.5">
                        {gameSummary.awayLeaders.rebounds.player.name} ({gameSummary.awayLeaders.rebounds.value})
                      </td>
                    </tr>
                    <tr>
                      <td className="font-medium py-1.5">效率</td>
                      <td className="text-center py-1.5">
                        {gameSummary.homeLeaders.efficiency.player.name} ({gameSummary.homeLeaders.efficiency.value})
                      </td>
                      <td className="text-center py-1.5">
                        {gameSummary.awayLeaders.efficiency.player.name} ({gameSummary.awayLeaders.efficiency.value})
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* 得分曲线图和球队对比看板 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* 得分曲线图 */}
              <div className="lg:col-span-2">
                <ScoreChart
                  data={gameSummary.scoreProgression}
                  homeTeamName={homeTeam.name}
                  awayTeamName={awayTeam.name}
                  width={800}
                  height={300}
                />
              </div>

              {/* 球队对比看板 */}
              {homeStats && awayStats && (
                <div className="lg:col-span-1">
                  <TeamComparisonBoard
                  homeTeamName={homeTeam.name}
                  awayTeamName={awayTeam.name}
                  homeStats={{
                    totalPoints: homeStats.totalPoints,
                    pointsOffTurnovers: homeStats.pointsOffTurnovers,
                    pointsInPaint: homeStats.pointsInPaint,
                    secondChancePoints: homeStats.secondChancePoints,
                    fastBreakPoints: homeStats.fastBreakPoints,
                    startersPoints: homeStats.startersPoints,
                    benchPoints: homeStats.benchPoints,
                    totalRebounds: homeStats.totalRebounds,
                    totalAssists: homeStats.totalAssists,
                    totalTurnovers: homeStats.totalTurnovers,
                    totalSteals: homeStats.totalSteals,
                    totalBlocks: homeStats.totalBlocks,
                    fieldGoalPercentage: homeStats.fieldGoalPercentage,
                    threePointPercentage: homeStats.threePointPercentage,
                    twoPointPercentage: homeStats.twoPointPercentage,
                    freeThrowPercentage: homeStats.freeThrowPercentage,
                  }}
                  awayStats={{
                    totalPoints: awayStats.totalPoints,
                    pointsOffTurnovers: awayStats.pointsOffTurnovers,
                    pointsInPaint: awayStats.pointsInPaint,
                    secondChancePoints: awayStats.secondChancePoints,
                    fastBreakPoints: awayStats.fastBreakPoints,
                    startersPoints: awayStats.startersPoints,
                    benchPoints: awayStats.benchPoints,
                    totalRebounds: awayStats.totalRebounds,
                    totalAssists: awayStats.totalAssists,
                    totalTurnovers: awayStats.totalTurnovers,
                    totalSteals: awayStats.totalSteals,
                    totalBlocks: awayStats.totalBlocks,
                    fieldGoalPercentage: awayStats.fieldGoalPercentage,
                    threePointPercentage: awayStats.threePointPercentage,
                    twoPointPercentage: awayStats.twoPointPercentage,
                    freeThrowPercentage: awayStats.freeThrowPercentage,
                  }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 球队切换 */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTeam('home')}
              className={`px-6 py-3 font-semibold ${
                selectedTeam === 'home'
                  ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {homeTeam.name}
            </button>
            <button
              onClick={() => setSelectedTeam('away')}
              className={`px-6 py-3 font-semibold ${
                selectedTeam === 'away'
                  ? 'bg-red-600 text-white border-b-2 border-red-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {awayTeam.name}
            </button>
          </div>
        </div>
      </div>

      {/* 球队统计摘要 */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-500">得分</div>
              <div className="text-xl font-bold">{currentStats.totalPoints}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">篮板</div>
              <div className="text-xl font-bold">{currentStats.totalRebounds}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">助攻</div>
              <div className="text-xl font-bold">{currentStats.totalAssists}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">失误</div>
              <div className="text-xl font-bold">{currentStats.totalTurnovers}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 球员统计表 */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">球员</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">时间</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">得分</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">投篮</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">三分</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">两分</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">罚球</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">篮板</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">助攻</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">抢断</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">盖帽</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">失误</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">犯规</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentStats.players.map((ps) => (
                  <tr
                    key={ps.player.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedPlayer?.id === ps.player.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedPlayer(ps.player)}
                  >
                    <td className="px-3 py-3 text-sm font-semibold">{ps.player.number}</td>
                    <td className="px-3 py-3 text-sm font-medium">{ps.player.name}</td>
                    <td className="px-3 py-3 text-sm text-center">{ps.minutes}</td>
                    <td className="px-3 py-3 text-sm text-center font-bold">{ps.points}</td>
                    <td className="px-3 py-3 text-sm text-center">
                      {ps.fgm}/{ps.fga}
                      <div className="text-xs text-gray-500">{formatPercentage(ps.fgm, ps.fga)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-center">
                      {ps.fg3m}/{ps.fg3a}
                      <div className="text-xs text-gray-500">{formatPercentage(ps.fg3m, ps.fg3a)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-center">
                      {ps.fg2m}/{ps.fg2a}
                      <div className="text-xs text-gray-500">{formatPercentage(ps.fg2m, ps.fg2a)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-center">
                      {ps.ftm}/{ps.fta}
                      <div className="text-xs text-gray-500">{formatPercentage(ps.ftm, ps.fta)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-center">{ps.reb}</td>
                    <td className="px-3 py-3 text-sm text-center">{ps.ast}</td>
                    <td className="px-3 py-3 text-sm text-center">{ps.stl}</td>
                    <td className="px-3 py-3 text-sm text-center">{ps.blk}</td>
                    <td className="px-3 py-3 text-sm text-center">{ps.tov}</td>
                    <td className="px-3 py-3 text-sm text-center">{ps.pf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 球员出手点热区图 */}
        {selectedPlayer && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                #{selectedPlayer.number} {selectedPlayer.name} - 出手点分布
              </h2>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            {(() => {
              const playerStat = currentStats.players.find((ps) => ps.player.id === selectedPlayer.id);
              if (!playerStat || playerStat.shots.length === 0) {
                return (
                  <div className="text-center py-12 text-gray-400">
                    <p>该球员本场比赛没有投篮记录</p>
                  </div>
                );
              }
              return (
                <div>
                  <ShotChart shots={playerStat.shots} playerName={`${selectedPlayer.number} ${selectedPlayer.name}`} />
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">总出手:</span> {playerStat.shots.length}次
                    </div>
                    <div>
                      <span className="font-semibold">命中:</span>{' '}
                      {playerStat.shots.filter((s) => s.made).length}次
                    </div>
                    <div>
                      <span className="font-semibold">命中率:</span>{' '}
                      {formatPercentage(
                        playerStat.shots.filter((s) => s.made).length,
                        playerStat.shots.length
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">三分出手:</span>{' '}
                      {playerStat.shots.filter((s) => s.type === '3PM' || s.type === '3PA').length}次
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default GameReport;

