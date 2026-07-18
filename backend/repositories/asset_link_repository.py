from backend.models.asset_link import AssetLink
from backend.repositories.base_repository import BaseRepository


class AssetLinkRepository(BaseRepository[AssetLink]):
    def __init__(self, session):
        super().__init__(AssetLink, session)
