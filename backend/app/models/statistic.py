"""统计数据模型"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.base import Base


class Statistic(Base):
    """统计数据模型"""
    __tablename__ = "statistics"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False, index=True)
    quarter = Column(Integer, nullable=False)  # 第几节
    action_type = Column(String(20), nullable=False)  # 动作类型
    # 动作类型: 2PM, 2PA, 3PM, 3PA, FTM, FTA, OREB, DREB, AST, STL, BLK, TOV, PF, PFD
    shot_x = Column(Float, nullable=True)  # 投篮X坐标（百分比 0-100）
    shot_y = Column(Float, nullable=True)  # 投篮Y坐标（百分比 0-100）
    assisted_by_player_id = Column(Integer, ForeignKey("players.id"), nullable=True)  # 助攻球员ID
    rebounded_by_player_id = Column(Integer, ForeignKey("players.id"), nullable=True)  # 篮板球员ID
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    game = relationship("Game", back_populates="statistics")
    player = relationship("Player", back_populates="statistics", foreign_keys=[player_id])

    def __repr__(self) -> str:
        return f"<Statistic(id={self.id}, game_id={self.game_id}, player_id={self.player_id}, action='{self.action_type}')>"

