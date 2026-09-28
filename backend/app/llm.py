import json
import logging
import re
from typing import Optional

import httpx

from .config import Settings
from .hindsight_service import MemoryHit

log = logging.getLogger("incident.llm")

SYSTEM = (
    "You are an SRE decision-support assistant. You NEVER execute commands and NEVER claim certainty. "
    "You are given a current incident and memories recalled from past incidents. Use ONLY the recalled "
    "memories as historical evidence; do not invent history. Respond with a single JSON object with keys: "
    '"relevant" (bool: are the memories genuinely about a similar failure), '
    '"historical_incident_id" (string or null), "similarity_context" (string), '
    '"probable_root_cause" (string, hedged), "failed_actions" (list of strings from history), '
    '"successful_actions" (list of strings from history), "historical_resolution" (string), '
    '"recommended_next_steps" (list of short strings; investigative/validating steps), '
    '"confidence" (number 0..1), "evidence_basis" (list of short strings quoting or paraphrasing memories), '
    '"validation_warning" (string telling the engineer to verify before acting). JSON only.'
)


class LLMUnavailable(Exception):
    pass


class LLMService:
    def __init__(self, settings: Settings):
        self.s = settings

    @property
    def configured(self) -> bool:
        return self.s.llm_configured

    async def recommend(self, incident: dict, hits: list[MemoryHit]) -> dict:
        if not self.configured:
            raise LLMUnavailable("LLM not configured")
        memories = "\n".join(f"[{i+1}] (incident {h.incident_id or 'unknown'}) {h.text}" for i, h in enumerate(hits))
        user = ("CURRENT INCIDENT:\n" + json.dumps(incident, indent=2) +
                "\n\nRECALLED HISTORICAL MEMORIES:\n" + memories)
        body = {"model": self.s.llm_model, "temperature": 0.2,
                "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]}
        try:
            async with httpx.AsyncClient(timeout=60) as c:
                r = await c.post(f"{self.s.llm_base_url}/chat/completions", json=body,
                                 headers={"Authorization": f"Bearer {self.s.llm_api_key}"})
                r.raise_for_status()
                content = r.json()["choices"][0]["message"]["content"]
            m = re.search(r"\{.*\}", content, re.S)
            return json.loads(m.group(0))
        except Exception as e:
            log.error("LLM call failed: %s", type(e).__name__)
            raise LLMUnavailable("LLM request failed") from e
