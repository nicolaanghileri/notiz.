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
Entscheidung (Nicola): bestätigt

## [Setup] Parametername von `settings_set`
Frage / Problem: Der Vertrag nennt nur den Typ `Partial<Settings>`, keinen Namen. Tauri braucht auf beiden Seiten denselben.
Meine Annahme (womit ich vorerst weitermache): `partial` (wie im Brief, Abschnitt 15): `invoke('settings_set', { partial })`.
Entscheidung (Nicola): bestätigt

## [Setup] Kurzantwort: Reihenfolge von Events und Rückgabe
Frage / Problem: Das Backend erzeugt `answerRequestId`. Das Frontend kennt sie erst nach der Antwort von `search`, `ai://`-Events könnten vorher eintreffen.
Meine Annahme (womit ich vorerst weitermache): Das Frontend meldet die Listener vor `search` an und puffert unbekannte IDs kurz. Der Mock startet das Streaming 500 ms nach der Suche.
Entscheidung (Nicola): Das Frontend erzeugt die ID und gibt sie bei `search` als `requestId` mit, wie bei den anderen KI-Befehlen. Kein Puffern nötig. CONTRACT.md ist angepasst; `answerRequestId` ist jetzt die übergebene ID oder `null`.

## [Setup] Quellen-Badges im Text
Frage / Problem: Wie die Badges im Antworttext codiert sind, steht nicht im Vertrag.
Meine Annahme (womit ich vorerst weitermache): Als `[1]`, `[2]`, `[3]` im Text, 1-basiert nach Reihenfolge der `hits`. `sources` enthält die zugehörigen Note-IDs.
Entscheidung (Nicola): bestätigt

## [Setup] `ai_cancel`
Frage / Problem: Kommt nach dem Abbrechen noch ein Event?
Meine Annahme (womit ich vorerst weitermache): Nein, weder `ai://done` noch `ai://error`.
Entscheidung (Nicola): bestätigt

## [Setup] Sortierung und Zeiträume
Frage / Problem: „Neueste zuerst“ nach `createdAt` oder `updatedAt`? Wo beginnen „Heute“, „Letzte 7 Tage“, „Letzter Monat“?
Meine Annahme (womit ich vorerst weitermache): `createdAt`, lokale Zeitzone. Heute = ab Mitternacht, 7 Tage = heute + 6 Tage davor, letzter Monat = letzte 30 Tage, dieses Jahr = Kalenderjahr.
Entscheidung (Nicola): bestätigt

## [Setup] Wann kommt `notes://changed`?
Frage / Problem: Nur bei Quick Capture oder auch bei Löschen, Wiederherstellen usw.?
Meine Annahme (womit ich vorerst weitermache): Nur wenn die Notiz nicht aus der aktuellen Ansicht stammt. Der Mock sendet es bei `note_create` mit `source = 'quick'`.
Entscheidung (Nicola): bestätigt

## [Setup] Quick-Capture-Fenster schliessen
Frage / Problem: Esc und ↵ müssen das Fenster schliessen. Dafür gibt es keinen Command.
Meine Annahme (womit ich vorerst weitermache): Das Frontend ruft `getCurrentWindow().hide()` auf, Agent A erlaubt das in `src-tauri/capabilities/`.
Entscheidung (Nicola): bestätigt

## [Setup] Mehrfachauswahl: Korrigieren, Verbessern, eigene Anweisung
Frage / Problem: Für mehrere Notizen gibt es nur `ai_summarize_notes`, und das ohne Anweisung.
Meine Annahme (womit ich vorerst weitermache): Das Frontend ruft `ai_transform` pro Notiz auf, mit je eigener `requestId`.
Entscheidung (Nicola): bestätigt

## [Setup] Reihenfolge der Tasten 1/2/3
Frage / Problem: Screen 2: Verbessern 1, Korrigieren 2, Zusammenfassen 3. Screen 6: Zusammenfassen 1, Korrigieren 2, Verbessern 3.
Meine Annahme (womit ich vorerst weitermache): Genau wie in den Screenshots, also unterschiedlich.
Entscheidung (Nicola): Überall gleich: Verbessern 1, Korrigieren 2, Zusammenfassen 3.

## [Setup] Abgeleiteter Titel
Frage / Problem: „Erste Zeile bzw. erster Satz“ passt nicht überall: In 1B steht „Zahnarzt verschoben auf Do 14:30, Dr. Keller …“ in einer Zeile, in 1A endet der Titel nach „14:30“. Texte weichen zwischen den Screens auch leicht ab.
Meine Annahme (womit ich vorerst weitermache): Erster Satz der ersten Zeile. Die Mock-Notizen haben dort einen Zeilenumbruch, damit die Titel wie in 1A aussehen.
Entscheidung (Nicola): bestätigt

## [Setup] ss oder ß in UI-Texten
Frage / Problem: Die Screenshots zeigen „schließt“/„schließen“, AGENTS.md erlaubt „ss“, aber einheitlich.
Meine Annahme (womit ich vorerst weitermache): UI wie in den Screenshots mit ß. Notiztexte bleiben wie vorgegeben („heisst“).
Entscheidung (Nicola): Überall „ss“.

## [Setup] Wem gehören die Dateien im Root?
Frage / Problem: `package.json`, `vite.config.ts`, `index.html`, `.env.development` liegen ausserhalb von `src/` und `src-tauri/`. Agent B braucht z. B. das npm-Paket `diff`.
Meine Annahme (womit ich vorerst weitermache): Agent B darf sie ändern, Agent A nicht.
Entscheidung (Nicola): bestätigt

## [Setup] Bundle-Identifier und App-Icon
Frage / Problem: Beides ist nicht vorgegeben. Der Identifier bestimmt u. a. das App-Data-Verzeichnis und sollte vor dem ersten echten Einsatz feststehen.
Meine Annahme (womit ich vorerst weitermache): `app.notiz.desktop`, `productName` „notiz“ ohne Punkt (Windows mag keine Pfade mit Punkt am Ende), Fenstertitel „notiz.“. Icons sind die Tauri-Platzhalter.
Entscheidung (Nicola): bestätigt

## [Agent B] Massstab: Screenshots vs. Pixelwerte in Abschnitt 10
Frage / Problem: Die Screenshots sind 1440×900 @2x. Die Pixelwerte im Brief (Seitentitel 40 px, Quick Capture 28 px, Sidebar 280–300 px, Editor ~980 px) passen aber zu einer ca. 2000 px breiten Ansicht. Wörtlich umgesetzt wirkt die App im Standardfenster (1280×800) rund 1,35× grösser als die Screenshots.
Meine Annahme (womit ich vorerst weitermache): Werte aus Abschnitt 10 wörtlich. Schrift und Abstände sind in rem, mit einem Regler `--ui-scale` in `src/styles.css`. `0.75` ergibt die Proportionen der Screenshots bei 1440 px. Radien bleiben wörtlich in px.
Entscheidung (Nicola):

## [Agent B] Suche schickt erst bei ↵
Frage / Problem: `search` startet bei einer Frage automatisch die Kurzantwort, also einen Claude-Aufruf. Suchen beim Tippen würde Teilfragen an die KI schicken („wo hab ich“). Das widerspricht „nur auf Befehl“.
Meine Annahme (womit ich vorerst weitermache): Gesucht wird erst bei ↵ (oder beim Wechsel des Zeitraum-Chips). Nochmal ↵ ohne Änderung öffnet den ausgewählten Treffer. Falls Live-Suche gewünscht ist, bräuchte `search` einen Parameter wie `withAnswer: boolean` (Vertragsänderung).
Entscheidung (Nicola):

## [Agent B] Titelleiste und Fensterrahmen (Agent A)
Frage / Problem: Die Screenshots zeigen den Fenstertitel „notiz.“ in einer Titelleiste im Fensterhintergrund (#F7F6F3). Das Quick-Capture-Fenster braucht einen durchsichtigen Hintergrund (nur die Karte mit Schatten ist sichtbar).
Meine Annahme (womit ich vorerst weitermache): Hauptfenster: `titleBarStyle: "Overlay"` bzw. passende Hintergrundfarbe ist Sache von Agent A in `tauri.conf.json`. Das Frontend lässt oben genug Platz. Quick Capture lädt `/capture` (alternativ `index.html#/capture`), Fenster `transparent: true`, `decorations: false`, ca. 960×260. Body ist dort transparent, die Karte hat 24 px Rand für den Schatten. Benötigte Berechtigung: `core:window:allow-hide`.
Entscheidung (Nicola):

## [Agent B] Zusätzliche Shortcuts (nicht in Abschnitt 9)
Frage / Problem: „Jede Funktion hat einen Shortcut“, Abschnitt 9 nennt aber nicht alle.
Meine Annahme (womit ich vorerst weitermache): ⌘1–⌘5 Sidebar-Filter, ⌘, Einstellungen, ⌘⇧P Anheften, ⌘D Duplizieren, ⌘⇧⌫ in den Papierkorb, esc im Editor zurück zur Liste, ⇧⌘Z / Ctrl+Y Wiederholen, im Karten-Grid Pfeiltasten + ↵ öffnen + Leertaste auswählen. Unter Windows jeweils Ctrl.
Entscheidung (Nicola):

## [Agent B] Neue Notiz erst beim ersten Zeichen anlegen
Frage / Problem: ⌘N könnte sofort eine leere Notiz anlegen. Wer dann nichts schreibt, hinterlässt leere Notizen.
Meine Annahme (womit ich vorerst weitermache): ⌘N öffnet einen leeren Editor. `note_create` läuft erst beim ersten nicht-leeren Text (debounced), danach `note_update`. Wird eine bestehende Notiz geleert, bleibt sie als „Leere Notiz“ erhalten (kein automatisches Löschen).
Entscheidung (Nicola):

## [Agent B] Mehrfachauswahl: Neu-Karte und Klickverhalten
Frage / Problem: Screen 6 zeigt die Neu-Karte bei aktiver Auswahl nicht, der Brief sagt „immer“. Ausserdem offen: was macht ein normaler Klick, während schon etwas ausgewählt ist?
Meine Annahme (womit ich vorerst weitermache): Wie Screen 6: Bei aktiver Auswahl ist die Neu-Karte ausgeblendet, statt Sortierung/Toggle steht der Hinweis. Ein normaler Klick schaltet dann die Auswahl der Karte um (statt sie zu öffnen), esc hebt die Auswahl auf. Im Papierkorb gibt es keine Mehrfachauswahl.
Entscheidung (Nicola):

## [Agent B] API-Key entfernen
Frage / Problem: Der Vertrag hat nur `api_key_set(key)`. Ein Key lässt sich ersetzen, aber nicht entfernen.
Meine Annahme (womit ich vorerst weitermache): Kein „Entfernen“-Button. Vorschlag: `api_key_set("")` löscht den Key (so verhält sich schon der Mock).
Entscheidung (Nicola):

## [Agent B] Diff ohne npm-Paket
Frage / Problem: Der Brief schlägt npm `diff` vor. Agent B sollte laut Auftrag nur in `src/` arbeiten.
Meine Annahme (womit ich vorerst weitermache): Eigener wortbasierter Diff in `src/lib/diff.ts` (LCS, ca. 100 Zeilen). `package.json` bleibt unverändert.
Entscheidung (Nicola):
