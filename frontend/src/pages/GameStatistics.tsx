import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gamesApi, statisticsApi, teamsApi, playersApi, playerTimeApi } from '../utils/api';
import { Game, Player, Statistic, ActionType } from '../types';
import PlayerAvatar from '../components/PlayerAvatar';
import ActionButton from '../components/ActionButton';
import Court from '../components/Court';
import ShotLocationModal from '../components/ShotLocationModal';
import FreeThrowModal from '../components/FreeThrowModal';
import PlayerStatsTable from '../components/PlayerStatsTable';
import SubstitutionModal from '../components/SubstitutionModal';

function GameStatistics() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [homeTeam, setHomeTeam] = useState<any>(null);
  const [awayTeam, setAwayTeam] = useState<any>(null);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [statistics, setStatistics] = useState<Statistic[]>([]);
  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [showShotModal, setShowShotModal] = useState(false);
  const [showFreeThrowModal, setShowFreeThrowModal] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [quarterTime, setQuarterTime] = useState(600); // 每节10分钟，单位：秒
  const [isRunning, setIsRunning] = useState(false);
  const [onCourtPlayers, setOnCourtPlayers] = useState<Set<number>>(new Set());
  const [playerTimes, setPlayerTimes] = useState<{ [key: number]: number }>({});
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substitutionTeam, setSubstitutionTeam] = useState<'home' | 'away'>('home');

  useEffect(() => {
    if (gameId) {
      loadGame();
      loadStatistics();
    }
  }, [gameId]);

  useEffect(() => {
    // 定期刷新统计数据
    const interval = setInterval(() => {
      if (gameId) {
        loadStatistics();
        loadPlayerTimes();
      }
    }, 2000); // 每2秒刷新一次

    return () => clearInterval(interval);
  }, [gameId]);

  useEffect(() => {
    if (gameId && isRunning) {
      loadPlayerTimes();
    }
  }, [gameId, isRunning, gameTime]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && game) {
      interval = setInterval(() => {
        setGameTime((prev) => prev + 1);
        setQuarterTime((prev) => {
          if (prev <= 0) {
            return 0; // 时间到
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, game]);

  const loadGame = async () => {
    if (!gameId) return;
    try {
      const gameResponse = await gamesApi.getById(Number(gameId));
      const gameData = gameResponse.data;
      setGame(gameData);

      const [homeResponse, awayResponse] = await Promise.all([
        teamsApi.getById(gameData.home_team_id),
        teamsApi.getById(gameData.away_team_id),
      ]);
      setHomeTeam(homeResponse.data);
      setAwayTeam(awayResponse.data);

      const [homePlayersResponse, awayPlayersResponse] = await Promise.all([
        playersApi.getByTeam(gameData.home_team_id),
        playersApi.getByTeam(gameData.away_team_id),
      ]);
      setHomePlayers(homePlayersResponse.data);
      setAwayPlayers(awayPlayersResponse.data);
    } catch (error) {
      console.error('加载比赛失败:', error);
    }
  };

  const loadStatistics = async () => {
    if (!gameId) return;
    try {
      const response = await statisticsApi.getByGame(Number(gameId));
      setStatistics(response.data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const loadPlayerTimes = async () => {
    if (!gameId) return;
    try {
      const response = await playerTimeApi.getAll(Number(gameId));
      setPlayerTimes(response.data.times || {});
      setOnCourtPlayers(new Set(response.data.on_court || []));
    } catch (error) {
      console.error('加载出场时间失败:', error);
    }
  };

  const handlePlayerToggle = async (_player: Player, isHome: boolean) => {
    // 打开替换对话框
    setSubstitutionTeam(isHome ? 'home' : 'away');
    setShowSubstitutionModal(true);
  };

  const handleSubstitution = async (subOutPlayerId: number, subInPlayerId: number) => {
    if (!gameId) return;
    
    try {
      // 被替换球员下场
      await playerTimeApi.exit(Number(gameId), subOutPlayerId);
      setOnCourtPlayers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(subOutPlayerId);
        return newSet;
      });

      // 替换球员上场
      await playerTimeApi.enter(Number(gameId), subInPlayerId, currentQuarter);
      setOnCourtPlayers((prev) => new Set(prev).add(subInPlayerId));

      // 记录替换事件
      await statisticsApi.create({
        game_id: Number(gameId),
        player_id: subOutPlayerId,
        quarter: currentQuarter,
        action_type: 'SUB_OUT',
      });
      await statisticsApi.create({
        game_id: Number(gameId),
        player_id: subInPlayerId,
        quarter: currentQuarter,
        action_type: 'SUB_IN',
      });

      await loadPlayerTimes();
      await loadStatistics();
      setShowSubstitutionModal(false);
    } catch (error) {
      console.error('替换球员失败:', error);
      alert('操作失败，请重试');
    }
  };

  const formatPlayTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateTeamScore = (teamPlayers: Player[]) => {
    return statistics
      .filter((s) => teamPlayers.some((p) => p.id === s.player_id))
      .reduce((score, stat) => {
        if (stat.action_type === '2PM') return score + 2;
        if (stat.action_type === '3PM') return score + 3;
        if (stat.action_type === 'FTM') return score + 1;
        return score;
      }, 0);
  };

  const handleActionClick = (player: Player, action: ActionType) => {
    setSelectedPlayer(player);
    setSelectedAction(action);

    // 判断动作类型
    if (action === 'FTM' || action === 'FTA') {
      // 罚球，直接弹出选择对话框
      setShowFreeThrowModal(true);
    } else if (action === '2PM' || action === '2PA' || action === '3PM' || action === '3PA') {
      // 2分或3分，弹出球场标记对话框
      setShowShotModal(true);
    } else {
      // 其他动作，直接记录
      recordStatistic(player, action);
    }
  };

  const recordStatistic = async (
    player: Player,
    action: ActionType,
    extraData?: {
      assistedBy?: number;
      reboundedBy?: number;
    }
  ) => {
    if (!gameId) return;

    try {
      await statisticsApi.create({
        game_id: Number(gameId),
        player_id: player.id,
        quarter: currentQuarter,
        action_type: action,
      });

      // 如果有助攻，记录助攻
      if (extraData?.assistedBy) {
        await statisticsApi.create({
          game_id: Number(gameId),
          player_id: extraData.assistedBy,
          quarter: currentQuarter,
          action_type: 'AST',
        });
      }

      // 如果有篮板，记录篮板
      if (extraData?.reboundedBy) {
        const reboundType = extraData.reboundedBy === player.id ? 'OREB' : 'DREB';
        await statisticsApi.create({
          game_id: Number(gameId),
          player_id: extraData.reboundedBy,
          quarter: currentQuarter,
          action_type: reboundType,
        });
      }

      // 刷新统计数据
      await loadStatistics();
      setSelectedPlayer(null);
      setSelectedAction(null);
    } catch (error) {
      console.error('记录统计失败:', error);
      alert('记录统计失败，请重试');
    }
  };

  const handleShotConfirm = async (data: {
    x: number;
    y: number;
    assistedBy?: number;
    reboundedBy?: number;
    teamReboundTeamId?: number; // 团队篮板所属球队ID（球出界情况）
  }) => {
    if (!selectedPlayer || !selectedAction || !gameId) return;

    // selectedAction已经是正确的动作类型（2PM, 2PA, 3PM, 3PA）
    const actualAction = selectedAction;

    try {
      // 记录投篮统计（包含位置信息）
      await statisticsApi.create({
        game_id: Number(gameId),
        player_id: selectedPlayer.id,
        quarter: currentQuarter,
        action_type: actualAction,
        shot_x: data.x,
        shot_y: data.y,
        assisted_by_player_id: data.assistedBy || null,
        rebounded_by_player_id: data.reboundedBy || null,
      });

      // 如果有助攻，记录助攻
      if (data.assistedBy) {
        await statisticsApi.create({
          game_id: Number(gameId),
          player_id: data.assistedBy,
          quarter: currentQuarter,
          action_type: 'AST',
        });
      }

      // 如果有球员篮板，记录篮板
      if (data.reboundedBy) {
        // 判断是进攻篮板还是防守篮板
        // 如果抢篮板的是投篮球员本人，是进攻篮板；否则是防守篮板
        const isOffensiveRebound = data.reboundedBy === selectedPlayer.id;
        const reboundType = isOffensiveRebound ? 'OREB' : 'DREB';
        await statisticsApi.create({
          game_id: Number(gameId),
          player_id: data.reboundedBy,
          quarter: currentQuarter,
          action_type: reboundType,
        });
      }

      // 如果是团队篮板（球出界）
      if (data.teamReboundTeamId && !data.reboundedBy) {
        // 判断是进攻篮板还是防守篮板
        // 如果团队篮板所属球队是投篮球员的球队，是进攻篮板；否则是防守篮板
        const isOffensiveRebound = data.teamReboundTeamId === selectedPlayer.team_id;
        const reboundType = isOffensiveRebound ? 'OREB' : 'DREB';
        
        // 找到该队的第一个场上球员来记录团队篮板（或者使用一个特殊标记）
        // 这里我们使用该队的第一个球员作为代表，但 rebounded_by_player_id 为 null 表示团队篮板
        const teamPlayers = data.teamReboundTeamId === game?.home_team_id ? homePlayers : awayPlayers;
        const onCourtTeamPlayers = teamPlayers.filter(p => onCourtPlayers.has(p.id));
        
        if (onCourtTeamPlayers.length > 0) {
          // 使用该队第一个场上球员作为代表记录团队篮板
          // 注意：rebounded_by_player_id 为 null 表示这是团队篮板
          await statisticsApi.create({
            game_id: Number(gameId),
            player_id: onCourtTeamPlayers[0].id, // 使用第一个球员作为代表
            quarter: currentQuarter,
            action_type: reboundType,
            rebounded_by_player_id: null, // null 表示团队篮板
          });
        }
      }

      // 刷新统计数据
      await loadStatistics();
      setSelectedPlayer(null);
      setSelectedAction(null);
      setShowShotModal(false);
    } catch (error) {
      console.error('记录统计失败:', error);
      alert('记录统计失败，请重试');
    }
  };

  const handleFreeThrowConfirm = (isMade: boolean) => {
    if (!selectedPlayer || !selectedAction) return;

    const actualAction = isMade ? 'FTM' : 'FTA';
    recordStatistic(selectedPlayer, actualAction);

    setShowFreeThrowModal(false);
  };

  const handleStart = async () => {
    if (!gameId) return;
    try {
      await gamesApi.start(Number(gameId));
      setIsRunning(true);
      
      // 自动将前5个首发球员设为上场状态
      const homeStarters = homePlayers.slice(0, 5);
      const awayStarters = awayPlayers.slice(0, 5);
      
      for (const player of [...homeStarters, ...awayStarters]) {
        try {
          await playerTimeApi.enter(Number(gameId), player.id, currentQuarter);
          setOnCourtPlayers((prev) => new Set(prev).add(player.id));
        } catch (error) {
          console.error(`设置球员 ${player.name} 上场失败:`, error);
        }
      }
      
      await loadPlayerTimes();
      loadGame();
    } catch (error) {
      console.error('开始比赛失败:', error);
    }
  };

  const handlePause = async () => {
    if (!gameId) return;
    try {
      await gamesApi.pause(Number(gameId));
      setIsRunning(false);
      loadGame();
    } catch (error) {
      console.error('暂停比赛失败:', error);
    }
  };


  const formatQuarterTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleQuarterChange = (quarter: number) => {
    setCurrentQuarter(quarter);
    setQuarterTime(600); // 重置为10分钟
  };

  const handleTimeAdjust = (seconds: number) => {
    setQuarterTime((prev) => Math.max(0, prev + seconds));
  };

  const handleFinish = async () => {
    if (!gameId) return;
    if (!confirm('确定要结束比赛吗？')) return;
    
    try {
      await gamesApi.finish(Number(gameId));
      setIsRunning(false);
      loadGame();
      alert('比赛已结束');
    } catch (error) {
      console.error('结束比赛失败:', error);
      alert('结束比赛失败，请重试');
    }
  };

  if (!game || !homeTeam || !awayTeam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  const homeScore = calculateTeamScore(homePlayers);
  const awayScore = calculateTeamScore(awayPlayers);
  const allPlayers = [...homePlayers, ...awayPlayers];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← 返回
            </button>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {homeTeam.name} vs {awayTeam.name}
              </div>
              <div className="text-sm text-gray-500">
                {new Date(game.date).toLocaleDateString()}
              </div>
            </div>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      {/* 比分板 */}
      <div className="bg-blue-600 text-white py-4">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <div className="text-sm">主队</div>
              <div className="text-3xl font-bold">{homeTeam.name}</div>
              <div className="text-4xl font-bold mt-2">{homeScore}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">{formatQuarterTime(quarterTime)}</div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <button
                  onClick={() => handleQuarterChange(Math.max(1, currentQuarter - 1))}
                  className="px-2 py-1 bg-white text-blue-600 rounded text-xs hover:bg-gray-100"
                  disabled={currentQuarter <= 1}
                >
                  ←
                </button>
                <div className="text-sm">第 {currentQuarter} 节</div>
                <button
                  onClick={() => handleQuarterChange(Math.min(game.quarters, currentQuarter + 1))}
                  className="px-2 py-1 bg-white text-blue-600 rounded text-xs hover:bg-gray-100"
                  disabled={currentQuarter >= game.quarters}
                >
                  →
                </button>
              </div>
              <div className="flex items-center justify-center gap-1 mb-2">
                <button
                  onClick={() => handleTimeAdjust(-10)}
                  className="px-2 py-1 bg-white text-blue-600 rounded text-xs hover:bg-gray-100"
                >
                  -10s
                </button>
                <button
                  onClick={() => handleTimeAdjust(10)}
                  className="px-2 py-1 bg-white text-blue-600 rounded text-xs hover:bg-gray-100"
                >
                  +10s
                </button>
              </div>
              <div className="flex justify-center gap-2 mt-2">
                <button
                  onClick={isRunning ? handlePause : handleStart}
                  className="px-4 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100"
                >
                  {isRunning ? '⏸ 暂停' : '▶ 开始'}
                </button>
                <button
                  onClick={handleFinish}
                  className="px-4 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  结束
                </button>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm">客队</div>
              <div className="text-3xl font-bold">{awayTeam.name}</div>
              <div className="text-4xl font-bold mt-2">{awayScore}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* 左侧：主队球员 */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-blue-600 mb-4">主队球员</h3>
            
            {/* 上场球员 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-green-600 mb-2">上场 ({homePlayers.filter(p => onCourtPlayers.has(p.id)).length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {homePlayers
                  .filter((player) => onCourtPlayers.has(player.id))
                  .map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center space-x-3 p-2 rounded cursor-pointer border-2 border-green-500 bg-green-50 ${
                        selectedPlayer?.id === player.id ? 'bg-blue-100 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <PlayerAvatar
                        player={player}
                        isHome={true}
                        size="sm"
                        draggable={false}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">#{player.number} {player.name}</div>
                        <div className="text-xs text-gray-600">
                          {formatPlayTime(playerTimes[player.id] || 0)} |{' '}
                          {statistics
                            .filter((s) => s.player_id === player.id)
                            .reduce((pts, s) => {
                              if (s.action_type === '2PM') return pts + 2;
                              if (s.action_type === '3PM') return pts + 3;
                              if (s.action_type === 'FTM') return pts + 1;
                              return pts;
                            }, 0)}{' '}
                          Pts |{' '}
                          {statistics.filter((s) => s.player_id === player.id && s.action_type === 'AST').length}{' '}
                          Ast |{' '}
                          {statistics.filter((s) => s.player_id === player.id && (s.action_type === 'OREB' || s.action_type === 'DREB')).length}{' '}
                          Reb
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayerToggle(player, false);
                        }}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        替换
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* 场下球员 */}
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">场下 ({homePlayers.filter(p => !onCourtPlayers.has(p.id)).length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {homePlayers
                  .filter((player) => !onCourtPlayers.has(player.id))
                  .map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border ${
                        selectedPlayer?.id === player.id ? 'bg-blue-100 border-blue-500' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <PlayerAvatar
                        player={player}
                        isHome={true}
                        size="sm"
                        draggable={false}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">#{player.number} {player.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatPlayTime(playerTimes[player.id] || 0)} |{' '}
                          {statistics
                            .filter((s) => s.player_id === player.id)
                            .reduce((pts, s) => {
                              if (s.action_type === '2PM') return pts + 2;
                              if (s.action_type === '3PM') return pts + 3;
                              if (s.action_type === 'FTM') return pts + 1;
                              return pts;
                            }, 0)}{' '}
                          Pts
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayerToggle(player, false);
                        }}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        替换
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* 中间：球场和动作按钮 */}
          <div className="space-y-4">
            <Court className="h-64 mb-4">
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-400 text-center">
                  <p>点击球员，然后选择动作</p>
                  <p className="text-sm mt-2">或使用下方快速按钮</p>
                </div>
              </div>
            </Court>

            {/* 动作按钮 */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-4">记录统计</h3>
              {selectedPlayer && (
                <div className="mb-2 p-2 bg-blue-50 rounded text-sm">
                  已选择: #{selectedPlayer.number} {selectedPlayer.name}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <ActionButton
                  action="2PM"
                  label="2分命中"
                  icon="/assets/icons/actions/2pm.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      handleActionClick(selectedPlayer, '2PM');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="2PA"
                  label="2分不中"
                  icon="/assets/icons/actions/2pm.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      handleActionClick(selectedPlayer, '2PA');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="3PM"
                  label="3分命中"
                  icon="/assets/icons/actions/3pm.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      handleActionClick(selectedPlayer, '3PM');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="3PA"
                  label="3分不中"
                  icon="/assets/icons/actions/3pm.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      handleActionClick(selectedPlayer, '3PA');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="FTM"
                  label="罚球命中"
                  icon="/assets/icons/actions/ftm.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      handleActionClick(selectedPlayer, 'FTM');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="FTA"
                  label="罚球不中"
                  icon="/assets/icons/actions/ftm.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      handleActionClick(selectedPlayer, 'FTA');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="OREB"
                  label="进攻篮板"
                  icon="/assets/icons/actions/oreb.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      recordStatistic(selectedPlayer, 'OREB');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="DREB"
                  label="防守篮板"
                  icon="/assets/icons/actions/dreb.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      recordStatistic(selectedPlayer, 'DREB');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="AST"
                  label="助攻"
                  icon="/assets/icons/actions/ast.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      recordStatistic(selectedPlayer, 'AST');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="STL"
                  label="抢断"
                  icon="/assets/icons/actions/stl.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      recordStatistic(selectedPlayer, 'STL');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="BLK"
                  label="盖帽"
                  icon="/assets/icons/actions/blk.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      recordStatistic(selectedPlayer, 'BLK');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
                <ActionButton
                  action="TOV"
                  label="失误"
                  icon="/assets/icons/actions/tov.svg"
                  onClick={() => {
                    if (selectedPlayer) {
                      recordStatistic(selectedPlayer, 'TOV');
                    } else {
                      alert('请先选择球员');
                    }
                  }}
                  disabled={!selectedPlayer}
                />
              </div>
            </div>
          </div>

          {/* 右侧：客队球员 */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-red-600 mb-4">客队球员</h3>
            
            {/* 上场球员 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-green-600 mb-2">上场 ({awayPlayers.filter(p => onCourtPlayers.has(p.id)).length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {awayPlayers
                  .filter((player) => onCourtPlayers.has(player.id))
                  .map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center space-x-3 p-2 rounded cursor-pointer border-2 border-green-500 bg-green-50 ${
                        selectedPlayer?.id === player.id ? 'bg-blue-100 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <PlayerAvatar
                        player={player}
                        isHome={false}
                        size="sm"
                        draggable={false}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">#{player.number} {player.name}</div>
                        <div className="text-xs text-gray-600">
                          {formatPlayTime(playerTimes[player.id] || 0)} |{' '}
                          {statistics
                            .filter((s) => s.player_id === player.id)
                            .reduce((pts, s) => {
                              if (s.action_type === '2PM') return pts + 2;
                              if (s.action_type === '3PM') return pts + 3;
                              if (s.action_type === 'FTM') return pts + 1;
                              return pts;
                            }, 0)}{' '}
                          Pts |{' '}
                          {statistics.filter((s) => s.player_id === player.id && s.action_type === 'AST').length}{' '}
                          Ast |{' '}
                          {statistics.filter((s) => s.player_id === player.id && (s.action_type === 'OREB' || s.action_type === 'DREB')).length}{' '}
                          Reb
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayerToggle(player, false);
                        }}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        替换
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* 场下球员 */}
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">场下 ({awayPlayers.filter(p => !onCourtPlayers.has(p.id)).length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {awayPlayers
                  .filter((player) => !onCourtPlayers.has(player.id))
                  .map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border ${
                        selectedPlayer?.id === player.id ? 'bg-blue-100 border-blue-500' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <PlayerAvatar
                        player={player}
                        isHome={false}
                        size="sm"
                        draggable={false}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">#{player.number} {player.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatPlayTime(playerTimes[player.id] || 0)} |{' '}
                          {statistics
                            .filter((s) => s.player_id === player.id)
                            .reduce((pts, s) => {
                              if (s.action_type === '2PM') return pts + 2;
                              if (s.action_type === '3PM') return pts + 3;
                              if (s.action_type === 'FTM') return pts + 1;
                              return pts;
                            }, 0)}{' '}
                          Pts
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayerToggle(player, false);
                        }}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        替换
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* 统计表格 */}
        <div className="grid md:grid-cols-2 gap-6">
          <PlayerStatsTable
            players={homePlayers}
            statistics={statistics}
            isHome={true}
          />
          <PlayerStatsTable
            players={awayPlayers}
            statistics={statistics}
            isHome={false}
          />
        </div>
      </div>

      {/* 投篮位置标记对话框 */}
      {selectedPlayer && selectedAction && game && (
        <ShotLocationModal
          isOpen={showShotModal}
          onClose={() => {
            setShowShotModal(false);
            setSelectedPlayer(null);
            setSelectedAction(null);
          }}
          onConfirm={handleShotConfirm}
          players={allPlayers}
          shotType={selectedAction as '2PM' | '2PA' | '3PM' | '3PA'}
          isMade={selectedAction === '2PM' || selectedAction === '3PM'}
          shootingPlayer={selectedPlayer}
          onCourtPlayers={onCourtPlayers}
          homeTeamId={game.home_team_id}
          awayTeamId={game.away_team_id}
        />
      )}

      {/* 罚球对话框 */}
      {selectedPlayer && selectedAction && (
        <FreeThrowModal
          isOpen={showFreeThrowModal}
          onClose={() => {
            setShowFreeThrowModal(false);
            setSelectedPlayer(null);
            setSelectedAction(null);
          }}
          onConfirm={handleFreeThrowConfirm}
        />
      )}

      {/* 替换对话框 */}
      <SubstitutionModal
        isOpen={showSubstitutionModal}
        onClose={() => setShowSubstitutionModal(false)}
        onConfirm={handleSubstitution}
        onCourtPlayers={
          substitutionTeam === 'home'
            ? homePlayers.filter((p) => onCourtPlayers.has(p.id))
            : awayPlayers.filter((p) => onCourtPlayers.has(p.id))
        }
        offCourtPlayers={
          substitutionTeam === 'home'
            ? homePlayers.filter((p) => !onCourtPlayers.has(p.id))
            : awayPlayers.filter((p) => !onCourtPlayers.has(p.id))
        }
        isHome={substitutionTeam === 'home'}
      />
    </div>
  );
}

export default GameStatistics;
