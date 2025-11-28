from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, tests, results, groups, group_analytics

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(tests.router, prefix="/tests", tags=["tests"])
api_router.include_router(results.router, prefix="/results", tags=["results"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(group_analytics.router, tags=["analytics"])

