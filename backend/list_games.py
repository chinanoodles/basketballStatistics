"""列出所有比赛"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.database.base import get_db
from app.models.team import Team
from app.models.game import Game
from app.models.statistic import Statistic

def main():
    db = next(get_db())
    
    try:
        games = db.query(Game).order_by(Game.date.desc(), Game.id.desc()).all()
        
        print("=" * 80)
        print("所有比赛列表")
        print("=" * 80)
        
        for game in games:
            home_team = db.query(Team).filter(Team.id == game.home_team_id).first()
            away_team = db.query(Team).filter(Team.id == game.away_team_id).first()
            game_stats = db.query(Statistic).filter(Statistic.game_id == game.id).all()
            
            # 计算比分
            home_score = 0
            away_score = 0
            for stat in game_stats:
                if stat.action_type == '2PM':
                    if stat.player_id in [p.id for p in home_team.players]:
                        home_score += 2
                    else:
                        away_score += 2
                elif stat.action_type == '3PM':
                    if stat.player_id in [p.id for p in home_team.players]:
                        home_score += 3
                    else:
                        away_score += 3
                elif stat.action_type == 'FTM':
                    if stat.player_id in [p.id for p in home_team.players]:
                        home_score += 1
                    else:
                        away_score += 1
            
            print(f"ID: {game.id:3d} | {home_team.name:20s} vs {away_team.name:20s} | "
                  f"{game.date.strftime('%Y-%m-%d'):12s} | "
                  f"比分: {home_score:3d}-{away_score:3d} | "
                  f"统计: {len(game_stats):4d} 条 | "
                  f"状态: {game.status}")
        
        print("=" * 80)
        print(f"总计: {len(games)} 场比赛")
        
    finally:
        db.close()

if __name__ == '__main__':
    main()

