from fastapi import FastAPI

from backend.app.routers.activities import router as activities_router
from backend.app.routers.assets import router as assets_router
from backend.app.routers.auth import router as auth_router
from backend.app.routers.organizations import router as organizations_router
from backend.app.routers.projects import router as projects_router
from backend.app.routers.versions import router as versions_router
from backend.app.routers.rbac import router as rbac_router
from backend.app.routers.stations import router as stations_router

app = FastAPI(title="InkKnits API", version="0.1.0")

app.include_router(auth_router)
app.include_router(organizations_router)
app.include_router(projects_router)
app.include_router(stations_router)
app.include_router(assets_router)
app.include_router(versions_router)
app.include_router(activities_router)
app.include_router(rbac_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
