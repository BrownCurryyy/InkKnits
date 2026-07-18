from backend.models.asset_version import AssetVersion
from backend.repositories.base_repository import BaseRepository


class AssetVersionRepository(BaseRepository[AssetVersion]):
    def __init__(self, session):
        super().__init__(AssetVersion, session)
