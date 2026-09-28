from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Severity = Literal["SEV-1", "SEV-2", "SEV-3", "SEV-4"]


class _Trimmed(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class IncidentIn(_Trimmed):
    incident_id: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9-]{1,32}$")
    service: str = Field(min_length=2, max_length=120)
    severity: Severity
    error_message: str = Field(min_length=3, max_length=2000)
    symptoms: str = Field(min_length=3, max_length=4000)
    logs: str = Field(default="", max_length=20000)
    recent_change: str = Field(default="", max_length=2000)

    @field_validator("incident_id", mode="before")
    @classmethod
    def _empty_id(cls, v):
        return v or None


class ResolveIn(_Trimmed):
    root_cause: str = Field(min_length=3, max_length=2000)
    failed_actions: list[str] = Field(default_factory=list, max_length=20)
    successful_actions: list[str] = Field(default_factory=list, max_length=20)
    resolution: str = Field(min_length=3, max_length=4000)

    @field_validator("failed_actions", "successful_actions")
    @classmethod
    def _clean(cls, v: list[str]) -> list[str]:
        out = [s.strip()[:500] for s in v if s and s.strip()]
        return out
