import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamsApi, playersApi, gamesApi, leaguesApi } from '../utils/api';
import { Team, Player, League } from '../types';
import { useAuth } from '../contexts/AuthContext';

function GameSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [selectedHomePlayers, setSelectedHomePlayers] = useState<number[]>([]);
  const [selectedAwayPlayers, setSelectedAwayPlayers] = useState<number[]>([]);
  const [duration, setDuration] = useState(40);
  const [quarters, setQuarters] = useState(4);
  const [gameDate, setGameDate] = useState(new Date().toISOString().slice(0, 16));
  const [seasonType, setSeasonType] = useState<'regular' | 'playoff'>('regular');
  const [league, setLeague] = useState<League | null>(null);

  useEffect(() => {
    loadTeams();
    if (user?.league_id) {
      leaguesApi.getById(user.league_id)
        .then((response) => {
          setLeague(response.data);
        })
        .catch((error) => {
          console.error('加载联赛信息失败:', error);
        });
    }
  }, [user]);

  useEffect(() => {
    if (homeTeam) {
      loadPlayers(homeTeam.id, true);
    }
  }, [homeTeam]);

  useEffect(() => {
    if (awayTeam) {
      loadPlayers(awayTeam.id, false);
    }
  }, [awayTeam]);

  const loadTeams = async () => {
    try {
      const response = await teamsApi.getAll();
      setTeams(response.data);
    } catch (error) {
      console.error('加载球队失败:', error);
    }
  };

  const loadPlayers = async (teamId: number, isHome: boolean) => {
    try {
      const response = await playersApi.getByTeam(teamId);
      const players = response.data;
      if (isHome) {
        setHomePlayers(players);
        // 默认选择前5个首发球员
        const defaultSelected = players.slice(0, 5).map((p: Player) => p.id);
        setSelectedHomePlayers(defaultSelected);
      } else {
        setAwayPlayers(players);
        // 默认选择前5个首发球员
        const defaultSelected = players.slice(0, 5).map((p: Player) => p.id);
        setSelectedAwayPlayers(defaultSelected);
      }
    } catch (error) {
      console.error('加载球员失败:', error);
    }
  };

  const togglePlayer = (playerId: number, isHome: boolean) => {
    if (isHome) {
      setSelectedHomePlayers((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    } else {
      setSelectedAwayPlayers((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    }
  };

  const handleStartGame = async () => {
    if (!homeTeam || !awayTeam) {
      alert('请选择主队和客队');
      return;
    }

    if (selectedHomePlayers.length === 0 || selectedAwayPlayers.length === 0) {
      alert('请至少为每队选择一名球员');
      return;
    }

    try {
      const response = await gamesApi.create({
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        date: gameDate,
        duration,
        quarters,
        season_type: seasonType,
        player_ids: [...selectedHomePlayers, ...selectedAwayPlayers],
      });

      const gameId = response.data.id;
      navigate(`/game/${gameId}`);
    } catch (error) {
      console.error('创建比赛失败:', error);
      alert('创建比赛失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">比赛设置</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← 返回
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* 主队选择 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">主队</h2>
            <select
              value={homeTeam?.id || ''}
              onChange={(e) => {
                const team = teams.find((t) => t.id === Number(e.target.value));
                setHomeTeam(team || null);
                setSelectedHomePlayers([]);
              }}
              className="w-full p-2 border rounded mb-4"
            >
              <option value="">选择主队</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            {homeTeam && (
              <div>
                <h3 className="font-medium mb-2">选择出场球员 (至少5名)</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {homePlayers.map((player) => (
                    <label
                      key={player.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedHomePlayers.includes(player.id)}
                        onChange={() => togglePlayer(player.id, true)}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-800">
                        #{player.number} {player.name}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  已选择: {selectedHomePlayers.length} 名
                </p>
              </div>
            )}
          </div>

          {/* 客队选择 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-600">客队</h2>
            <select
              value={awayTeam?.id || ''}
              onChange={(e) => {
                const team = teams.find((t) => t.id === Number(e.target.value));
                setAwayTeam(team || null);
                setSelectedAwayPlayers([]);
              }}
              className="w-full p-2 border rounded mb-4"
            >
              <option value="">选择客队</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            {awayTeam && (
              <div>
                <h3 className="font-medium mb-2">选择出场球员 (至少5名)</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {awayPlayers.map((player) => (
                    <label
                      key={player.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAwayPlayers.includes(player.id)}
                        onChange={() => togglePlayer(player.id, false)}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-800">
                        #{player.number} {player.name}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  已选择: {selectedAwayPlayers.length} 名
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 比赛配置 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">比赛配置</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">比赛日期</label>
              <input
                type="datetime-local"
                value={gameDate}
                onChange={(e) => setGameDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">比赛类型</label>
              <select
                value={seasonType}
                onChange={(e) => setSeasonType(e.target.value as 'regular' | 'playoff')}
                className="w-full p-2 border rounded"
              >
                <option value="regular">{league?.regular_season_name || '小组赛'}</option>
                <option value="playoff">{league?.playoff_name || '季后赛'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">比赛时长 (分钟)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full p-2 border rounded"
              >
                <option value={10}>10分钟</option>
                <option value={12}>12分钟</option>
                <option value={40}>40分钟</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">节数</label>
              <select
                value={quarters}
                onChange={(e) => setQuarters(Number(e.target.value))}
                className="w-full p-2 border rounded"
              >
                <option value={2}>2节</option>
                <option value={4}>4节</option>
              </select>
            </div>
          </div>
        </div>

        {/* 开始比赛按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleStartGame}
            disabled={!homeTeam || !awayTeam || selectedHomePlayers.length === 0 || selectedAwayPlayers.length === 0}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            开始比赛
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameSetup;

