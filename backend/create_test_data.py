"""创建测试数据脚本"""
from app.database import SessionLocal, init_db
from app.models.team import Team
from app.models.player import Player

def create_test_data():
    """创建测试数据"""
    init_db()
    db = SessionLocal()
    
    try:
        # 创建测试球队
        team1 = Team(name="测试主队", logo=None)
        team2 = Team(name="测试客队", logo=None)
        db.add(team1)
        db.add(team2)
        db.commit()
        db.refresh(team1)
        db.refresh(team2)
        
        print(f"创建球队: {team1.name} (ID: {team1.id})")
        print(f"创建球队: {team2.name} (ID: {team2.id})")
        
        # 为主队创建球员
        home_players = [
            Player(team_id=team1.id, name="张三", number=1, position="PG"),
            Player(team_id=team1.id, name="李四", number=2, position="SG"),
            Player(team_id=team1.id, name="王五", number=3, position="SF"),
            Player(team_id=team1.id, name="赵六", number=4, position="PF"),
            Player(team_id=team1.id, name="孙七", number=5, position="C"),
            Player(team_id=team1.id, name="周八", number=6, position="PG"),
            Player(team_id=team1.id, name="吴九", number=7, position="SG"),
        ]
        
        # 为客队创建球员
        away_players = [
            Player(team_id=team2.id, name="郑一", number=10, position="PG"),
            Player(team_id=team2.id, name="钱二", number=11, position="SG"),
            Player(team_id=team2.id, name="孙三", number=12, position="SF"),
            Player(team_id=team2.id, name="李四", number=13, position="PF"),
            Player(team_id=team2.id, name="周五", number=14, position="C"),
            Player(team_id=team2.id, name="吴六", number=15, position="PG"),
            Player(team_id=team2.id, name="郑七", number=16, position="SG"),
        ]
        
        for player in home_players + away_players:
            db.add(player)
        
        db.commit()
        
        print(f"创建了 {len(home_players)} 名主队球员")
        print(f"创建了 {len(away_players)} 名客队球员")
        print("\n测试数据创建完成！")
        print(f"主队ID: {team1.id}, 客队ID: {team2.id}")
        
    except Exception as e:
        print(f"创建测试数据失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()

