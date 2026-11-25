# Offene Fragen

Hier tragen die Agents alles ein, was im Brief oder im Vertrag fehlt oder unklar ist. Nicola entscheidet und schreibt die Antwort darunter.

Format:

```
## [Agent A|B] Kurzer Titel
Frage / Problem:
Meine Annahme (womit ich vorerst weitermache):
Entscheidung (Nicola):
```

---

## [Setup] Einheit der `highlights`
Frage / Problem: „Zeichen-Bereiche“ ist mehrdeutig. JavaScript zählt UTF-16-Einheiten, Rust Bytes oder Unicode-Zeichen. Bei Emojis verschieben sich die Markierungen.
Meine Annahme (womit ich vorerst weitermache): UTF-16-Einheiten, damit `text.slice(start, end)` im Frontend direkt stimmt. Agent A rechnet um.
Entscheidung (Nicola):

## [Setup] Parametername von `settings_set`
Frage / Problem: Der Vertrag nennt nur den Typ `Partial<Settings>`, keinen Namen. Tauri braucht auf beiden Seiten denselben.
Meine Annahme (womit ich vorerst weitermache): `partial` (wie im Brief, Abschnitt 15): `invoke('settings_set', { partial })`.
Entscheidung (Nicola):

## [Setup] Kurzantwort: Reihenfolge von Events und Rückgabe
Frage / Problem: Das Backend erzeugt `answerRequestId`. Das Frontend kennt sie erst nach der Antwort von `search`, `ai://`-Events könnten vorher eintreffen.
Meine Annahme (womit ich vorerst weitermache): Das Frontend meldet die Listener vor `search` an und puffert unbekannte IDs kurz. Der Mock startet das Streaming 500 ms nach der Suche.
Entscheidung (Nicola): Das Frontend erzeugt die ID und gibt sie bei `search` als `requestId` mit, wie bei den anderen KI-Befehlen. Kein Puffern nötig. CONTRACT.md ist angepasst; `answerRequestId` ist jetzt die übergebene ID oder `null`.

## [Setup] Quellen-Badges im Text
Frage / Problem: Wie die Badges im Antworttext codiert sind, steht nicht im Vertrag.
Meine Annahme (womit ich vorerst weitermache): Als `[1]`, `[2]`, `[3]` im Text, 1-basiert nach Reihenfolge der `hits`. `sources` enthält die zugehörigen Note-IDs.
Entscheidung (Nicola):

## [Setup] `ai_cancel`
Frage / Problem: Kommt nach dem Abbrechen noch ein Event?
Meine Annahme (womit ich vorerst weitermache): Nein, weder `ai://done` noch `ai://error`.
Entscheidung (Nicola):

## [Setup] Sortierung und Zeiträume
Frage / Problem: „Neueste zuerst“ nach `createdAt` oder `updatedAt`? Wo beginnen „Heute“, „Letzte 7 Tage“, „Letzter Monat“?
Meine Annahme (womit ich vorerst weitermache): `createdAt`, lokale Zeitzone. Heute = ab Mitternacht, 7 Tage = heute + 6 Tage davor, letzter Monat = letzte 30 Tage, dieses Jahr = Kalenderjahr.
Entscheidung (Nicola):

## [Setup] Wann kommt `notes://changed`?
Frage / Problem: Nur bei Quick Capture oder auch bei Löschen, Wiederherstellen usw.?
Meine Annahme (womit ich vorerst weitermache): Nur wenn die Notiz nicht aus der aktuellen Ansicht stammt. Der Mock sendet es bei `note_create` mit `source = 'quick'`.
Entscheidung (Nicola):

## [Setup] Quick-Capture-Fenster schliessen
Frage / Problem: Esc und ↵ müssen das Fenster schliessen. Dafür gibt es keinen Command.
Meine Annahme (womit ich vorerst weitermache): Das Frontend ruft `getCurrentWindow().hide()` auf, Agent A erlaubt das in `src-tauri/capabilities/`.
Entscheidung (Nicola):

## [Setup] Mehrfachauswahl: Korrigieren, Verbessern, eigene Anweisung
Frage / Problem: Für mehrere Notizen gibt es nur `ai_summarize_notes`, und das ohne Anweisung.
Meine Annahme (womit ich vorerst weitermache): Das Frontend ruft `ai_transform` pro Notiz auf, mit je eigener `requestId`.
Entscheidung (Nicola):

## [Setup] Reihenfolge der Tasten 1/2/3
Frage / Problem: Screen 2: Verbessern 1, Korrigieren 2, Zusammenfassen 3. Screen 6: Zusammenfassen 1, Korrigieren 2, Verbessern 3.
Meine Annahme (womit ich vorerst weitermache): Genau wie in den Screenshots, also unterschiedlich.
Entscheidung (Nicola): Überall gleich: Verbessern 1, Korrigieren 2, Zusammenfassen 3.

## [Setup] Abgeleiteter Titel
Frage / Problem: „Erste Zeile bzw. erster Satz“ passt nicht überall: In 1B steht „Zahnarzt verschoben auf Do 14:30, Dr. Keller …“ in einer Zeile, in 1A endet der Titel nach „14:30“. Texte weichen zwischen den Screens auch leicht ab.
Meine Annahme (womit ich vorerst weitermache): Erster Satz der ersten Zeile. Die Mock-Notizen haben dort einen Zeilenumbruch, damit die Titel wie in 1A aussehen.
Entscheidung (Nicola):

## [Setup] ss oder ß in UI-Texten
Frage / Problem: Die Screenshots zeigen „schließt“/„schließen“, AGENTS.md erlaubt „ss“, aber einheitlich.
Meine Annahme (womit ich vorerst weitermache): UI wie in den Screenshots mit ß. Notiztexte bleiben wie vorgegeben („heisst“).
Entscheidung (Nicola): Überall „ss“.

## [Setup] Wem gehören die Dateien im Root?
Frage / Problem: `package.json`, `vite.config.ts`, `index.html`, `.env.development` liegen ausserhalb von `src/` und `src-tauri/`. Agent B braucht z. B. das npm-Paket `diff`.
Meine Annahme (womit ich vorerst weitermache): Agent B darf sie ändern, Agent A nicht.
Entscheidung (Nicola):

## [Setup] Bundle-Identifier und App-Icon
Frage / Problem: Beides ist nicht vorgegeben. Der Identifier bestimmt u. a. das App-Data-Verzeichnis und sollte vor dem ersten echten Einsatz feststehen.
Meine Annahme (womit ich vorerst weitermache): `app.notiz.desktop`, `productName` „notiz“ ohne Punkt (Windows mag keine Pfade mit Punkt am Ende), Fenstertitel „notiz.“. Icons sind die Tauri-Platzhalter.
Entscheidung (Nicola):
