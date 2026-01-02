"""球员出场时间模型"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.base import Base


class PlayerTime(Base):
    """球员出场时间记录"""
    __tablename__ = "player_times"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False, index=True)
    quarter = Column(Integer, nullable=False)  # 第几节
    enter_time = Column(DateTime(timezone=True), nullable=False)  # 上场时间
    exit_time = Column(DateTime(timezone=True), nullable=True)  # 下场时间（如果还在场上则为None）
    duration_seconds = Column(Float, nullable=True)  # 本次出场时长（秒）
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    game = relationship("Game", back_populates="player_times")
    player = relationship("Player")

    def __repr__(self) -> str:
        return f"<PlayerTime(game_id={self.game_id}, player_id={self.player_id}, quarter={self.quarter})>"

