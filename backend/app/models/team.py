"""球队数据模型"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.base import Base


class Team(Base):
    """球队模型"""
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    logo = Column(String(255), nullable=True)  # Logo文件路径或URL
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=False, index=True)  # 所属联赛
    team_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # 所属领队（team_admin）
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    league = relationship("League", back_populates="teams")
    team_admin = relationship("User", foreign_keys=[team_admin_id], backref="managed_teams")
    players = relationship("Player", back_populates="team", cascade="all, delete-orphan")
    home_games = relationship("Game", foreign_keys="Game.home_team_id", back_populates="home_team")
    away_games = relationship("Game", foreign_keys="Game.away_team_id", back_populates="away_team")

    def __repr__(self) -> str:
        return f"<Team(id={self.id}, name='{self.name}')>"

