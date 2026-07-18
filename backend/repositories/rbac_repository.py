from backend.models.rbac import Role, Permission, RolePermission, UserRole
from backend.repositories.base_repository import BaseRepository


class RoleRepository(BaseRepository[Role]):
    def __init__(self, session):
        super().__init__(Role, session)


class PermissionRepository(BaseRepository[Permission]):
    def __init__(self, session):
        super().__init__(Permission, session)
