from backend.models.asset import Asset
from backend.repositories.base_repository import BaseRepository


class AssetRepository(BaseRepository[Asset]):
    def __init__(self, session):
        super().__init__(Asset, session)
