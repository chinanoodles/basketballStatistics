"""清理比赛数据脚本"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.database.base import get_db, init_db
from app.models.game import Game, GamePlayer
from app.models.statistic import Statistic
from app.models.player_time import PlayerTime
from app.models.league import League

def cleanup_games_for_league(league_name: str = 'auba-s2', auto_confirm: bool = False):
    """清理指定联赛的所有比赛数据"""
    # 初始化数据库
    init_db()
    
    # 获取数据库会话
    db = next(get_db())
    
    try:
        # 查找联赛
        league = db.query(League).filter(League.name == league_name).first()
        if not league:
            print(f"未找到联赛: {league_name}")
            return
        
        print(f"找到联赛: {league_name} (ID: {league.id})")
        
        # 查找该联赛的所有比赛
        games = db.query(Game).filter(Game.league_id == league.id).all()
        print(f"找到 {len(games)} 场比赛")
        
        if len(games) == 0:
            print("没有需要删除的比赛")
            return
        
        # 确认删除
        print("\n将要删除以下数据：")
        print(f"  - {len(games)} 场比赛")
        
        # 统计相关数据
        game_ids = [g.id for g in games]
        
        stats_count = db.query(Statistic).filter(Statistic.game_id.in_(game_ids)).count()
        game_players_count = db.query(GamePlayer).filter(GamePlayer.game_id.in_(game_ids)).count()
        player_times_count = db.query(PlayerTime).filter(PlayerTime.game_id.in_(game_ids)).count()
        
        print(f"  - {stats_count} 条统计数据")
        print(f"  - {game_players_count} 条比赛球员记录")
        print(f"  - {player_times_count} 条球员时间记录")
        
        # 如果提供了 --yes 参数，直接删除
        if not auto_confirm:
            response = input("\n确认删除？(yes/no): ")
            if response.lower() != 'yes':
                print("取消删除")
                return
        else:
            print("\n自动确认删除...")
        
        # 删除统计数据
        print("\n删除统计数据...")
        db.query(Statistic).filter(Statistic.game_id.in_(game_ids)).delete(synchronize_session=False)
        
        # 删除球员时间记录
        print("删除球员时间记录...")
        db.query(PlayerTime).filter(PlayerTime.game_id.in_(game_ids)).delete(synchronize_session=False)
        
        # 删除比赛球员关联
        print("删除比赛球员关联...")
        db.query(GamePlayer).filter(GamePlayer.game_id.in_(game_ids)).delete(synchronize_session=False)
        
        # 删除比赛
        print("删除比赛...")
        db.query(Game).filter(Game.id.in_(game_ids)).delete(synchronize_session=False)
        
        db.commit()
        
        print(f"\n✅ 成功删除 {len(games)} 场比赛及相关数据")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 删除失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    # 解析参数
    auto_confirm = '--yes' in sys.argv or '-y' in sys.argv
    league_name = 'auba-s2'
    
    # 查找非标志参数作为联赛名称
    auto_confirm = '--yes' in sys.argv or '-y' in sys.argv
    for arg in sys.argv[1:]:
        if arg not in ['--yes', '-y']:
            league_name = arg
            break
    
    cleanup_games_for_league(league_name, auto_confirm)

