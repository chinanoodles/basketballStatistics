"""用户-联赛关联表（多对多关系）"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Table
from sqlalchemy.sql import func
from app.database.base import Base

# 用户-联赛关联表（多对多关系）
user_league_association = Table(
    'user_leagues',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('league_id', Integer, ForeignKey('leagues.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)

