"""
SQLAlchemy declarative base — imported by all ORM models.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
