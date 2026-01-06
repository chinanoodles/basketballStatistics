"""批量从CSV文件导入比赛数据"""
import csv
import sys
import os
from datetime import datetime
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.database.base import get_db, init_db
from app.models.team import Team
from app.models.player import Player
from app.models.game import Game, GameStatus, GamePlayer
from app.models.statistic import Statistic
from app.models.league import League
from app.models.user import User, UserRole
from app.models.player_time import PlayerTime  # 导入PlayerTime以解决关系映射问题

# 事件类型映射
EVENT_MAPPING = {
    'Free throw made': 'FTM',
    'Free throw missed': 'FTA',
    'Two pointer made': '2PM',
    'Two pointer missed': '2PA',
    'Three pointer made': '3PM',
    'Three pointer missed': '3PA',
    'Offensive rebound': 'OREB',
    'Defensive rebound': 'DREB',
    'Assist': 'AST',
    'Steal': 'STL',
    'Block': 'BLK',
    'Turnover': 'TOV',
    'Defensive foul': 'PF',
    'Personal foul drawn': 'PFD',
    'Sub in': 'SUB_IN',
    'Sub out': 'SUB_OUT',
    'Technical foul': 'PF',  # 技术犯规也算个人犯规
    'Shot rejected': None,  # 被盖帽，不需要单独记录（已经有Block了）
    'Offensive foul': 'PF',  # 进攻犯规也算个人犯规
}

def parse_time(time_str):
    """解析时间字符串 MM:SS 或 HH:MM:SS"""
    try:
        parts = time_str.split(':')
        if len(parts) == 2:
            minutes, seconds = map(int, parts)
            return minutes * 60 + seconds
        elif len(parts) == 3:
            hours, minutes, seconds = map(int, parts)
            return hours * 3600 + minutes * 60 + seconds
    except:
        return 0
    return 0

def get_or_create_team(db: Session, team_name: str, league_id: int = None, team_admin_id: int = None):
    """获取或创建球队"""
    # 如果指定了league_id，在同一league内查找
    if league_id:
        team = db.query(Team).filter(
            Team.name == team_name,
            Team.league_id == league_id
        ).first()
    else:
        team = db.query(Team).filter(Team.name == team_name).first()
    
    if not team:
        team = Team(name=team_name, logo=None, league_id=league_id, team_admin_id=team_admin_id)
        db.add(team)
        db.commit()
        db.refresh(team)
        print(f"  创建球队: {team_name} (League ID: {league_id}, Team Admin ID: {team_admin_id})")
    else:
        # 更新现有球队的league_id和team_admin_id（如果需要）
        updated = False
        if league_id and team.league_id != league_id:
            team.league_id = league_id
            updated = True
        if team_admin_id and team.team_admin_id != team_admin_id:
            team.team_admin_id = team_admin_id
            updated = True
        if updated:
            db.commit()
            db.refresh(team)
            print(f"  更新球队: {team_name} (League ID: {league_id}, Team Admin ID: {team_admin_id})")
    return team

def get_or_create_player(db: Session, team_id: int, player_name: str, player_number: int = None):
    """获取或创建球员"""
    # 先查找是否已存在
    player = db.query(Player).filter(
        Player.team_id == team_id,
        Player.name == player_name
    ).first()
    
    if not player:
        # 如果没有提供号码，使用球员ID或随机号码
        if player_number is None:
            existing_players = db.query(Player).filter(Player.team_id == team_id).all()
            player_number = len(existing_players) + 1
        
        # 检查号码是否已使用
        while db.query(Player).filter(
            Player.team_id == team_id,
            Player.number == player_number
        ).first():
            player_number += 1
        
        player = Player(
            team_id=team_id,
            name=player_name,
            number=player_number,
            display_order=0
        )
        db.add(player)
        db.commit()
        db.refresh(player)
        print(f"    创建球员: {player_name} (#{player_number})")
    return player

def import_game_from_csv(csv_path: str, db: Session, league_id: int = None, team_admin_id: int = None):
    """从CSV文件导入比赛数据"""
    try:
        print(f"\n处理文件: {os.path.basename(csv_path)}")
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if not rows:
            print("  CSV文件为空，跳过")
            return None
        
        # 获取第一行数据来确定比赛信息
        first_row = rows[0]
        game_name = first_row.get('Game', '').strip()
        date_str = first_row.get('Date', '').strip()
        
        # 检查比赛是否已存在（基于比赛名称和日期）
        try:
            date_parts = date_str.split('/')
            if len(date_parts) == 3:
                day, month, year = map(int, date_parts)
                game_date = datetime(year, month, day)
            else:
                game_date = datetime.now()
        except:
            game_date = datetime.now()
        
        # 获取球队名称（从比赛名称中提取）
        if ' vs ' in game_name:
            team_names = game_name.split(' vs ')
            home_team_name = team_names[0].strip()
            away_team_name = team_names[1].strip()
        else:
            # 从第一行数据中获取
            home_team_name = first_row.get('Team', '').strip()
            if not home_team_name:
                home_team_name = 'Team A'
            away_team_name = 'Team B'
        
        # 检查比赛是否已存在
        home_team = get_or_create_team(db, home_team_name, league_id, team_admin_id)
        away_team = get_or_create_team(db, away_team_name, league_id, team_admin_id)
        
        existing_game = db.query(Game).filter(
            Game.home_team_id == home_team.id,
            Game.away_team_id == away_team.id,
            Game.date == game_date
        ).first()
        
        if existing_game:
            print(f"  比赛已存在，跳过 (ID: {existing_game.id})")
            return existing_game
        
        # 收集所有球员
        home_players = set()
        away_players = set()
        
        for row in rows:
            # 收集主队球员
            for i in range(1, 6):
                player_name = row.get(f'Home player {i}', '').strip()
                if player_name:
                    home_players.add(player_name)
            
            # 收集客队球员
            for i in range(1, 6):
                player_name = row.get(f'Away player {i}', '').strip()
                if player_name:
                    away_players.add(player_name)
        
        # 创建球员
        home_player_map = {}
        for idx, player_name in enumerate(sorted(home_players), 1):
            player = get_or_create_player(db, home_team.id, player_name, idx)
            home_player_map[player_name] = player
        
        away_player_map = {}
        for idx, player_name in enumerate(sorted(away_players), 1):
            player = get_or_create_player(db, away_team.id, player_name, idx)
            away_player_map[player_name] = player
        
        # 创建比赛
        game = Game(
            home_team_id=home_team.id,
            away_team_id=away_team.id,
            date=game_date,
            duration=40,  # 默认40分钟
            quarters=4,
            status=GameStatus.FINISHED,
            league_id=league_id  # 设置联赛ID
        )
        db.add(game)
        db.commit()
        db.refresh(game)
        print(f"  创建比赛: {game_name} (ID: {game.id})")
        
        # 添加首发球员到GamePlayer
        first_row_data = rows[0]
        starter_ids = []
        
        for i in range(1, 6):
            home_player_name = first_row_data.get(f'Home player {i}', '').strip()
            if home_player_name and home_player_name in home_player_map:
                starter_ids.append(home_player_map[home_player_name].id)
        
        for i in range(1, 6):
            away_player_name = first_row_data.get(f'Away player {i}', '').strip()
            if away_player_name and away_player_name in away_player_map:
                starter_ids.append(away_player_map[away_player_name].id)
        
        for player_id in starter_ids:
            game_player = GamePlayer(
                game_id=game.id,
                player_id=player_id,
                is_starter=True
            )
            db.add(game_player)
        db.commit()
        
        # 导入统计数据和球员上场时间
        stats_count = 0
        player_substitutions = []  # [(player_id, quarter, event_type, timestamp), ...]
        
        # 计算比赛开始时间（基于第一行数据）
        game_start_time = game_date
        
        # 记录首发球员（他们在第1节开始时就在场上）
        starter_player_times = {}  # {player_id: enter_time}
        for player_id in starter_ids:
            starter_player_times[player_id] = game_start_time
        
        for row in rows:
            event = row.get('Event', '').strip()
            player_name = row.get('Player', '').strip()
            quarter_str = row.get('Quarter', '1').strip()
            minutes_str = row.get('Minutes', '').strip()  # 获取时间信息
            
            if not event or not player_name:
                continue
            
            # 跳过不需要记录的事件
            if event == 'Shot rejected':
                continue
            
            # 解析时间戳
            try:
                quarter = int(quarter_str)
            except:
                quarter = 1
            
            timestamp = game_start_time
            if minutes_str:
                try:
                    # 解析MM:SS格式的时间（剩余时间）
                    # 例如：40:00表示比赛开始，39:31表示剩余39分31秒
                    time_parts = minutes_str.split(':')
                    if len(time_parts) == 2:
                        remaining_minutes, remaining_seconds = map(int, time_parts)
                        
                        # 计算从比赛开始经过的时间（假设每节10分钟）
                        # 每节10分钟 = 600秒
                        quarter_duration = 600
                        quarter_start_seconds = (quarter - 1) * quarter_duration
                        
                        # 计算总剩余时间（秒）
                        total_remaining_seconds = remaining_minutes * 60 + remaining_seconds
                        
                        # 计算从该节开始经过的时间（秒）
                        elapsed_in_quarter = quarter_duration - total_remaining_seconds
                        
                        # 计算从比赛开始经过的总时间（秒）
                        total_elapsed_seconds = quarter_start_seconds + elapsed_in_quarter
                        
                        # 计算实际时间戳
                        from datetime import timedelta
                        timestamp = game_start_time + timedelta(seconds=total_elapsed_seconds)
                except Exception as e:
                    # 如果解析失败，使用节次和行号估算时间
                    # 使用行号作为时间顺序的参考
                    row_index = rows.index(row)
                    from datetime import timedelta
                    # 假设每行事件间隔约1秒
                    timestamp = game_start_time + timedelta(seconds=row_index)
            
            # 映射事件类型
            action_type = EVENT_MAPPING.get(event)
            
            # 处理上场/下场事件
            if event in ['Sub in', 'Sub out']:
                # 确定球员和球队
                team_name = row.get('Team', '').strip()
                if team_name == home_team_name:
                    player_map = home_player_map
                elif team_name == away_team_name:
                    player_map = away_player_map
                else:
                    if player_name in home_player_map:
                        player_map = home_player_map
                    elif player_name in away_player_map:
                        player_map = away_player_map
                    else:
                        continue
                
                if player_name not in player_map:
                    continue
                
                player = player_map[player_name]
                
                try:
                    quarter = int(quarter_str)
                except:
                    quarter = 1
                
                # 记录替换事件
                player_substitutions.append((player.id, quarter, action_type, timestamp))
                continue  # 替换事件不创建统计数据
            
            if not action_type:
                # 静默跳过未知事件类型
                continue
            
            # 确定球员和球队
            team_name = row.get('Team', '').strip()
            if team_name == home_team_name:
                player_map = home_player_map
            elif team_name == away_team_name:
                player_map = away_player_map
            else:
                # 如果Team字段是"Team"，可能是团队事件（如篮板）
                if player_name in home_player_map:
                    player_map = home_player_map
                elif player_name in away_player_map:
                    player_map = away_player_map
                else:
                    continue
            
            if player_name not in player_map:
                continue
            
            player = player_map[player_name]
            
            try:
                quarter = int(quarter_str)
            except:
                quarter = 1
            
            # 创建统计数据（包含时间戳）
            statistic = Statistic(
                game_id=game.id,
                player_id=player.id,
                quarter=quarter,
                action_type=action_type,
                timestamp=timestamp
            )
            db.add(statistic)
            stats_count += 1
        
        db.commit()
        
        # 处理球员上场时间记录
        from app.models.player_time import PlayerTime
        from datetime import timedelta
        
        # 按时间顺序处理替换事件
        player_substitutions.sort(key=lambda x: (x[1], x[3]))  # 按节次和时间排序
        
        # 跟踪每个球员在每个节次的上场状态
        player_status = {}  # {player_id: {quarter: {'on_court': bool, 'enter_time': datetime}}}
        
        # 初始化首发球员的状态（第1节开始时就在场上）
        for player_id in starter_ids:
            if player_id not in player_status:
                player_status[player_id] = {}
            player_status[player_id][1] = {
                'on_court': True,
                'enter_time': game_start_time
            }
        
        # 计算每节的开始和结束时间（假设每节10分钟）
        quarter_duration = 600  # 10分钟 = 600秒
        quarter_times = {}
        for q in range(1, 5):
            quarter_start = game_start_time + timedelta(seconds=(q - 1) * quarter_duration)
            quarter_end = game_start_time + timedelta(seconds=q * quarter_duration)
            quarter_times[q] = {'start': quarter_start, 'end': quarter_end}
        
        # 处理替换事件
        for player_id, quarter, event_type, timestamp in player_substitutions:
            if player_id not in player_status:
                player_status[player_id] = {}
            if quarter not in player_status[player_id]:
                # 如果球员在该节次还没有状态，初始化为不在场上
                player_status[player_id][quarter] = {'on_court': False, 'enter_time': None}
            
            if event_type == 'SUB_IN':
                # 球员上场
                if not player_status[player_id][quarter]['on_court']:
                    player_status[player_id][quarter]['on_court'] = True
                    player_status[player_id][quarter]['enter_time'] = timestamp
            elif event_type == 'SUB_OUT':
                # 球员下场
                if player_status[player_id][quarter]['on_court']:
                    enter_time = player_status[player_id][quarter]['enter_time']
                    if enter_time:
                        # 创建上场时间记录
                        duration_seconds = (timestamp - enter_time).total_seconds()
                        if duration_seconds > 0:  # 只记录有效的时间
                            player_time = PlayerTime(
                                game_id=game.id,
                                player_id=player_id,
                                quarter=quarter,
                                enter_time=enter_time,
                                exit_time=timestamp,
                                duration_seconds=duration_seconds
                            )
                            db.add(player_time)
                    player_status[player_id][quarter]['on_court'] = False
                    player_status[player_id][quarter]['enter_time'] = None
        
        # 处理还在场上的球员（节次结束时仍在场上）
        for player_id, quarters_data in player_status.items():
            for quarter, status in quarters_data.items():
                if status['on_court'] and status['enter_time']:
                    # 球员还在场上，使用节次结束时间
                    quarter_end = quarter_times.get(quarter, {}).get('end')
                    if not quarter_end:
                        # 如果没有找到节次结束时间，使用比赛结束时间
                        quarter_end = game_start_time + timedelta(seconds=quarter * quarter_duration)
                    
                    duration_seconds = (quarter_end - status['enter_time']).total_seconds()
                    if duration_seconds > 0:  # 只记录有效的时间
                        player_time = PlayerTime(
                            game_id=game.id,
                            player_id=player_id,
                            quarter=quarter,
                            enter_time=status['enter_time'],
                            exit_time=quarter_end,
                            duration_seconds=duration_seconds
                        )
                        db.add(player_time)
        
        db.commit()
        print(f"  导入 {stats_count} 条统计数据")
        print(f"  导入 {len(player_substitutions)} 个替换事件")
        print(f"  导入 {stats_count} 条统计数据")
        return game
        
    except Exception as e:
        db.rollback()
        print(f"  导入失败: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """批量导入CSV文件"""
    # 初始化数据库
    init_db()
    
    # 获取数据库会话
    db = next(get_db())
    
    try:
        # 获取或创建 auba-s2 league
        league = db.query(League).filter(League.name == 'auba-s2').first()
        if not league:
            league = League(name='auba-s2', description='AUBA Season 2')
            db.add(league)
            db.commit()
            db.refresh(league)
            print(f"创建联赛: auba-s2 (ID: {league.id})")
        else:
            print(f"使用联赛: auba-s2 (ID: {league.id})")
        
        league_id = league.id
        
        # 获取 noodles 用户（team_admin）
        team_admin = db.query(User).filter(
            User.username == 'noodles',
            User.role == UserRole.TEAM_ADMIN
        ).first()
        if not team_admin:
            print("警告: 未找到 noodles 用户（team_admin），将不设置领队")
            team_admin_id = None
        else:
            team_admin_id = team_admin.id
            print(f"使用领队: noodles (ID: {team_admin_id})")
        
        # CSV文件列表
        csv_files = [
            '../reference/games/auba-s2-mail_vs_auba-s2-和伟_(2025-12-03_9:3)_play_by_play.csv',
            '../reference/games/auba-s2-mail_vs_auba-s2-老姜_(2025-12-03_9:6)_play_by_play.csv',
            '../reference/games/auba-s2-mail_vs_auba-s2-老姜_(2025-12-03_9:7)_play_by_play.csv',
            '../reference/games/auba-s2-mail_vs_auba-s2-老姜_(2025-12-16_0:31)_play_by_play.csv',
            '../reference/games/auba-s2-mail_vs_auba-s2-小关_(2025-12-03_9:6)_play_by_play 2.csv',
            '../reference/games/auba-s2-mail_vs_auba-s2-小关_(2025-12-03_9:6)_play_by_play.csv',
            '../reference/games/auba-s2-mail_vs_auba-s2-小关_(2025-12-03_9:7)_play_by_play.csv',
            '../reference/games/auba-s2-mail_vs_auba-s2-小姜_(2025-12-03_9:6)_play_by_play.csv',
            '../reference/games/auba-s2-mail_vs_auba-s2-小姜_(2025-12-10_20:55)_play_by_play.csv',
        ]
        
        # 如果提供了命令行参数，使用参数中的文件
        if len(sys.argv) > 1:
            csv_files = sys.argv[1:]
        
        print(f"\n开始批量导入 {len(csv_files)} 个CSV文件...")
        print("=" * 60)
        
        success_count = 0
        skip_count = 0
        error_count = 0
        
        for csv_path in csv_files:
            # 转换为绝对路径
            if not os.path.isabs(csv_path):
                csv_path = os.path.join(Path(__file__).parent, csv_path)
            
            if not os.path.exists(csv_path):
                print(f"\n文件不存在: {csv_path}")
                error_count += 1
                continue
            
            result = import_game_from_csv(csv_path, db, league_id, team_admin_id)
            if result:
                success_count += 1
            elif result is None:
                error_count += 1
            else:
                skip_count += 1
        
        print("\n" + "=" * 60)
        print(f"导入完成！")
        print(f"  成功: {success_count} 个")
        print(f"  跳过: {skip_count} 个")
        print(f"  失败: {error_count} 个")
        
    finally:
        db.close()

if __name__ == '__main__':
    main()

