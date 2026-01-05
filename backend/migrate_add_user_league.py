"""数据库迁移脚本：添加用户和联赛系统"""
# 确保所有模型都被导入（按依赖顺序）
from app.models.user import User, UserRole
from app.models.league import League
from app.models.team import Team
from app.models.game import Game, GamePlayer, SeasonType
from app.models.player import Player
from app.models.statistic import Statistic
from app.models.player_time import PlayerTime
from app.database.base import Base, engine, SessionLocal
from app.core.security import get_password_hash

def migrate():
    """执行数据库迁移"""
    print("开始数据库迁移...")
    
    # 创建所有新表
    Base.metadata.create_all(bind=engine)
    print("✅ 已创建新表（users, leagues）")
    
    db = SessionLocal()
    try:
        # 1. 创建默认联赛（如果不存在）
        default_league = db.query(League).filter(League.name == "默认联赛").first()
        if not default_league:
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
        
        # 2. 创建默认管理员用户（如果不存在）
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@example.com",
                hashed_password=get_password_hash("admin123"),  # 默认密码，请修改！
                role=UserRole.ADMIN,
                league_id=default_league.id,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("✅ 已创建默认管理员用户 (username: admin, password: admin123)")
            print("⚠️  请尽快修改默认管理员密码！")
        else:
            print("✅ 管理员用户已存在")
        
        # 3. 为现有数据添加league_id（如果有数据）
        # 注意：这需要手动处理，因为现有数据没有league_id
        # 建议：先备份数据库，然后手动分配league_id
        
        print("\n⚠️  重要提示：")
        print("1. 现有数据（teams, games等）需要手动分配league_id")
        print("2. 建议先备份数据库")
        print("3. 可以通过SQL更新现有数据：")
        print(f"   UPDATE teams SET league_id = {default_league.id} WHERE league_id IS NULL;")
        print(f"   UPDATE games SET league_id = {default_league.id} WHERE league_id IS NULL;")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 迁移失败: {e}")
        raise
    finally:
        db.close()
    
    print("\n✅ 数据库迁移完成！")

if __name__ == "__main__":
    migrate()

