# sungrow-ws

Dieser Code ist ein Node.js-Skript, das eine Verbindung zu dem Wechselrichter Sungrow SH8.0RT (funktioniert vermutlich auch für SH10.0RT) über WebSockets herstellt, Daten von diesem Wechselrichter abruft und sie dann über MQTT (Message Queuing Telemetry Transport) veröffentlicht.

Hier ist eine detaillierte Beschreibung des Codes:

1. Der Code verwendet die Node.js-Module `ws` für WebSockets und `mqtt` für MQTT-Kommunikation.
2. Es werden einige Konstanten und Variablen initialisiert, einschließlich einer Liste von Feldern, die aus dem Wechselrichter abgerufen werden sollen, einer Token-Authentifizierung und einer Liste von Daten (`wrdata`), die vom Wechselrichter empfangen werden.
3. Die Funktion `connectWechselRichter()` wird definiert. Diese Funktion erstellt eine WebSocket-Verbindung zum Wechselrichter, sendet eine Verbindungsanfrage (`connectMsg`) und verarbeitet dann die empfangenen Nachrichten. Wenn erfolgreich eingeloggt, werden Echtzeitdaten- und Direktdatenanfragen an den Wechselrichter gesendet.
4. Es gibt eine Datenstruktur `series`, die verwendet wird, um historische Daten zu speichern und zu veröffentlichen.
5. `logData()` gibt die empfangenen Daten in der Konsole aus
6. `publishData()` veröffentlicht die Daten über MQTT und speichert auch historische Daten speichert.
7. Die Funktionen `processRealData()` und `processDirectData()` werden verwendet, um die empfangenen Daten zu verarbeiten und in ein geeignetes Format zu bringen.

Die Nachrichten und Feldnamen wurden mittels Beobachtung der Netzwerkaktivität auf der vom Wechselrichter bereitgestellten Webseite rekonstruiert.

Die ausgewählten Nachrichten sind stark an meine persönlichen Bedürfnisee angepasst.

# Getting started

Konfiguration anpassen:

```bash
cp config-examnple.json config.json
vi config.json # Anpassen der Beispiel Konfiguration
```

Installation der Dependencies:

```bash
pnpm install
```

Start:

```bash
node main.js
```
