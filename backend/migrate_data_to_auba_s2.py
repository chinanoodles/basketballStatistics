"""迁移现有数据到 auba-s2 league"""
from app.database.base import SessionLocal, engine
from sqlalchemy import text
# 确保所有模型都被导入
from app.models.league import League
from app.models.user import User
from app.models.team import Team
from app.models.game import Game, GamePlayer, SeasonType
from app.models.player import Player
from app.models.statistic import Statistic
from app.models.player_time import PlayerTime

def migrate():
    """将现有数据迁移到 auba-s2 league"""
    print("开始迁移数据到 auba-s2 league...")
    
    db = SessionLocal()
    conn = engine.connect()
    trans = conn.begin()
    
    try:
        # 1. 检查或创建 auba-s2 league
        league = db.query(League).filter(League.name == 'auba-s2').first()
        if not league:
            print("创建 auba-s2 league...")
            league = League(
                name="auba-s2",
                description="Auba S2 联赛",
                regular_season_name="小组赛",
                playoff_name="季后赛"
            )
            db.add(league)
            db.commit()
            db.refresh(league)
            print(f"✅ 已创建 auba-s2 league (ID: {league.id})")
        else:
            print(f"✅ auba-s2 league 已存在 (ID: {league.id})")
        
        league_id = league.id
        
        # 2. 更新所有球队的 league_id
        result = conn.execute(text("SELECT COUNT(*) FROM teams WHERE league_id IS NULL OR league_id != :league_id"), 
                             {"league_id": league_id})
        teams_count = result.scalar()
        if teams_count > 0:
            conn.execute(text("UPDATE teams SET league_id = :league_id WHERE league_id IS NULL OR league_id != :league_id"), 
                        {"league_id": league_id})
            print(f"✅ 已更新 {teams_count} 个球队的 league_id 为 {league_id}")
        else:
            print("✅ 所有球队已属于 auba-s2 league")
        
        # 3. 更新所有比赛的 league_id
        result = conn.execute(text("SELECT COUNT(*) FROM games WHERE league_id IS NULL OR league_id != :league_id"), 
                             {"league_id": league_id})
        games_count = result.scalar()
        if games_count > 0:
            conn.execute(text("UPDATE games SET league_id = :league_id WHERE league_id IS NULL OR league_id != :league_id"), 
                        {"league_id": league_id})
            print(f"✅ 已更新 {games_count} 场比赛的 league_id 为 {league_id}")
        else:
            print("✅ 所有比赛已属于 auba-s2 league")
        
        # 4. 确保所有比赛都有 season_type
        result = conn.execute(text("SELECT COUNT(*) FROM games WHERE season_type IS NULL"))
        null_season_type = result.scalar()
        if null_season_type > 0:
            conn.execute(text("UPDATE games SET season_type = 'regular' WHERE season_type IS NULL"))
            print(f"✅ 已更新 {null_season_type} 场比赛的 season_type 为 'regular'")
        else:
            print("✅ 所有比赛已有 season_type")
        
        trans.commit()
        print("\n✅ 数据迁移完成！")
        
        # 5. 验证迁移结果
        db.refresh(league)
        teams_in_league = db.query(Team).filter(Team.league_id == league_id).count()
        games_in_league = db.query(Game).filter(Game.league_id == league_id).count()
        print(f"\n📊 迁移结果：")
        print(f"   - auba-s2 league ID: {league_id}")
        print(f"   - 关联的球队数量: {teams_in_league}")
        print(f"   - 关联的比赛数量: {games_in_league}")
        
    except Exception as e:
        trans.rollback()
        print(f"❌ 迁移失败: {e}")
        raise
    finally:
        conn.close()
        db.close()

if __name__ == "__main__":
    migrate()

