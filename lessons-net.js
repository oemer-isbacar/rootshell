/* Teil 6 – Netzwerk für FISI (mode "ssh", group "net").
 * Baut auf „Netzwerk-Grundlagen" (v4-net) auf: Subnetting, Routing, DNS, Ports, systematische Fehlersuche.
 * Prüfungsrelevant für AP1/AP2. Subnetting-Rechenaufgaben gibt es zusätzlich im Tab 🎓 Prüfung.
 */
window.LESSONS.push(
{
  id: "net1-ipv4", mode: "ssh", group: "net", title: "IPv4 & Subnetting",
  intro: `Eine IPv4-Adresse hat 32 Bit. Die <b>Präfixlänge</b> (z. B. <code>/24</code>) sagt, wie viele Bits davon das <b>Netz</b> sind, der Rest sind die <b>Hosts</b>. Wer das sicher rechnen kann, besteht jede Subnetting-Aufgabe.`,
  steps: [
    { title: "Die eigene Adresse mit Präfix", text: `<code>-4</code> zeigt nur IPv4, <code>-br</code> eine Zeile pro Schnittstelle.`,
      cmd: "ip -4 -br addr", check: { cmd: /^ip\s+(-\w+\s+)*(a|addr|address)\b/, out: /\d+\.\d+\.\d+\.\d+\/\d+/ },
      explain: `Die Angabe <code>/24</code> heißt: 24 Bit Netz, 8 Bit Host. Als Maske geschrieben: <code>255.255.255.0</code>.` },
    { title: "Rechenhilfe installieren", text: `<code>ipcalc</code> rechnet Subnetze aus – perfekt, um eigene Rechnungen zu kontrollieren.`,
      cmd: "sudo apt-get install -y -qq ipcalc", check: { cmd: /apt(-get)?\s+install.*ipcalc/ } },
    { title: "Das eigene Netz zerlegen", cmd: "ipcalc {{IP}}/24", check: { cmd: /^ipcalc\s/, out: /Network|Netmask|HostMin/i },
      explain: `Wichtig sind vier Werte:<br>• <b>Network</b> – erste Adresse, alle Host-Bits 0 (nicht vergebbar)<br>• <b>Broadcast</b> – letzte Adresse, alle Host-Bits 1 (nicht vergebbar)<br>• <b>HostMin/HostMax</b> – Bereich für Geräte<br>• <b>Hosts/Net</b> – Anzahl nutzbarer Adressen = 2<sup>Host-Bits</sup> − 2` },
    { title: "Ein /26 von Hand rechnen", text: `Aufgabe: Das Netz <code>192.168.10.0/26</code>. Host-Bits = 32 − 26 = <b>6</b> → 2<sup>6</sup> = 64 Adressen pro Netz, davon <b>62</b> nutzbar. Die Netze springen in 64er-Schritten: .0, .64, .128, .192.<br>Rechne erst selbst, dann prüfe:`,
      cmd: "ipcalc 192.168.10.70/26", check: { cmd: /^ipcalc\s+192\.168\.10\.\d+\/26/, out: /Network|Netmask/i },
      explain: `<code>.70</code> liegt im Block .64–.127 → Netz <code>192.168.10.64</code>, Broadcast <code>192.168.10.127</code>, Hosts .65–.126. Die Maske: 26 Bit = <code>255.255.255.192</code> (192 = 128+64).` },
    { title: "Größere Netze: /20", text: `Bei Präfixen unter /24 springt das <b>dritte</b> Oktett. /20 → 12 Host-Bits → 4096 Adressen = 16 Blöcke à 256 im dritten Oktett.`,
      cmd: "ipcalc 172.16.37.5/20", check: { cmd: /^ipcalc\s+172\.16\.\d+\.\d+\/20/ },
      explain: `37 liegt im 16er-Block 32–47 → Netz <code>172.16.32.0/20</code>, Broadcast <code>172.16.47.255</code>, Maske <code>255.255.240.0</code>.<br><b>Private Bereiche</b> (RFC 1918): <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code> – werden im Internet nicht geroutet, deshalb braucht man NAT.` },
    { title: "IPv6 – kurz gesehen", text: `IPv6 hat 128 Bit, geschrieben in Hex-Blöcken. Jede Schnittstelle hat mindestens eine <b>Link-Local</b>-Adresse (<code>fe80::/10</code>).`,
      cmd: "ip -6 -br addr", check: { cmd: /^ip\s+-6/ },
      explain: `Regeln zum Kürzen: führende Nullen pro Block weglassen, <b>eine</b> Folge von Null-Blöcken durch <code>::</code> ersetzen. Ein normales LAN ist bei IPv6 immer ein <code>/64</code>.` },
  ],
  outro: `Übe das Rechnen im Tab <b>🎓 Prüfung → Subnetting-Trainer</b> – dort gibt es endlos neue Aufgaben mit Lösungsweg.`,
},
{
  id: "net2-routing", mode: "ssh", group: "net", title: "Routing & Gateway",
  intro: `Liegt ein Ziel <b>nicht</b> im eigenen Netz, schickt der Rechner das Paket an sein <b>Standard-Gateway</b> (den Router). Welcher Weg genommen wird, steht in der Routing-Tabelle.`,
  steps: [
    { title: "Die Routing-Tabelle lesen", cmd: "ip route", check: { cmd: /^ip\s+(r|route)\b/, out: /default via/ },
      explain: `<code>default via X</code> = Standard-Gateway. <code>10.x.x.0/24 dev eth0 … scope link</code> = das eigene Netz, das wird direkt erreicht. Bei mehreren passenden Routen gewinnt die <b>längste Präfixlänge</b>, danach die kleinste <code>metric</code>.` },
    { title: "Welchen Weg nimmt ein Paket?", text: `<code>ip route get</code> fragt den Kernel direkt, welche Route er für ein Ziel wählen würde.`,
      cmd: ["ip route get 1.1.1.1", "ip route get {{IP}}"], check: { cmd: /ip\s+r(oute)?\s+get/, out: /via|dev/ } },
    { title: "Nachbarn im Netz (ARP)", text: `Im eigenen Netz wird nicht über IP, sondern über die <b>MAC-Adresse</b> zugestellt. Die Zuordnung IP → MAC lernt der Rechner per ARP.`,
      cmd: "ip neigh", check: { cmd: /^ip\s+n(eigh(bour)?)?\b/ },
      explain: `<code>REACHABLE</code>/<code>STALE</code> = bekannt, <code>FAILED</code> = keine Antwort. Das Gateway sollte hier immer auftauchen.` },
    { title: "Den Weg ins Internet verfolgen", text: `<code>tracepath</code> zeigt jeden Router (Hop) auf dem Weg. Unter Windows heißt das <code>tracert</code>.`,
      cmd: "tracepath -n -m 8 1.1.1.1", check: { cmd: /^(tracepath|traceroute|mtr)\b/ },
      explain: `Jeder Hop ist ein Router. Bleibt die Liste nach Hop 1 stehen, ist meist das Gateway oder dessen Internetzugang das Problem. <code>no reply</code> bei einzelnen Hops ist normal – viele Router antworten einfach nicht.` },
  ],
},
{
  id: "net3-dns", mode: "ssh", group: "net", title: "DNS verstehen & prüfen",
  intro: `DNS übersetzt Namen in Adressen. Fällt DNS aus, „geht das Internet nicht“, obwohl die Leitung steht. Mit <code>dig</code> siehst du genau, was ein DNS-Server antwortet.`,
  steps: [
    { title: "Eine Abfrage im Detail", cmd: "dig example.com", check: { cmd: /^dig\s/, out: /ANSWER SECTION|status:/ },
      explain: `Wichtig: <code>status: NOERROR</code> (ok) oder <code>NXDOMAIN</code> (Name gibt es nicht), die <b>ANSWER SECTION</b> mit der Adresse und die <b>TTL</b> (wie lange zwischengespeichert werden darf).` },
    { title: "Verschiedene Record-Typen", text: `A = IPv4, AAAA = IPv6, MX = Mailserver, NS = zuständige Nameserver, TXT = Text (z. B. SPF), CNAME = Alias.`,
      cmd: ["dig +short A example.com", "dig +short AAAA example.com", "dig +short NS example.com", "dig +short MX gmx.de"],
      check: { cmd: /dig\s.*\b(MX|NS|AAAA|TXT)\b/i } },
    { title: "Rückwärts: Adresse → Name (PTR)", cmd: "dig -x 1.1.1.1 +short", check: { cmd: /dig\s+-x/ } },
    { title: "Einen bestimmten Server fragen", text: `Mit <code>@</code> fragst du gezielt einen DNS-Server. So erkennst du, ob nur <i>dein</i> Resolver spinnt.`,
      cmd: "dig @1.1.1.1 +short example.com", check: { cmd: /dig\s+@/ } },
    { title: "Die lokale Reihenfolge", text: `Bevor DNS gefragt wird, schaut Linux in <code>/etc/hosts</code>. <code>getent</code> löst Namen genau so auf wie Programme – <code>dig</code> dagegen fragt <b>nur</b> DNS.`,
      cmd: ["cat /etc/hosts", "getent hosts localhost"], check: { cmd: /getent\s+hosts/ },
      explain: `Darum kann <code>dig</code> die richtige Adresse liefern, während <code>curl</code> eine falsche nimmt: Ein Eintrag in <code>/etc/hosts</code> hat Vorrang. Genau das ist eine der Missionen 😉. Die Reihenfolge steht in <code>/etc/nsswitch.conf</code> (Zeile <code>hosts:</code>).` },
  ],
},
{
  id: "net4-ports", mode: "ssh", group: "net", title: "Ports, TCP/UDP & OSI",
  intro: `Eine IP-Adresse findet den Rechner, der <b>Port</b> den Dienst darauf. TCP baut eine Verbindung auf (Handshake, zuverlässig), UDP schickt einfach los (schnell, ohne Garantie).`,
  steps: [
    { title: "Bekannte Ports nachschlagen", text: `Die Datei <code>/etc/services</code> listet die Standard-Ports.`,
      cmd: "grep -wE '^(ssh|domain|http|https|smtp|rdp|ms-wbt-server|imaps|ntp)' /etc/services", check: { cmd: /\/etc\/services/, out: /\d+\/(tcp|udp)/ },
      explain: `Die Prüfungs-Klassiker: 20/21 FTP · 22 SSH · 23 Telnet · 25 SMTP · 53 DNS · 67/68 DHCP · 80 HTTP · 110 POP3 · 123 NTP · 143 IMAP · 443 HTTPS · 445 SMB · 993 IMAPS · 3389 RDP.` },
    { title: "Ist ein Port erreichbar?", text: `<code>nc -zv</code> versucht eine TCP-Verbindung, ohne Daten zu senden.`,
      cmd: ["nc -zv localhost 22", "nc -zv -w 2 localhost 81"], check: { cmd: /^nc\s+-\w*z/ },
      explain: `<code>succeeded</code> = Dienst lauscht. <code>Connection refused</code> = Rechner erreichbar, aber da lauscht nichts. <b>Timeout</b> = Paket wird verworfen, meist durch eine Firewall.` },
    { title: "Bestehende Verbindungen", cmd: "ss -tn state established", check: { cmd: /^ss\s.*established/i },
      explain: `Deine eigene SSH-Sitzung taucht hier auf: lokale Adresse <code>:22</code>, Gegenstelle ist dein PC.` },
    { title: "Eine HTTP-Anfrage ansehen", text: `<code>curl -v</code> zeigt jede Schicht: DNS-Auflösung, TCP-Verbindung, TLS-Handshake, HTTP-Anfrage und -Antwort.`,
      cmd: "curl -sv -o /dev/null https://example.com 2>&1 | grep -E '^\\*|^> |^< HTTP'", check: { cmd: /curl\s.*-\w*v/ },
      explain: `Das passt zum <b>OSI-Modell</b>: 1 Bitübertragung (Kabel) · 2 Sicherung (MAC, Switch) · 3 Vermittlung (IP, Router) · 4 Transport (TCP/UDP, Ports) · 5–7 Sitzung/Darstellung/Anwendung (TLS, HTTP). Merksatz von unten: „<b>B</b>itte <b>S</b>ei <b>V</b>orsichtig <b>T</b>ommy, <b>S</b>onst <b>D</b>reht <b>A</b>lles“.` },
  ],
},
{
  id: "net5-trouble", mode: "ssh", group: "net", title: "Netzwerk-Fehlersuche Schicht für Schicht",
  intro: `„Das Netz geht nicht“ – Profis raten nicht, sondern prüfen <b>von unten nach oben</b>. Sobald ein Schritt scheitert, hast du die Schicht gefunden.`,
  steps: [
    { title: "1 · Ist die Schnittstelle oben?", cmd: "ip -br link", check: { cmd: /^ip\s+(-\w+\s+)*l(ink)?\b/, out: /UP/ } },
    { title: "2 · Hat sie eine Adresse?", cmd: "ip -4 -br addr", check: { cmd: /^ip\s+(-\w+\s+)*(a|addr)\b/ },
      explain: `Steht dort eine <code>169.254.x.x</code>, hat DHCP nicht geantwortet (APIPA – Windows vergibt sich die selbst).` },
    { title: "3 · Antwortet das Gateway?", text: `Die Adresse des Gateways holt sich der Befehl direkt aus der Routing-Tabelle:`,
      cmd: "ping -c 2 $(ip route | awk '/^default/ {print $3; exit}')", check: { cmd: /^ping\s/, out: /packets transmitted/ } },
    { title: "4 · Komme ich ins Internet (ohne DNS)?", cmd: "ping -c 2 1.1.1.1", check: { cmd: /^ping\s.*\d+\.\d+\.\d+\.\d+/, out: /packets transmitted/ } },
    { title: "5 · Funktioniert DNS?", cmd: "getent hosts example.com", check: { cmd: /^(getent|dig|nslookup|host|resolvectl)\b/ },
      explain: `Klappt Schritt 4, aber nicht 5 → DNS-Problem (falscher Server, falscher <code>/etc/hosts</code>-Eintrag). Klappt nicht einmal 3 → lokales Problem (Kabel, VLAN, IP, Gateway).` },
    { title: "6 · Antwortet der Dienst?", cmd: "curl -sI https://example.com | head -1", check: { cmd: /^curl\s/, out: /HTTP/ },
      explain: `Merke dir die Reihenfolge: <b>Link → IP → Gateway → Internet → DNS → Dienst</b>. Genau so gehst du in den drei Netzwerk-Missionen vor.` },
  ],
},
);

window.DRILLS.push(
/* ---------- Netzwerk Stufe 1 ---------- */
{ id: "sn-addr", mode: "ssh", lvl: 1, after: "net1-ipv4", q: "Zeige nur die IPv4-Adressen aller Schnittstellen, eine Zeile pro Schnittstelle.", a: "ip -4 -br addr", check: { cmd: /^ip\s+(-\w+\s+)*(a|addr|address)\b/, out: /\d+\.\d+\.\d+\.\d+/ } },
{ id: "sn-gw", mode: "ssh", lvl: 1, after: "net2-routing", q: "Zeige die Routing-Tabelle mit dem Standard-Gateway.", a: "ip route", check: { cmd: /^ip\s+(r|route)\b/, out: /default/ } },
{ id: "sn-mx", mode: "ssh", lvl: 1, after: "net3-dns", q: "Welche Mailserver (MX) hat <code>gmx.de</code>? Nur die Kurzantwort.", a: "dig +short MX gmx.de", check: { cmd: /dig\s.*MX/i } },
/* ---------- Netzwerk Stufe 2 ---------- */
{ id: "sn-calc", mode: "ssh", lvl: 2, after: "net1-ipv4", q: "Lass dir Netzadresse und Broadcast von <code>10.20.30.200/27</code> berechnen.", a: "ipcalc 10.20.30.200/27", check: { cmd: /ipcalc\s+10\.20\.30\.200\/27/ } },
{ id: "sn-route", mode: "ssh", lvl: 2, after: "net2-routing", q: "Über welche Route würde ein Paket an <code>8.8.8.8</code> gehen? Frag den Kernel.", a: "ip route get 8.8.8.8", check: { cmd: /ip\s+r(oute)?\s+get\s+8\.8\.8\.8/ } },
{ id: "sn-port", mode: "ssh", lvl: 2, after: "net4-ports", q: "Prüfe, ob auf <code>localhost</code> Port 22 per TCP erreichbar ist – ohne Daten zu senden.", a: "nc -zv localhost 22", check: { cmd: /^nc\s+-\w*z\w*\s.*22/ } },
/* ---------- Netzwerk Stufe 3 ---------- */
{ id: "sn-dns-direct", mode: "ssh", lvl: 3, after: "net3-dns", q: "Löst dein Resolver <code>example.com</code> anders auf als der DNS-Server <code>9.9.9.9</code>? Frag diesen Server direkt.", hint: "Bei <code>dig</code> gibst du den Server mit <code>@</code> an.", a: "dig @9.9.9.9 +short example.com", check: { cmd: /dig\s+@9\.9\.9\.9/ } },
{ id: "sn-gwping", mode: "ssh", lvl: 3, after: "net5-trouble", q: "Pinge das Standard-Gateway zweimal an, <b>ohne</b> seine Adresse abzutippen.", hint: "<code>$( … )</code> setzt eine Befehlsausgabe ein; die Adresse steht in <code>ip route</code> hinter <code>default via</code>.", a: "ping -c 2 $(ip route | awk '/^default/ {print $3; exit}')", check: { cmd: /ping\s.*\$\(/, out: /packets transmitted/ } },
{ id: "sn-established", mode: "ssh", lvl: 3, after: "net4-ports", q: "Zeige alle <b>bestehenden</b> TCP-Verbindungen numerisch.", hint: "<code>ss</code> kann nach Zustand filtern: <code>state …</code>", a: "ss -tn state established", check: { cmd: /^ss\s.*established/i } },
);
