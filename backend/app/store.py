import logging
from typing import Optional

log = logging.getLogger("incident.store")


class StoreUnavailable(Exception):
    pass


class MongoStore:
    """Incident/application METADATA only. Not a memory engine."""

    def __init__(self, uri: str, db: str):
        from motor.motor_asyncio import AsyncIOMotorClient

        self._client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=4000)
        self._col = self._client[db]["incidents"]

    async def _do(self, coro):
        try:
            return await coro
        except Exception as e:
            log.error("MongoDB error: %s", type(e).__name__)
            raise StoreUnavailable("Metadata database unavailable") from e

    async def get(self, incident_id: str) -> Optional[dict]:
        return await self._do(self._col.find_one({"_id": incident_id}))

    async def save(self, doc: dict) -> None:
        d = dict(doc)
        await self._do(self._col.replace_one({"_id": d["id"]}, {**d, "_id": d["id"]}, upsert=True))

    async def list(self) -> list[dict]:
        async def q():
            return await self._col.find({}).sort("occurred_at", 1).to_list(length=1000)
        return await self._do(q())

    async def ping(self) -> bool:
        try:
            await self._client.admin.command("ping")
            return True
        except Exception:
            return False
