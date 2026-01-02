"""比赛数据模型"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database.base import Base


class GameStatus(str, enum.Enum):
    """比赛状态"""
    PENDING = "pending"  # 待开始
    LIVE = "live"  # 进行中
    PAUSED = "paused"  # 暂停
    FINISHED = "finished"  # 已结束


class Game(Base):
    """比赛模型"""
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    date = Column(DateTime(timezone=True), nullable=False)
    duration = Column(Integer, nullable=False, default=40)  # 比赛时长（分钟）
    quarters = Column(Integer, nullable=False, default=4)  # 节数
    status = Column(Enum(GameStatus), default=GameStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    home_team = relationship("Team", foreign_keys=[home_team_id], back_populates="home_games")
    away_team = relationship("Team", foreign_keys=[away_team_id], back_populates="away_games")
    game_players = relationship("GamePlayer", back_populates="game", cascade="all, delete-orphan")
    statistics = relationship("Statistic", back_populates="game", cascade="all, delete-orphan")
    player_times = relationship("PlayerTime", back_populates="game", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Game(id={self.id}, home={self.home_team_id}, away={self.away_team_id})>"


class GamePlayer(Base):
    """比赛球员关联表"""
    __tablename__ = "game_players"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False, index=True)
    is_starter = Column(Boolean, default=False, nullable=False)  # 是否首发
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    game = relationship("Game", back_populates="game_players")
    player = relationship("Player", back_populates="game_players")

    def __repr__(self) -> str:
        return f"<GamePlayer(game_id={self.game_id}, player_id={self.player_id}, starter={self.is_starter})>"

