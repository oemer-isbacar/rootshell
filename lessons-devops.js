/* Teil 7 – Git & Docker vertieft (mode "ssh", group "devops").
 * Git: Versionsverwaltung für Skripte & Konfigurationen. Docker: eigene Images bauen, Volumes, Netzwerke.
 * Baut auf „Container: Docker" (v14-docker) auf, ist aber auch ohne diese Lektion machbar.
 */
window.LESSONS.push(
{
  id: "dev1-git", mode: "ssh", group: "devops", title: "Git: Versionen verwalten",
  intro: `Git speichert jeden Stand deiner Dateien als <b>Commit</b>. Admins versionieren damit Skripte und Konfigurationen: Wer hat was wann geändert, und wie komme ich zum letzten funktionierenden Stand zurück?`,
  steps: [
    { title: "Wer bist du?", text: `Jeder Commit trägt Name und E-Mail. Das stellst du einmal ein:`,
      cmd: ['git config --global user.name "Azubi"', 'git config --global user.email "azubi@example.com"', "git config --global init.defaultBranch main"],
      check: { cmd: /git\s+config\s+--global\s+user\.(name|email)/ } },
    { title: "Ein Repository anlegen", cmd: "mkdir -p ~/skripte && cd ~/skripte && git init", check: { cmd: /git\s+init/, out: /Initialized|Leeres|Reinitialized/i },
      explain: `Git legt den versteckten Ordner <code>.git</code> an – darin steckt die komplette Geschichte.` },
    { title: "Erste Datei – Status prüfen", cmd: ["echo '#!/bin/bash' > backup.sh", "echo 'tar czf /tmp/etc.tgz /etc' >> backup.sh", "git status"],
      check: { cmd: /git\s+status/, out: /Untracked|Unversioniert|backup\.sh/i },
      explain: `Die drei Bereiche: <b>Arbeitsverzeichnis</b> (deine Dateien) → <code>git add</code> → <b>Staging</b> (vorgemerkt) → <code>git commit</code> → <b>Repository</b> (gespeichert).` },
    { title: "Vormerken und speichern", cmd: ["git add backup.sh", 'git commit -m "Backup-Skript angelegt"'], check: { cmd: /git\s+commit/, out: /file changed|Datei geändert|create mode/i } },
    { title: "Ändern und Unterschied sehen", cmd: ["echo 'echo Backup fertig' >> backup.sh", "git diff"], check: { cmd: /git\s+diff/, out: /^\+echo Backup fertig/m },
      explain: `<code>+</code> = neue Zeile, <code>-</code> = entfernte Zeile. <code>git diff --staged</code> zeigt, was schon vorgemerkt ist.` },
    { title: "Zweiter Commit und Verlauf", cmd: ['git commit -am "Meldung am Ende"', "git log --oneline"], check: { cmd: /git\s+log/, out: /Meldung am Ende/ },
      explain: `<code>-a</code> merkt alle schon bekannten, geänderten Dateien automatisch vor. Jeder Commit hat eine eindeutige ID (Hash) – die ersten 7 Zeichen reichen meist.` },
    { title: "Fehler rückgängig machen", text: `Ups, Datei kaputt gemacht? <code>git restore</code> holt den letzten gespeicherten Stand zurück.`,
      cmd: ["echo 'rm -rf /' > backup.sh", "git restore backup.sh && cat backup.sh"], check: { cmd: /git\s+(restore|checkout)\s/, out: /tar czf/ },
      explain: `Ein schon gespeicherter, fehlerhafter Commit wird mit <code>git revert &lt;ID&gt;</code> zurückgenommen: Git legt einen <b>neuen</b> Commit an, der die Änderung umkehrt – die Geschichte bleibt nachvollziehbar.` },
  ],
},
{
  id: "dev2-branch", mode: "ssh", group: "devops", title: "Git: Branches & Zusammenführen",
  intro: `Ein <b>Branch</b> ist eine eigene Entwicklungslinie. Neue Ideen probierst du dort aus, ohne den funktionierenden Stand auf <code>main</code> zu gefährden.`,
  steps: [
    { title: "Branch anlegen und wechseln", cmd: ["cd ~/skripte", "git switch -c log-funktion", "git branch"], check: { cmd: /git\s+branch|git\s+switch/, out: /\* log-funktion/ } },
    { title: "Im Branch arbeiten", cmd: ["echo 'logger \"Backup gelaufen\"' >> backup.sh", 'git commit -am "Ins Syslog schreiben"'], check: { cmd: /git\s+commit/, out: /changed|geändert/i } },
    { title: "Zurück auf main – die Änderung fehlt dort", cmd: ["git switch main", "grep -c logger backup.sh"], check: { cmd: /git\s+(switch|checkout)\s+main/ } },
    { title: "Zusammenführen", cmd: ["git merge log-funktion", "git log --oneline --graph --all"], check: { cmd: /git\s+(merge|log)/, out: /Ins Syslog schreiben/ },
      explain: `Hier gab es auf <code>main</code> nichts Neues, also reicht ein <b>Fast-Forward</b>. Haben beide Seiten dieselbe Zeile geändert, gibt es einen <b>Konflikt</b>: Git markiert die Stelle mit <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code> / <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code>, du entscheidest, speicherst, und machst <code>git add</code> + <code>git commit</code>.` },
    { title: "Dateien ignorieren", text: `Logs, Passwörter und Zwischendateien gehören <b>nicht</b> ins Repository.`,
      cmd: ["printf '*.log\\n.env\\n' > .gitignore", "echo test > lauf.log", "git status --short"], check: { cmd: /git\s+status/, out: /\.gitignore/ },
      explain: `<code>lauf.log</code> taucht nicht mehr auf – nur die neue <code>.gitignore</code>. Wurde ein Geheimnis schon committet, ist es in der Geschichte drin: Dann hilft nur, das Passwort zu <b>ändern</b>.` },
    { title: "Branch aufräumen", cmd: ["git add .gitignore && git commit -m 'Logs ignorieren'", "git branch -d log-funktion"], check: { cmd: /git\s+branch\s+-d/ } },
  ],
  outro: `Ein Repository auf einem Server (GitHub, GitLab oder dein eigenes <b>Gitea</b> aus Teil 3) erreichst du mit <code>git remote add origin URL</code>, <code>git push</code> und <code>git pull</code>.`,
},
{
  id: "dev3-dockerfile", mode: "ssh", group: "devops", title: "Docker: eigene Images bauen",
  intro: `Ein <b>Image</b> ist die Vorlage, ein <b>Container</b> eine laufende Kopie davon. Mit einem <code>Dockerfile</code> beschreibst du ein eigenes Image – reproduzierbar, auf jedem Rechner gleich.`,
  steps: [
    { title: "Docker bereit?", text: `Falls Docker aus Teil 2 noch fehlt, wird es jetzt installiert. Wir nutzen hier <code>sudo docker</code>, dann musst du dich nicht neu anmelden.`,
      cmd: "command -v docker || sudo apt-get install -y -qq docker.io; sudo docker version --format '{{.Server.Version}}'", check: { cmd: /docker\s+version|apt(-get)?\s+install.*docker/, out: /\d+\.\d+/ } },
    { title: "Webseite und Dockerfile schreiben", cmd: `mkdir -p ~/meine-seite && cd ~/meine-seite
echo '<h1>Mein eigenes Image</h1>' > index.html
cat > Dockerfile << 'EOF'
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
EXPOSE 80
EOF
cat Dockerfile`, check: { cmd: /Dockerfile/, out: /FROM nginx/ },
      explain: `<code>FROM</code> = Basis-Image · <code>COPY</code> = Dateien hinein · <code>RUN</code> = Befehl beim Bauen ausführen · <code>EXPOSE</code> = Port dokumentieren · <code>CMD</code> = Startbefehl.` },
    { title: "Image bauen", cmd: "sudo docker build -t meine-seite:1.0 .", check: { cmd: /docker\s+build/, out: /naming to|Successfully|meine-seite/i },
      explain: `Jede Anweisung im Dockerfile wird zu einer <b>Schicht</b> (Layer). Ändert sich nur <code>index.html</code>, baut Docker nur die letzte Schicht neu – der Rest kommt aus dem Cache.` },
    { title: "Starten und testen", cmd: ["sudo docker run -d --name seite -p 8082:80 meine-seite:1.0", "curl -s localhost:8082"], check: { cmd: /curl.*8082/, out: /Mein eigenes Image/ } },
    { title: "Images verwalten", cmd: ["sudo docker images", "sudo docker history meine-seite:1.0 | head -5"], check: { cmd: /docker\s+(images|history|image\s+ls)/ } },
    { title: "Aufräumen", cmd: "sudo docker rm -f seite", check: { cmd: /docker\s+rm/ } },
  ],
},
{
  id: "dev4-volumes", mode: "ssh", group: "devops", title: "Docker: Volumes & Netzwerke",
  intro: `Container sind <b>wegwerfbar</b>: Löschst du einen, ist alles darin weg. Daten, die bleiben sollen, kommen in ein <b>Volume</b>. Und damit Container sich gegenseitig finden, gibt es eigene <b>Netzwerke</b>.`,
  steps: [
    { title: "Ohne Volume: Daten weg", cmd: ["sudo docker run --name test alpine sh -c 'echo wichtig > /daten.txt'", "sudo docker rm test", "sudo docker run --rm alpine cat /daten.txt"],
      check: { cmd: /docker\s+run.*cat\s+\/daten\.txt/, out: /No such file|can't open|nonexistent/i } },
    { title: "Mit Volume: Daten bleiben", cmd: ["sudo docker volume create meine-daten", "sudo docker run --rm -v meine-daten:/daten alpine sh -c 'echo wichtig > /daten/info.txt'", "sudo docker run --rm -v meine-daten:/daten alpine cat /daten/info.txt"],
      check: { cmd: /-v\s+meine-daten/, out: /wichtig/ },
      explain: `Ein <b>Volume</b> verwaltet Docker selbst (unter <code>/var/lib/docker/volumes/</code>). Ein <b>Bind-Mount</b> (<code>-v /pfad/am/host:/pfad</code>) bindet einen Ordner des Hosts ein – praktisch für Konfigdateien. Fürs Backup sicherst du genau diese Daten, nicht den Container.` },
    { title: "Eigenes Netzwerk", cmd: ["sudo docker network create labnetz", "sudo docker run -d --name server --network labnetz nginx:alpine"], check: { cmd: /docker\s+(network\s+create|run.*--network)/ } },
    { title: "Container finden sich per Name", cmd: "sudo docker run --rm --network labnetz alpine wget -qO- http://server | grep -i title", check: { cmd: /--network\s+labnetz/, out: /nginx/i },
      explain: `In einem eigenen Netzwerk bringt Docker einen DNS-Dienst mit: Der Containername <code>server</code> wird automatisch aufgelöst. Genau so verbindet Docker Compose eine App mit ihrer Datenbank.` },
    { title: "Aufräumen", cmd: ["sudo docker rm -f server", "sudo docker network rm labnetz", "sudo docker volume rm meine-daten"], check: { cmd: /docker\s+(volume|network)\s+rm/ } },
  ],
},
);

window.DRILLS.push(
/* ---------- Git/Docker Stufe 1 ---------- */
{ id: "dv-status", mode: "ssh", lvl: 1, after: "dev1-git", q: "Zeige im Repository <code>~/skripte</code> an, welche Dateien geändert sind.", a: "cd ~/skripte && git status", check: { cmd: /git\s+status/ } },
{ id: "dv-log", mode: "ssh", lvl: 1, after: "dev1-git", q: "Zeige den Verlauf von <code>~/skripte</code> kompakt, ein Commit pro Zeile.", a: "git -C ~/skripte log --oneline", check: { cmd: /git\s.*log\s.*--oneline/ } },
{ id: "dv-ps", mode: "ssh", lvl: 1, after: "dev3-dockerfile", q: "Zeige <b>alle</b> Container, auch die gestoppten.", a: "sudo docker ps -a", check: { cmd: /docker\s+(ps\s+-a|container\s+ls\s+-a)/ } },
/* ---------- Stufe 2 ---------- */
{ id: "dv-branch", mode: "ssh", lvl: 2, after: "dev2-branch", q: "Lege in <code>~/skripte</code> den Branch <code>test</code> an und wechsle gleichzeitig dorthin.", a: "cd ~/skripte && git switch -c test", check: { cmd: /git\s+(switch\s+-c|checkout\s+-b)\s+test/ } },
{ id: "dv-images", mode: "ssh", lvl: 2, after: "dev3-dockerfile", q: "Zeige alle lokal vorhandenen Docker-Images.", a: "sudo docker images", check: { cmd: /docker\s+(images|image\s+ls)/ } },
{ id: "dv-vol", mode: "ssh", lvl: 2, after: "dev4-volumes", q: "Liste alle Docker-Volumes auf.", a: "sudo docker volume ls", check: { cmd: /docker\s+volume\s+ls/ } },
/* ---------- Stufe 3 ---------- */
{ id: "dv-who", mode: "ssh", lvl: 3, after: "dev2-branch", q: "Wer hat in <code>~/skripte/backup.sh</code> welche Zeile zuletzt geändert?", hint: "Der Befehl heißt wie „jemandem die Schuld geben“ auf Englisch.", a: "git -C ~/skripte blame backup.sh", check: { cmd: /git\s.*blame/ } },
{ id: "dv-inspect", mode: "ssh", lvl: 3, after: "dev4-volumes", q: "Unter welchem Pfad auf dem Host liegen die Daten des Volumes <code>meine-daten</code>? (Lege es vorher an, falls es fehlt.)", hint: "<code>docker volume inspect</code> zeigt den <code>Mountpoint</code>.", a: "sudo docker volume inspect meine-daten", check: { cmd: /docker\s+volume\s+inspect/ } },
{ id: "dv-logsf", mode: "ssh", lvl: 3, after: "dev3-dockerfile", q: "Zeige nur die <b>letzten 5</b> Logzeilen eines Containers deiner Wahl.", hint: "<code>docker logs</code> hat eine Option für die letzten N Zeilen.", a: "sudo docker logs --tail 5 NAME", check: { cmd: /docker\s+logs\s+.*(--tail|-n)\s*5/ } },
);
