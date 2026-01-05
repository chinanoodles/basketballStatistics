"""数据库迁移脚本：为现有表添加 league_id 列"""
from sqlalchemy import text
from app.database.base import engine, SessionLocal
# 确保所有模型都被导入
from app.models.league import League
from app.models.user import User
from app.models.team import Team
from app.models.game import Game, GamePlayer, SeasonType
from app.models.player import Player
from app.models.statistic import Statistic
from app.models.player_time import PlayerTime

def migrate():
    """执行数据库迁移：添加 league_id 列"""
    print("开始数据库迁移：添加 league_id 列...")
    
    conn = engine.connect()
    trans = conn.begin()
    
    try:
        # 检查 teams 表是否有 league_id 列
        result = conn.execute(text("PRAGMA table_info(teams)"))
        teams_columns = [row[1] for row in result]
        
        if 'league_id' not in teams_columns:
            print("为 teams 表添加 league_id 列...")
            conn.execute(text("ALTER TABLE teams ADD COLUMN league_id INTEGER"))
            print("✅ teams 表已添加 league_id 列")
        else:
            print("✅ teams 表已有 league_id 列")
        
        # 检查 games 表是否有 league_id 和 season_type 列
        result = conn.execute(text("PRAGMA table_info(games)"))
        games_columns = [row[1] for row in result]
        
        if 'league_id' not in games_columns:
            print("为 games 表添加 league_id 列...")
            conn.execute(text("ALTER TABLE games ADD COLUMN league_id INTEGER"))
            print("✅ games 表已添加 league_id 列")
        else:
            print("✅ games 表已有 league_id 列")
        
        if 'season_type' not in games_columns:
            print("为 games 表添加 season_type 列...")
            conn.execute(text("ALTER TABLE games ADD COLUMN season_type VARCHAR(20) DEFAULT 'regular'"))
            print("✅ games 表已添加 season_type 列")
        else:
            print("✅ games 表已有 season_type 列")
        
        # 获取默认联赛ID
        db = SessionLocal()
        default_league = db.query(League).filter(League.name == "默认联赛").first()
        if not default_league:
            # 如果没有默认联赛，创建一个
            default_league = League(
                name="默认联赛",
                description="默认联赛",
                regular_season_name="小组赛",
                playoff_name="季后赛"
            )
            db.add(default_league)
            db.commit()
            db.refresh(default_league)
            print(f"✅ 已创建默认联赛 (ID: {default_league.id})")
        else:
            print(f"✅ 默认联赛已存在 (ID: {default_league.id})")
        
        default_league_id = default_league.id
        db.close()
        
        # 为现有数据设置默认 league_id
        print("\n为现有数据设置 league_id...")
        
        # 更新 teams 表
        result = conn.execute(text("SELECT COUNT(*) FROM teams WHERE league_id IS NULL"))
        null_teams = result.scalar()
        if null_teams > 0:
            conn.execute(text(f"UPDATE teams SET league_id = {default_league_id} WHERE league_id IS NULL"))
            print(f"✅ 已更新 {null_teams} 个球队的 league_id")
        else:
            print("✅ 所有球队已有 league_id")
        
        # 更新 games 表
        result = conn.execute(text("SELECT COUNT(*) FROM games WHERE league_id IS NULL"))
        null_games = conn.execute(text("SELECT COUNT(*) FROM games WHERE league_id IS NULL")).scalar()
        if null_games > 0:
            conn.execute(text(f"UPDATE games SET league_id = {default_league_id} WHERE league_id IS NULL"))
            print(f"✅ 已更新 {null_games} 场比赛的 league_id")
        else:
            print("✅ 所有比赛已有 league_id")
        
        # 更新 games 表的 season_type
        result = conn.execute(text("SELECT COUNT(*) FROM games WHERE season_type IS NULL"))
        null_season_type = result.scalar()
        if null_season_type > 0:
            conn.execute(text("UPDATE games SET season_type = 'regular' WHERE season_type IS NULL"))
            print(f"✅ 已更新 {null_season_type} 场比赛的 season_type")
        else:
            print("✅ 所有比赛已有 season_type")
        
        trans.commit()
        print("\n✅ 数据库迁移完成！")
        
    except Exception as e:
        trans.rollback()
        print(f"❌ 迁移失败: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

