from backend.models.activity import Activity
from backend.repositories.base_repository import BaseRepository


class ActivityRepository(BaseRepository[Activity]):
    def __init__(self, session):
        super().__init__(Activity, session)
