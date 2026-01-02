"""球员数据模型"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.base import Base


class Player(Base):
    """球员模型"""
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    number = Column(Integer, nullable=False)  # 球衣号码
    avatar = Column(String(255), nullable=True)  # 头像文件路径或URL
    position = Column(String(20), nullable=True)  # 位置：PG, SG, SF, PF, C
    display_order = Column(Integer, nullable=False, default=0)  # 显示顺序，用于排序和确定首发
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    team = relationship("Team", back_populates="players")
    game_players = relationship("GamePlayer", back_populates="player", cascade="all, delete-orphan")
    statistics = relationship("Statistic", back_populates="player", cascade="all, delete-orphan", foreign_keys="[Statistic.player_id]")

    def __repr__(self) -> str:
        return f"<Player(id={self.id}, name='{self.name}', number={self.number})>"

