"""联赛数据模型"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.base import Base
from app.models.user_league import user_league_association


class League(Base):
    """联赛模型"""
    __tablename__ = "leagues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    # 小组赛/常规赛名称（可自定义）
    regular_season_name = Column(String(50), default="小组赛", nullable=False)
    # 季后赛/淘汰赛名称（可自定义）
    playoff_name = Column(String(50), default="季后赛", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    users = relationship("User", back_populates="league", foreign_keys="User.league_id")  # 主联赛用户（向后兼容）
    members = relationship("User", secondary=user_league_association, back_populates="leagues")  # 多对多关系
    teams = relationship("Team", back_populates="league", cascade="all, delete-orphan")
    games = relationship("Game", back_populates="league", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<League(id={self.id}, name='{self.name}')>"

