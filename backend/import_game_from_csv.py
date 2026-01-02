"""从CSV文件导入比赛数据"""
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
from app.models.game import Game, GameStatus
from app.models.statistic import Statistic
from app.models.game import GamePlayer

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

def get_or_create_team(db: Session, team_name: str):
    """获取或创建球队"""
    team = db.query(Team).filter(Team.name == team_name).first()
    if not team:
        team = Team(name=team_name, logo=None)
        db.add(team)
        db.commit()
        db.refresh(team)
        print(f"创建球队: {team_name}")
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
        print(f"创建球员: {player_name} (#{player_number})")
    return player

def import_game_from_csv(csv_path: str):
    """从CSV文件导入比赛数据"""
    db = next(get_db())
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if not rows:
            print("CSV文件为空")
            return
        
        # 获取第一行数据来确定比赛信息
        first_row = rows[0]
        game_name = first_row.get('Game', '').strip()
        date_str = first_row.get('Date', '').strip()
        
        # 解析日期
        try:
            # 尝试解析 DD/MM/YYYY 格式
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
        
        # 创建或获取球队
        home_team = get_or_create_team(db, home_team_name)
        away_team = get_or_create_team(db, away_team_name)
        
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
            status=GameStatus.FINISHED
        )
        db.add(game)
        db.commit()
        db.refresh(game)
        print(f"创建比赛: {game_name} (ID: {game.id})")
        
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
        
        # 导入统计数据
        stats_count = 0
        for row in rows:
            event = row.get('Event', '').strip()
            player_name = row.get('Player', '').strip()
            quarter_str = row.get('Quarter', '1').strip()
            
            if not event or not player_name:
                continue
            
            # 跳过不需要记录的事件
            if event == 'Shot rejected':
                continue
            
            # 映射事件类型
            action_type = EVENT_MAPPING.get(event)
            if not action_type:
                print(f"未知事件类型: {event}")
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
            
            # 创建统计数据
            statistic = Statistic(
                game_id=game.id,
                player_id=player.id,
                quarter=quarter,
                action_type=action_type
            )
            db.add(statistic)
            stats_count += 1
        
        db.commit()
        print(f"导入 {stats_count} 条统计数据")
        print(f"比赛导入完成！比赛ID: {game.id}")
        
    except Exception as e:
        db.rollback()
        print(f"导入失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    # 初始化数据库
    init_db()
    
    # CSV文件路径
    csv_path = '../reference/auba-s2-mail_vs_auba-s2-小关_(2025-12-03_9:6)_play_by_play.csv'
    
    if len(sys.argv) > 1:
        csv_path = sys.argv[1]
    
    if not os.path.exists(csv_path):
        print(f"文件不存在: {csv_path}")
        sys.exit(1)
    
    print(f"开始导入CSV文件: {csv_path}")
    import_game_from_csv(csv_path)
    print("导入完成！")

