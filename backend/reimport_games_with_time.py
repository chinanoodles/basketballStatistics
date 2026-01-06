#!/usr/bin/env python3
"""重新导入比赛数据，包含时间维度"""
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.database.base import get_db, init_db
from app.models.game import Game
from app.models.statistic import Statistic
from app.models.player_time import PlayerTime
from app.models.league import League
from app.models.user import User, UserRole
from batch_import_games import import_game_from_csv

def main():
    # 初始化数据库
    init_db()
    
    # 获取数据库会话
    db = next(get_db())
    
    # 获取或创建league和team_admin
    league = db.query(League).filter(League.name == "auba-s2").first()
    if not league:
        print("错误: 找不到auba-s2联赛")
        return
    
    team_admin = db.query(User).filter(
        User.username == "noodles",
        User.role == UserRole.TEAM_ADMIN
    ).first()
    if not team_admin:
        print("错误: 找不到noodles用户")
        return
    
    print(f"使用联赛: {league.name} (ID: {league.id})")
    print(f"使用领队: {team_admin.username} (ID: {team_admin.id})")
    
    # 获取reference/games目录下的所有CSV文件
    reference_dir = Path(__file__).parent.parent / "reference" / "games"
    if not reference_dir.exists():
        print(f"错误: 找不到目录 {reference_dir}")
        return
    
    csv_files = list(reference_dir.glob("*.csv"))
    if not csv_files:
        print(f"错误: 在 {reference_dir} 中找不到CSV文件")
        return
    
    print(f"\n找到 {len(csv_files)} 个CSV文件")
    
    # 自动删除现有数据（非交互模式）
    print("\n自动删除现有数据...")
    if True:  # 自动删除
        # 删除现有的统计数据、上场时间记录和比赛
        print("\n删除现有数据...")
        deleted_stats = db.query(Statistic).filter(
            Statistic.game_id.in_(
                db.query(Game.id).filter(Game.league_id == league.id)
            )
        ).delete(synchronize_session=False)
        deleted_times = db.query(PlayerTime).filter(
            PlayerTime.game_id.in_(
                db.query(Game.id).filter(Game.league_id == league.id)
            )
        ).delete(synchronize_session=False)
        deleted_games = db.query(Game).filter(Game.league_id == league.id).delete(synchronize_session=False)
        db.commit()
        print(f"  删除 {deleted_games} 场比赛")
        print(f"  删除 {deleted_stats} 条统计数据")
        print(f"  删除 {deleted_times} 条上场时间记录")
    
    # 导入每个CSV文件
    print("\n开始导入比赛数据...")
    success_count = 0
    error_count = 0
    
    for csv_file in csv_files:
        try:
            game = import_game_from_csv(
                str(csv_file),
                db,
                league_id=league.id,
                team_admin_id=team_admin.id
            )
            if game:
                success_count += 1
                print(f"  ✓ 成功导入: {csv_file.name}")
            else:
                error_count += 1
                print(f"  ✗ 跳过: {csv_file.name}")
        except Exception as e:
            error_count += 1
            print(f"  ✗ 错误导入 {csv_file.name}: {e}")
    
    print(f"\n导入完成!")
    print(f"  成功: {success_count}")
    print(f"  失败/跳过: {error_count}")

if __name__ == "__main__":
    main()
