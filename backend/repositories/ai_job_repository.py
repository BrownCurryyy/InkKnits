from backend.models.ai_job import AIJob
from backend.repositories.base_repository import BaseRepository


class AIJobRepository(BaseRepository[AIJob]):
    def __init__(self, session):
        super().__init__(AIJob, session)
