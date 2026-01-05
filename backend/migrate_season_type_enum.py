"""迁移 season_type 枚举值：将小写更新为大写"""
from app.database.base import engine
from sqlalchemy import text

def migrate():
    """将 season_type 从小写更新为大写枚举值"""
    print("开始迁移 season_type 枚举值...")
    
    conn = engine.connect()
    trans = conn.begin()
    
    try:
        # 检查 games 表是否有 season_type 列
        result = conn.execute(text("PRAGMA table_info(games)"))
        games_columns = [row[1] for row in result]
        
        if 'season_type' not in games_columns:
            print("❌ games 表没有 season_type 列")
            trans.rollback()
            return
        
        # 将大写的 'REGULAR' 更新为小写的 'regular'（匹配枚举值）
        result = conn.execute(text("SELECT COUNT(*) FROM games WHERE season_type = 'REGULAR'"))
        regular_upper_count = result.scalar()
        if regular_upper_count > 0:
            conn.execute(text("UPDATE games SET season_type = 'regular' WHERE season_type = 'REGULAR'"))
            print(f"✅ 已更新 {regular_upper_count} 场比赛的 season_type 为 'regular'")
        else:
            print("✅ 所有比赛的 season_type 已经是 'regular'")
        
        # 将大写的 'PLAYOFF' 更新为小写的 'playoff'（匹配枚举值）
        result = conn.execute(text("SELECT COUNT(*) FROM games WHERE season_type = 'PLAYOFF'"))
        playoff_upper_count = result.scalar()
        if playoff_upper_count > 0:
            conn.execute(text("UPDATE games SET season_type = 'playoff' WHERE season_type = 'PLAYOFF'"))
            print(f"✅ 已更新 {playoff_upper_count} 场比赛的 season_type 为 'playoff'")
        else:
            print("✅ 所有比赛的 season_type 已经是 'playoff'")
        
        # 检查是否有无效的 season_type 值
        result = conn.execute(text("SELECT COUNT(*) FROM games WHERE season_type NOT IN ('regular', 'playoff') AND season_type IS NOT NULL"))
        invalid_count = result.scalar()
        if invalid_count > 0:
            print(f"⚠️  发现 {invalid_count} 个无效的 season_type 值")
            # 显示无效值
            result = conn.execute(text("SELECT id, season_type FROM games WHERE season_type NOT IN ('regular', 'playoff') AND season_type IS NOT NULL"))
            invalid_games = result.fetchall()
            for game in invalid_games:
                print(f"   比赛 ID {game[0]}, season_type: {game[1]}")
            # 将无效值设置为默认值 regular
            conn.execute(text("UPDATE games SET season_type = 'regular' WHERE season_type NOT IN ('regular', 'playoff') AND season_type IS NOT NULL"))
            print(f"✅ 已将无效值更新为 'regular'")
        
        # 确保所有比赛都有 season_type
        result = conn.execute(text("SELECT COUNT(*) FROM games WHERE season_type IS NULL"))
        null_count = result.scalar()
        if null_count > 0:
            conn.execute(text("UPDATE games SET season_type = 'regular' WHERE season_type IS NULL"))
            print(f"✅ 已更新 {null_count} 场比赛的 season_type 为 'regular'（默认值）")
        
        trans.commit()
        print("\n✅ season_type 枚举值迁移完成！")
        
    except Exception as e:
        trans.rollback()
        print(f"❌ 迁移失败: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

