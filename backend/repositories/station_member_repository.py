from backend.models.station_member import StationMember
from backend.repositories.base_repository import BaseRepository


class StationMemberRepository(BaseRepository[StationMember]):
    def __init__(self, session):
        super().__init__(StationMember, session)
