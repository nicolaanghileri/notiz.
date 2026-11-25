# notiz.

Desktop-Notizen-App für macOS und Windows: schnell in plain text hinschreiben, später mit KI zuverlässig wiederfinden. Die KI handelt nur auf Befehl.

Stack: Tauri 2 (Rust) + React/TypeScript, SQLite, Claude API.

## Struktur

| Pfad | Inhalt |
|---|---|
| `docs/BRIEF.md` | Komplette Beschreibung: Screens, Verhalten, Stil, Tech-Stack, MVP |
| `docs/design/` | 7 Design-Screenshots (Referenz) |
| `CONTRACT.md` | Schnittstelle Backend ↔ Frontend |
| `AGENTS.md` | Regeln für Coding-Agents |
| `prompts/` | Start-Prompts: Setup, Agent A (Backend), Agent B (Frontend) |
| `OPEN_QUESTIONS.md` | Offene Fragen der Agents |

## Ablauf

1. `prompts/00-setup.md` in einer Agent-Session ausführen
2. Danach parallel `prompts/agent-a-backend.md` und `prompts/agent-b-frontend.md`, je auf eigenem Branch
3. Zwischendurch `OPEN_QUESTIONS.md` prüfen und entscheiden
4. Integration: Mock aus, echte Backend-Commands an, gemeinsam testen

## Starten

Voraussetzungen:

- Node.js 20.19+ oder 22.12+
- Rust 1.90+ (<https://rustup.rs>)
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Microsoft C++ Build Tools und WebView2 (bei Windows 11 schon dabei)

```sh
npm install
npm run tauri dev     # Desktop-App mit Hot Reload
npm run dev           # nur das Frontend im Browser (mit Mock): http://localhost:1420
npm run build         # Typecheck + Frontend-Build
npm run tauri build   # fertige App
cd src-tauri && cargo test
```

### Mock oder echtes Backend

`VITE_USE_MOCK` in `.env.development` schaltet um. Standard in der Entwicklung ist `true` (Mock im Speicher, `src/lib/mock.ts`). Echte Commands:

```sh
VITE_USE_MOCK=false npm run tauri dev     # Windows: in .env.development.local setzen
```

Produktions-Builds nutzen immer das echte Backend, ausser `VITE_USE_MOCK=true` ist gesetzt. Im Phase-0-Stand antworten alle echten Commands mit `not implemented`.
