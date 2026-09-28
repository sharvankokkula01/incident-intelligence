# Architecture

- **Frontend** (React, Vite, Tailwind, React Router, lucide-react). CSS-only animation with `prefers-reduced-motion` support; all information is present in the DOM regardless of animation. Talks only to the backend via `VITE_API_BASE_URL`.
- **Backend** (FastAPI, async). `create_app()` takes injectable Hindsight/LLM/store services (used by tests).
  - `hindsight_service.py` — only place the `hindsight-client` SDK is used; wraps `aretain/arecall/areflect` with timeouts; any failure becomes `HindsightUnavailable` → HTTP 503 with a sanitised message.
  - `llm.py` — OpenAI-compatible chat completion asked for strict JSON; failure → `LLMUnavailable` (evidence still shown).
  - `store.py` — MongoDB metadata only (Motor); failure → `StoreUnavailable` → 503.
- **Memory loop**: resolved incident → RETAIN (`document_id=incident-<id>`) → recall on new incident → LLM synthesises from *recalled evidence only* → engineer resolves → RETAIN → REFLECT.
- **Invariants**: no memory is faked or stored locally; nothing stored before successful recall; confidence capped at 0.85; incident is marked resolved only after RETAIN succeeds.
- **Uncertainty**: the UI and prompts use hedged language and always show a validation warning.
