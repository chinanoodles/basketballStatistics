"""迁移脚本：创建用户-league关联表（多对多关系）"""
from sqlalchemy import create_engine, text
from app.database.base import Base
from app.models.user_league import user_league_association
from app.models.user import User
from app.models.league import League
import os

# 数据库路径
DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'basketball.db')

def migrate():
    """创建user_leagues表并迁移现有数据"""
    engine = create_engine(f'sqlite:///{DB_PATH}')
    
    print("开始迁移用户-league关联表...")
    
    # 创建user_leagues表
    try:
        user_league_association.create(engine, checkfirst=True)
        print("✅ 已创建 user_leagues 表")
    except Exception as e:
        print(f"⚠️  创建表时出错（可能已存在）: {e}")
    
    # 迁移现有数据：将users表中的league_id迁移到user_leagues表
    with engine.connect() as conn:
        # 检查是否有数据需要迁移
        result = conn.execute(text("""
            SELECT COUNT(*) FROM users WHERE league_id IS NOT NULL
        """))
        count = result.scalar()
        
        if count > 0:
            print(f"发现 {count} 个用户有league_id，开始迁移...")
            
            # 插入现有数据到user_leagues表
            conn.execute(text("""
                INSERT OR IGNORE INTO user_leagues (user_id, league_id)
                SELECT id, league_id FROM users WHERE league_id IS NOT NULL
            """))
            conn.commit()
            
            result = conn.execute(text("SELECT COUNT(*) FROM user_leagues"))
            migrated_count = result.scalar()
            print(f"✅ 已迁移 {migrated_count} 条用户-league关联记录")
        else:
            print("ℹ️  没有需要迁移的数据")
    
    print("✅ 用户-league关联表迁移完成！")

if __name__ == "__main__":
    migrate()


