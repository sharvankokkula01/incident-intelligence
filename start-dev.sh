#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
[ -f .env ] || { echo "Missing .env - copy .env.example to .env and fill in values."; exit 1; }
[ -d backend/.venv ] || python3 -m venv backend/.venv
. backend/.venv/bin/activate
pip install -q -r backend/requirements.txt
(cd frontend && npm install --silent)
(cd backend && uvicorn app.main:app --reload --port 8000) &
BACK=$!
trap "kill $BACK" EXIT
(cd frontend && npm run dev)
