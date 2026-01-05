"""添加team_admin_id字段到teams表"""
from sqlalchemy import text
from app.database.base import engine

def migrate_add_team_admin_id():
    print("开始添加team_admin_id字段...")
    
    conn = engine.connect()
    trans = conn.begin()
    
    try:
        # 检查字段是否已存在
        result = conn.execute(text("PRAGMA table_info(teams)"))
        columns = [row[1] for row in result]
        
        if 'team_admin_id' not in columns:
            # 添加team_admin_id字段
            conn.execute(text("""
                ALTER TABLE teams 
                ADD COLUMN team_admin_id INTEGER REFERENCES users(id)
            """))
            print("✅ 已添加team_admin_id字段")
        else:
            print("✅ team_admin_id字段已存在，跳过")
        
        trans.commit()
        print("✅ 迁移完成！")
        
    except Exception as e:
        trans.rollback()
        print(f"❌ 迁移失败: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_add_team_admin_id()


