# AGENTS.md – Regeln für alle Coding-Agents

Projekt: **notiz.**, eine Desktop-Notizen-App (macOS + Windows) mit Tauri 2 (Rust) + React/TypeScript.

## Zuerst lesen
1. `docs/BRIEF.md`: was gebaut wird (Screens, Verhalten, Stil, Tech-Stack, MVP-Umfang)
2. `CONTRACT.md`: verbindliche Schnittstelle zwischen Backend und Frontend
3. `docs/design/*.png`: Design-Referenz, pixelnah umsetzen

## Wer arbeitet wo
| Agent | Ordner | Prompt |
|---|---|---|
| Setup (Phase 0) | ganzes Repo | `prompts/00-setup.md` |
| Agent A – Backend | nur `src-tauri/` | `prompts/agent-a-backend.md` |
| Agent B – Frontend | nur `src/` + Frontend-Konfiguration im Root* | `prompts/agent-b-frontend.md` |

\* `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `.env.development`. Diese Dateien ändert nur Agent B. `OPEN_QUESTIONS.md` dürfen beide ergänzen.

## Regeln
- Keine Dateien im Bereich des anderen Agents ändern.
- `CONTRACT.md` nicht eigenmächtig ändern. Fragen und fehlende Punkte gehören in `OPEN_QUESTIONS.md`, Nicola entscheidet.
- Die KI der App handelt nur auf Befehl. Keine automatischen Textänderungen, keine Push-Nachrichten, keine ungefragten Vorschläge.
- Notiztext geht nur an die Claude-API, wenn der Nutzer aktiv einen KI-Befehl ausführt oder eine Suchfrage stellt.
- API-Keys nie im Klartext speichern oder committen.
- UI-Texte auf Deutsch (Schweiz: immer „ss“ statt „ß“, auch wo die Screenshots „ß“ zeigen).
- Kleine, häufige Commits mit klaren Nachrichten.
