import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv()


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    hindsight_api_url: str = ""
    hindsight_api_key: str = ""
    hindsight_bank_id: str = "incident-intelligence"
    hindsight_timeout: float = 60.0
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "incident_intelligence"
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:5173"])

    @property
    def hindsight_configured(self) -> bool:
        return bool(self.hindsight_api_url and self.hindsight_api_key)

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key and self.llm_base_url and self.llm_model)


def load_settings() -> Settings:
    return Settings(
        hindsight_api_url=os.getenv("HINDSIGHT_API_URL", "").strip(),
        hindsight_api_key=os.getenv("HINDSIGHT_API_KEY", "").strip(),
        hindsight_bank_id=os.getenv("HINDSIGHT_BANK_ID", "incident-intelligence").strip() or "incident-intelligence",
        hindsight_timeout=_float("HINDSIGHT_TIMEOUT_SECONDS", 60.0),
        llm_api_key=os.getenv("LLM_API_KEY", "").strip(),
        llm_base_url=os.getenv("LLM_BASE_URL", "").strip().rstrip("/"),
        llm_model=os.getenv("LLM_MODEL", "").strip(),
        mongodb_uri=os.getenv("MONGODB_URI", "mongodb://localhost:27017"),
        mongodb_db=os.getenv("MONGODB_DB", "incident_intelligence"),
        cors_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
    )
