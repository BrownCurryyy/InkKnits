from backend.models.organization import Organization
from backend.repositories.base_repository import BaseRepository


class OrganizationRepository(BaseRepository[Organization]):
    def __init__(self, session):
        super().__init__(Organization, session)
