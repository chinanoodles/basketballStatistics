"""数据库迁移脚本：更新用户角色系统"""
from sqlalchemy import text
from app.database.base import engine, SessionLocal
from app.models.user import User, UserRole

def migrate():
    """执行数据库迁移：更新用户角色"""
    print("开始数据库迁移：更新用户角色系统...")
    
    conn = engine.connect()
    trans = conn.begin()
    
    try:
        # 检查users表是否有role列
        result = conn.execute(text("PRAGMA table_info(users)"))
        users_columns = [row[1] for row in result]
        
        if 'role' not in users_columns:
            print("为 users 表添加 role 列...")
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'player'"))
            print("✅ users 表已添加 role 列")
        else:
            print("✅ users 表已有 role 列")
        
        # 更新现有用户的角色
        # SQLite存储的是枚举的字符串值，需要更新为新的枚举值
        
        # 将原来的 'user' 或 'USER' 角色改为 'PLAYER'
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE role IN ('user', 'USER')"))
        user_count = result.scalar()
        if user_count > 0:
            conn.execute(text("UPDATE users SET role = 'PLAYER' WHERE role IN ('user', 'USER')"))
            print(f"✅ 已更新 {user_count} 个用户的角色为 'PLAYER'")
        
        # 将小写的 'player' 更新为大写的 'PLAYER'（枚举值）
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE role = 'player'"))
        player_lower_count = result.scalar()
        if player_lower_count > 0:
            conn.execute(text("UPDATE users SET role = 'PLAYER' WHERE role = 'player'"))
            print(f"✅ 已更新 {player_lower_count} 个用户的角色为 'PLAYER'")
        
        # 将小写的 'team_admin' 更新为大写的 'TEAM_ADMIN'（枚举值）
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE role = 'team_admin'"))
        team_admin_lower_count = result.scalar()
        if team_admin_lower_count > 0:
            conn.execute(text("UPDATE users SET role = 'TEAM_ADMIN' WHERE role = 'team_admin'"))
            print(f"✅ 已更新 {team_admin_lower_count} 个用户的角色为 'TEAM_ADMIN'")
        
        # 将小写的 'admin' 更新为大写的 'ADMIN'（枚举值）
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE role = 'admin'"))
        admin_lower_count = result.scalar()
        if admin_lower_count > 0:
            conn.execute(text("UPDATE users SET role = 'ADMIN' WHERE role = 'admin'"))
            print(f"✅ 已更新 {admin_lower_count} 个用户的角色为 'ADMIN'")
        
        # 确保admin用户角色正确（如果还是小写）
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE username = 'admin' AND role != 'ADMIN'"))
        admin_count = result.scalar()
        if admin_count > 0:
            conn.execute(text("UPDATE users SET role = 'ADMIN' WHERE username = 'admin'"))
            print("✅ 已更新管理员用户角色为 'ADMIN'")
        
        # 检查是否还有无效的角色值
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE role NOT IN ('PLAYER', 'TEAM_ADMIN', 'ADMIN')"))
        invalid_count = result.scalar()
        if invalid_count > 0:
            print(f"⚠️  发现 {invalid_count} 个无效角色值，需要手动处理")
            # 显示无效角色
            result = conn.execute(text("SELECT id, username, role FROM users WHERE role NOT IN ('PLAYER', 'TEAM_ADMIN', 'ADMIN')"))
            invalid_users = result.fetchall()
            for user in invalid_users:
                print(f"   用户 ID {user[0]}, 用户名: {user[1]}, 角色: {user[2]}")
        
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

