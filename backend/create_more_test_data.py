"""创建更多测试数据"""
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database.base import get_db, init_db
from app.models.team import Team
from app.models.player import Player
from app.models.game import Game, GameStatus, GamePlayer
from app.models.statistic import Statistic

# 随机中文名字
CHINESE_NAMES = [
    "王强", "李伟", "张明", "刘洋", "陈军", "杨磊", "黄勇", "周杰", "吴刚", "徐亮",
    "孙斌", "马超", "朱军", "胡强", "林峰", "何伟", "罗刚", "高强", "梁军", "韩磊",
    "唐勇", "冯超", "于杰", "董强", "袁伟", "邓军", "许亮", "曹勇", "严超", "华杰"
]

def create_random_team(db: Session, team_name: str, num_players: int = 12):
    """创建随机球队"""
    team = Team(name=team_name, logo=None)
    db.add(team)
    db.commit()
    db.refresh(team)
    
    # 创建球员
    used_names = set()
    for i in range(num_players):
        # 确保名字不重复
        while True:
            name = random.choice(CHINESE_NAMES)
            if name not in used_names:
                used_names.add(name)
                break
        
        player = Player(
            team_id=team.id,
            name=name,
            number=i + 1,
            display_order=i
        )
        db.add(player)
    
    db.commit()
    print(f"创建球队: {team_name} (ID: {team.id}), {num_players}名球员")
    return team

def create_random_game(db: Session, home_team: Team, away_team: Team, date: datetime):
    """创建随机比赛并生成统计数据"""
    game = Game(
        home_team_id=home_team.id,
        away_team_id=away_team.id,
        date=date,
        duration=40,
        quarters=4,
        status=GameStatus.FINISHED
    )
    db.add(game)
    db.commit()
    db.refresh(game)
    
    # 获取两队球员
    home_players = db.query(Player).filter(Player.team_id == home_team.id).all()
    away_players = db.query(Player).filter(Player.team_id == away_team.id).all()
    
    # 选择首发（前5个）
    home_starters = home_players[:5]
    away_starters = away_players[:5]
    
    # 添加到GamePlayer
    for player in home_starters + away_starters:
        game_player = GamePlayer(
            game_id=game.id,
            player_id=player.id,
            is_starter=True
        )
        db.add(game_player)
    db.commit()
    
    # 生成随机统计数据
    actions = ['2PM', '2PA', '3PM', '3PA', 'FTM', 'FTA', 'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TOV', 'PF']
    stats_count = 0
    
    for quarter in range(1, 5):
        # 每节生成30-50个事件
        num_events = random.randint(30, 50)
        
        for _ in range(num_events):
            # 随机选择球员（包括替补）
            if random.random() < 0.7:  # 70%概率选择首发
                player = random.choice(home_starters + away_starters)
            else:
                player = random.choice(home_players + away_players)
            
            # 随机选择动作
            action = random.choice(actions)
            
            stat = Statistic(
                game_id=game.id,
                player_id=player.id,
                quarter=quarter,
                action_type=action
            )
            db.add(stat)
            stats_count += 1
    
    db.commit()
    print(f"创建比赛: {home_team.name} vs {away_team.name} (ID: {game.id}), {stats_count}条统计")
    return game

def create_test_data():
    """创建测试数据"""
    init_db()
    db = next(get_db())
    
    try:
        # 创建几个测试球队
        teams = []
        team_names = ["北京队", "上海队", "广东队", "深圳队", "杭州队"]
        
        for team_name in team_names:
            # 检查是否已存在
            existing = db.query(Team).filter(Team.name == team_name).first()
            if not existing:
                team = create_random_team(db, team_name, num_players=12)
                teams.append(team)
            else:
                teams.append(existing)
                print(f"球队已存在: {team_name}")
        
        # 创建几场比赛
        base_date = datetime(2025, 1, 1)
        
        # 创建5场比赛
        for i in range(5):
            home_team = random.choice(teams)
            away_team = random.choice([t for t in teams if t.id != home_team.id])
            
            game_date = base_date + timedelta(days=i * 7)  # 每周一场
            
            # 检查是否已存在相同比赛
            existing = db.query(Game).filter(
                Game.home_team_id == home_team.id,
                Game.away_team_id == away_team.id,
                Game.date == game_date
            ).first()
            
            if not existing:
                create_random_game(db, home_team, away_team, game_date)
            else:
                print(f"比赛已存在: {home_team.name} vs {away_team.name} on {game_date.date()}")
        
        print("\n✅ 测试数据创建完成！")
        
    except Exception as e:
        db.rollback()
        print(f"创建失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    create_test_data()

