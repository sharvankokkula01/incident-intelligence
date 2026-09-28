"""Thin server-side wrapper around the official Hindsight async client.

Uses hindsight-client: Hindsight(base_url=..., api_key=...) with
aretain / arecall / areflect. All SDK access is isolated here.
"""
import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

from .config import Settings

log = logging.getLogger("incident.hindsight")


class HindsightUnavailable(Exception):
    """Hindsight is not configured, unreachable, timed out, or returned an error."""


@dataclass
class MemoryHit:
    text: str
    incident_id: Optional[str]
    type: str = ""
    context: str = ""
    document_id: str = ""


_ID_RE = re.compile(r"[Ii]ncident\s+#?([A-Za-z0-9-]{3,})")


def incident_id_from(document_id: str, metadata: Any, text: str) -> Optional[str]:
    if isinstance(metadata, dict) and metadata.get("incident_id"):
        return str(metadata["incident_id"])
    if document_id and document_id.startswith("incident-"):
        return document_id[len("incident-"):]
    m = _ID_RE.search(text or "")
    return m.group(1) if m else None


class HindsightService:
    def __init__(self, settings: Settings):
        self.s = settings
        self._client = None

    @property
    def configured(self) -> bool:
        return self.s.hindsight_configured

    def _get(self):
        if not self.configured:
            raise HindsightUnavailable("Hindsight is not configured")
        if self._client is None:
            try:
                from hindsight_client import Hindsight

                self._client = Hindsight(
                    base_url=self.s.hindsight_api_url,
                    api_key=self.s.hindsight_api_key,
                    timeout=self.s.hindsight_timeout,
                )
            except Exception as e:  # import or construction failure
                log.error("Hindsight client init failed: %s", type(e).__name__)
                raise HindsightUnavailable("Hindsight client could not be initialised") from e
        return self._client

    async def _run(self, coro):
        try:
            return await asyncio.wait_for(coro, timeout=self.s.hindsight_timeout)
        except HindsightUnavailable:
            raise
        except Exception as e:
            log.error("Hindsight call failed: %s: %s", type(e).__name__, e)
            raise HindsightUnavailable("Hindsight request failed") from e

    async def retain(self, *, content: str, document_id: str, context: str,
                     timestamp=None, metadata: Optional[dict] = None) -> None:
        client = self._get()
        kwargs = dict(bank_id=self.s.hindsight_bank_id, content=content,
                      document_id=document_id, context=context)
        if timestamp is not None:
            kwargs["timestamp"] = timestamp
        if metadata:
            kwargs["metadata"] = metadata
        await self._run(client.aretain(**kwargs))

    async def recall(self, query: str) -> list[MemoryHit]:
        client = self._get()
        resp = await self._run(client.arecall(bank_id=self.s.hindsight_bank_id, query=query))
        results = getattr(resp, "results", resp) or []
        hits: list[MemoryHit] = []
        for r in results:
            text = getattr(r, "text", "") or ""
            if not text:
                continue
            doc_id = getattr(r, "document_id", "") or ""
            hits.append(MemoryHit(
                text=text,
                incident_id=incident_id_from(doc_id, getattr(r, "metadata", None), text),
                type=str(getattr(r, "type", "") or ""),
                context=str(getattr(r, "context", "") or ""),
                document_id=doc_id,
            ))
        return hits

    async def reflect(self, query: str) -> str:
        client = self._get()
        resp = await self._run(client.areflect(bank_id=self.s.hindsight_bank_id, query=query))
        return (getattr(resp, "text", None) or "").strip()

    async def ping(self) -> bool:
        """Cheap live reachability check (one small recall)."""
        try:
            await self.recall("connectivity check")
            return True
        except HindsightUnavailable:
            return False
