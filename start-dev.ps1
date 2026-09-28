$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path .env)) { Write-Error "Missing .env - copy .env.example to .env and fill in values."; exit 1 }
if (-not (Test-Path backend/.venv)) { python -m venv backend/.venv }
& backend/.venv/Scripts/pip install -q -r backend/requirements.txt
Push-Location frontend; npm install --silent; Pop-Location
$backend = Start-Process -PassThru -NoNewWindow -WorkingDirectory backend -FilePath "$PSScriptRoot/backend/.venv/Scripts/uvicorn.exe" -ArgumentList "app.main:app","--reload","--port","8000"
try { Push-Location frontend; npm run dev } finally { Pop-Location; Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue }
