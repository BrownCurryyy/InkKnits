from backend.models.station import Station
from backend.repositories.base_repository import BaseRepository


class StationRepository(BaseRepository[Station]):
    def __init__(self, session):
        super().__init__(Station, session)
