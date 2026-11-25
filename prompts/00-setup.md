# Prompt: Phase 0 – Setup

Einmal ausführen, **bevor** Agent A und Agent B starten. Diesen Text in eine neue Agent-Session kopieren:

---

```
Du richtest das Projekt "notiz." ein. Lies zuerst:
- AGENTS.md
- docs/BRIEF.md (vor allem Abschnitte 11, 14 und 15)
- CONTRACT.md
- die 7 Screenshots in docs/design/

Aufgabe (Phase 0, noch KEINE Features bauen):
1. Im bestehenden Repo ein Tauri-2-Projekt mit React + TypeScript + Vite
   anlegen (Frontend in src/, Backend in src-tauri/). Tailwind CSS,
   Lucide-Icons und die Schrift Inter (lokal gebündelt) einrichten.
2. .gitignore um Node/Vite/Tauri-Einträge ergänzen.
3. Typen aus CONTRACT.md auf beiden Seiten anlegen:
   - src/lib/types.ts (TypeScript)
   - src-tauri/src/models.rs (Rust-Structs, serde, camelCase)
4. src/lib/api.ts anlegen: eine Funktion pro Command aus CONTRACT.md plus
   Event-Listener. Mit einer MOCK-Implementierung (im Speicher, mit den
   deutschen Beispielnotizen aus den Screenshots, inkl. simuliertem
   KI-Streaming) und einem Schalter (z. B. VITE_USE_MOCK=true), der auf
   echte invoke()-Calls umstellt.
5. In src-tauri/ alle Commands als leere Stubs registrieren
   (geben vorerst einen Fehler "not implemented" zurück).
6. Prüfen, dass `npm run tauri dev` startet und ein leeres Fenster zeigt.
7. README.md kurz ergänzen: wie man das Projekt startet.

CONTRACT.md nicht inhaltlich ändern. Unklarheiten in OPEN_QUESTIONS.md.
Am Ende: kurz zusammenfassen, was angelegt wurde, und committen
mit der Nachricht "Phase 0: Projekt-Setup".
```
