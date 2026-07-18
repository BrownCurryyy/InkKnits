from backend.models.approval_task import ApprovalTask
from backend.repositories.base_repository import BaseRepository


class ApprovalTaskRepository(BaseRepository[ApprovalTask]):
    def __init__(self, session):
        super().__init__(ApprovalTask, session)
