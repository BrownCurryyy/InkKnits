from __future__ import annotations

from typing import Generic, TypeVar

from sqlalchemy.orm import Session

from backend.database.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: type[ModelType], session: Session) -> None:
        self.model = model
        self.session = session

    def create(self, instance: ModelType) -> ModelType:
        self.session.add(instance)
        self.session.commit()
        self.session.refresh(instance)
        return instance

    def get_by_id(self, instance_id: str) -> ModelType | None:
        return self.session.get(self.model, instance_id)

    def list_all(self) -> list[ModelType]:
        return self.session.query(self.model).all()

    def delete(self, instance: ModelType) -> None:
        self.session.delete(instance)
        self.session.commit()
