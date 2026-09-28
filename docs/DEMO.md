# Demo script

Prerequisite: `.env` filled with real Hindsight + LLM credentials, MongoDB running, app started.

1. **Overview → Load demo memory.** Five resolved incidents (1042, 1043, 2011, 3014, 4017) are sent to Hindsight RETAIN. The message reports the real retained/skipped counts. Clicking again retains nothing new. If Hindsight is down you see a 503 error, never a fake success.
2. Wait a few seconds for Hindsight to finish indexing.
3. **New Incident → "Fill Incident 1087 example" → Investigate Incident.** Watch *Current Incident → Searching Hindsight*.
4. **Investigation** shows *HISTORICAL EXPERIENCE FOUND* (expect Incident 1042 or 1043): probable root cause, what failed (e.g. scaling replicas), what worked (e.g. rollback), the evidence recalled from memory, a recommendation, confidence (capped at 85%) and a validation warning.
5. **Resolve & Retain** — enter the confirmed cause, failed/successful actions and resolution (or use *Prefill from historical match* and review). The `retain-status` region confirms the real RETAIN.
6. **Run Hindsight REFLECT** — answers to four pattern questions, generated live by Hindsight.
7. **Memory Timeline** shows all incidents chronologically with retain status.

Empty-memory check: on a fresh bank, investigating shows exactly "No relevant historical experience found."
