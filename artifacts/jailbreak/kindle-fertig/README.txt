================================================================
WATCHTHIS JAILBREAK — KINDLE VOYAGE (KV) 5.13.6
n8n-EInk-Display-Projekt
================================================================

Gerüstete Ordner (komplett validiert, Checksum ok):
  01-jailbreak/.demo/   -> Demo-Payload (Jailbreak)
  02-hotfix/            -> WatchThis-Hotfix (erst NACH Jailbreak)

WICHTIG:
  - Niemals beide Ordner gleichzeitig auf das Kindle kopieren.
  - Erst 01-jailbreak, später 02-hotfix (getrennt).
  - Flugmodus AN, Akku voll.
  - Vorher: Inhalte sichern (Backup). Reset macht Factory Reset.

----------------------------------------------------------------
SCHITT 1: FACTORY RESET -> DEMO-MODUS
----------------------------------------------------------------
1. Menü > Einstellungen > Allgemein > Factory Reset.
2. Sprache en_GB wählen.
3. WLAN: „Überspringen".
4. Fake-Info eingeben (beliebig), Suche nach Demo-Payload
   „Überspringen", Standard-Demo-Typ, „Done".
5. Missconfiguration-Dialog: 2 Finger tippen, links wischen.

----------------------------------------------------------------
SCHITT 2: DEMO-INHALT SIDLOADEN
----------------------------------------------------------------
1. Suche-Feld öffnen, eingeben:   ;demo
2. „Sideload content" auswählen.
3. Kindle per USB verbinden (einstecken).
4. Auf Root des Kindle den Ordner  .demo/  kopieren
   (liegt in 01-jailbreak/), d.h. Root zeigt danach:
       .demo/KV-5.13.6.zip     (Nicht entpacken!)
       .demo/demo.json
       .demo/goodreads/        (leerer Ordner)
   HINWEIS: .demo ist versteckt (Punkt). Im Finder:
   Cmd+Shift+. drücken (versteckte Dateien zeigen),
   oder per Terminal:
       cp -R "/Pfad/01-jailbreak/.demo" /Volumes/Kindle/
5. Kindle sicher trennen (Eject), Kabel raus, „Done".
6. Demo-Modus verlassen.

----------------------------------------------------------------
SCHITT 3: JAILBREAK AUSLÖSEN
----------------------------------------------------------------
1. Suche-Feld:   ;dsts
2. „Help & User Guides" > „Get Started"
3. Gerät bootet neu -> ist JAILBROKEN.
4. Prüfen: WatchThis-Symbol / Jailbreak sichtbar.

----------------------------------------------------------------
SCHITT 4: WATCHTHIS-HOTFIX (erst jetzt!)
----------------------------------------------------------------
1. .demo/-Ordner vom Root ENTFERNEN (nicht mehr nötig).
2. Suche-Feld:   ;uzb
3. Auf Root (Inhalt von 02-hotfix/) kopieren:
       Update_hotfix_watchthis_custom.bin
4. Kindle trennen (Eject).
5. Suche:   ;dsts   > „Update Your Kindle"
6. Gerät bootet, Hotfix installiert. Fertig.

----------------------------------------------------------------
NACH JAILBREAK
----------------------------------------------------------------
- WatchThis-Menü / Konsole öffnet sich.
- Danach n8n-Anbindung (Phase 6): LAN-HTTP + eips.
- Bei „Invalid Update File" -> Datei/Modell-Prüfung, STOP.
================================================================
