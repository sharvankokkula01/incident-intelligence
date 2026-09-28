# Incident Intelligence

> Every incident makes the next incident easier to solve.

An AI-assisted production-incident decision-support app for SRE/DevOps teams. It learns from past incidents using the **real Hindsight memory platform** (Hindsight Cloud): resolved incidents are *retained*, new incidents *recall* similar experience (what failed, what worked, evidence), and *reflect* surfaces recurring patterns. It never executes anything against infrastructure.

## Architecture

```
React/Vite UI ──HTTP──> FastAPI backend ──> Hindsight Cloud (retain / recall / reflect)
                              ├────────────> OpenAI-compatible LLM (recommendation synthesis)
                              └────────────> MongoDB (incident METADATA only)
```
Hindsight and LLM credentials exist only in the backend. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Setup

Prerequisites: Python 3.10+, Node 18+, MongoDB (or Docker), a Hindsight Cloud account, an OpenAI-compatible LLM key.

```bash
cp .env.example .env          # fill in values (see below)
docker compose up -d mongo    # or point MONGODB_URI at your own MongoDB
./start-dev.sh                # Windows: ./start-dev.ps1
```
Backend: http://localhost:8000 (docs at `/docs`). Frontend: http://localhost:5173 (opens on New Incident Investigation).

Manual start:
```bash
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

## Environment variables (`.env`, never committed)

| Variable | Purpose |
|---|---|
| `HINDSIGHT_API_URL`, `HINDSIGHT_API_KEY` | Hindsight Cloud endpoint and key (backend only) |
| `HINDSIGHT_BANK_ID` | Memory bank (default `incident-intelligence`) |
| `HINDSIGHT_TIMEOUT_SECONDS` | Per-call timeout (default 60) |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Any OpenAI-compatible `/chat/completions` provider (backend only) |
| `MONGODB_URI`, `MONGODB_DB` | Metadata database |
| `CORS_ORIGINS` | Allowed browser origins (default `http://localhost:5173`) |
| `VITE_API_BASE_URL` | The only variable the frontend reads |

## MongoDB
Stores incident metadata (fields, status, retain status, the last investigation payload). It is **not** the memory engine. `docker compose up -d mongo` starts a local instance.

## Hindsight flows
Uses the official `hindsight-client` async API (`aretain`, `arecall`, `areflect`), isolated in `backend/app/hindsight_service.py`.

- **RETAIN** — a resolved incident is written as a structured narrative (service, severity, error, symptoms, change, root cause, failed actions, successful actions, resolution) with stable `document_id = incident-<id>`, so re-retaining updates rather than duplicates. Demo loading skips incidents already retained.
- **RECALL** — the new incident (service, error, symptoms, change, logs) is sent as the query. Recalled memories are grouped by incident ID; the LLM receives the current incident plus recalled evidence and returns root cause, steps, confidence (capped at 85%), evidence basis and a validation warning. Nothing is stored before recall succeeds. No memories → exactly `No relevant historical experience found.`
- **REFLECT** — four fixed questions are put to Hindsight REFLECT and rendered verbatim, labelled "Hindsight REFLECT".

## Demo
Follow [docs/DEMO.md](docs/DEMO.md): Load demo memory → investigate Incident 1087 → Historical Experience Found → resolve & retain → REFLECT.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ok, hindsight_configured, llm_configured, bank_id}`; never returns keys |
| GET | `/api/dashboard` | counts, recent incidents, live Hindsight reachability, LLM status |
| GET | `/api/incidents` | all incident metadata, chronological |
| POST | `/api/demo/load` | RETAINs 5 demo incidents; returns real counts; 503 if Hindsight down |
| POST | `/api/incidents/investigate` | validate → RECALL → recommend → store; 422 / 409 / 503 |
| POST | `/api/incidents/{id}/resolve` | RETAIN then mark resolved; 404 / 409 / 503 |
| POST | `/api/patterns/reflect` | four REFLECT queries; 503 if all fail |

## Security notes
Secrets are read only from the backend environment; `.env` is git-ignored; errors returned to clients are sanitised (details are logged server-side only); all input is Pydantic-validated with length limits; every outbound call has a timeout; the app only advises and never runs commands.

## Testing
```bash
cd backend && pytest
cd frontend && npm run build
```
Backend tests use in-process test doubles for Hindsight/LLM/MongoDB **only inside the test suite** so they run offline; the real Hindsight integration is exercised by following the demo with real credentials.

## Troubleshooting
- **503 "Hindsight memory service is unavailable"** — check `HINDSIGHT_API_URL/KEY`, network, and backend logs (the real cause is logged there).
- **Recall finds nothing** — Hindsight processes retained content asynchronously; wait a few seconds after loading demo memory and retry.
- **"Metadata database is unavailable"** — start MongoDB / check `MONGODB_URI`.
- **LLM unavailable** — recalled evidence is still shown; no recommendation is synthesised.
- **CORS errors** — add your frontend origin to `CORS_ORIGINS`.

## Project structure
```
backend/app/   config, models, hindsight_service, llm, store, main (FastAPI)
backend/tests/ pytest suite (+ e2e happy path)
frontend/src/  pages/, components/, api.js
data/          demo incidents (1042, 1043, 2011, 3014, 4017) and the 1087 test incident
docs/          DEMO.md, ARCHITECTURE.md, PROGRESS.md
```
