"""检查数据库中的数据"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.database.base import get_db
from app.models.team import Team
from app.models.player import Player
from app.models.game import Game
from app.models.statistic import Statistic

def main():
    db = next(get_db())
    
    try:
        teams = db.query(Team).all()
        players = db.query(Player).all()
        games = db.query(Game).all()
        stats = db.query(Statistic).all()
        
        print("=" * 60)
        print("数据库统计")
        print("=" * 60)
        print(f"球队数量: {len(teams)}")
        print(f"球员数量: {len(players)}")
        print(f"比赛数量: {len(games)}")
        print(f"统计数据条数: {len(stats)}")
        print("\n球队列表:")
        for team in teams:
            team_players = db.query(Player).filter(Player.team_id == team.id).all()
            print(f"  - {team.name}: {len(team_players)} 名球员")
        
        print("\n最近5场比赛:")
        recent_games = db.query(Game).order_by(Game.date.desc()).limit(5).all()
        for game in recent_games:
            home_team = db.query(Team).filter(Team.id == game.home_team_id).first()
            away_team = db.query(Team).filter(Team.id == game.away_team_id).first()
            game_stats = db.query(Statistic).filter(Statistic.game_id == game.id).all()
            print(f"  - {home_team.name} vs {away_team.name} ({game.date.strftime('%Y-%m-%d')}): {len(game_stats)} 条统计")
        
    finally:
        db.close()

if __name__ == '__main__':
    main()

