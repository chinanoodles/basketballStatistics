"""初始化数据库脚本"""
from app.database import init_db
from app.database.base import engine

if __name__ == "__main__":
    print("正在初始化数据库...")
    init_db()
    print("数据库初始化完成！")

