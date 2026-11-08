# Homelab: einen zweiten eigenen Server härten und prüfen

Teil 5 übt die Verteidiger-Seite auf deiner Übungs-VM. Der nächste Schritt ist ein **zweiter, eigener Server** – zum Beispiel eine VM auf deinem Proxmox. Dort wiederholst du die Härtung „wie im Betrieb“ und prüfst sie **von außen**, so wie es ein Admin nach jeder Änderung tun sollte.

> **Spielregel:** Scanne und teste nur Systeme, die dir gehören oder für die du eine ausdrückliche, schriftliche Erlaubnis hast. Beide Maschinen hier gehören dir.

## 1 · Ziel-VM anlegen (Proxmox)

1. Ubuntu-Server-ISO hochladen (*local → ISO Images*), neue VM: 1–2 CPUs, 2 GB RAM, 16 GB Platte, Netzwerk `vmbr0`.
2. Bei der Installation **OpenSSH-Server** ankreuzen, Benutzer z. B. `admin`.
3. IP notieren (`ip -br a` in der VM-Konsole) – am besten im Router fest zuweisen.

## 2 · Aus rootshell verbinden

**⚙ VM-Zentrale → Andere Maschine → Per IP + Passwort verbinden …** – du arbeitest jetzt im Terminal auf dem Proxmox-Server. Die Lektionen aus Teil 5 (SSH härten, Firewall, fail2ban, Updates, Backup) funktionieren dort genauso.

## 3 · Ausgangslage von außen erfassen

Aus der Übungs-VM `fis-lab` (Modus 🔌 Echte VM), die im selben Netz hängen muss:

```bash
sudo apt-get install -y nmap
nmap -sV 192.168.1.50          # IP deiner Ziel-VM
```

Schreib dir auf, welche Ports offen sind und welche Versionen gemeldet werden. Das ist deine **Vorher-Dokumentation**.

## 4 · Härten (auf der Ziel-VM)

| Maßnahme | Befehl / Datei | Lektion |
|---|---|---|
| Updates + automatische Sicherheitsupdates | `sudo apt full-upgrade`, `unattended-upgrades` | Updates & Schwachstellen |
| SSH: kein Root, nur Schlüssel | `/etc/ssh/sshd_config.d/90-haertung.conf` | SSH härten |
| Firewall: nur, was gebraucht wird | `ufw default deny incoming`, `ufw allow OpenSSH` | Firewall & Einbruchschutz |
| Brute-Force-Schutz | `fail2ban` mit `jail.local` | Firewall & Einbruchschutz |
| Unnötige Dienste aus | `ss -tulpn`, `systemctl disable --now …` | Spielregeln & Angriffsfläche |
| Backup + Wiederherstellung getestet | `tar`, Prüfsummen, Kopie auf einen anderen Rechner | Backup & Wiederherstellung |

Wichtig: **Vor** `ufw enable` SSH erlauben und eine zweite Sitzung offen lassen – so sperrst du dich nicht aus. Bei Proxmox hilft im Notfall die VM-Konsole im Webinterface.

## 5 · Erfolg von außen nachweisen

```bash
nmap -sV 192.168.1.50                       # nur noch 22/tcp offen?
ssh root@192.168.1.50                       # muss abgelehnt werden
ssh -o PubkeyAuthentication=no admin@192.168.1.50   # Passwort-Login abgelehnt?
```

Auf der Ziel-VM siehst du die Versuche:

```bash
sudo journalctl -u ssh --since "10 min ago" | grep -Ei 'failed|refused|invalid'
sudo fail2ban-client status sshd
```

## 6 · Dokumentieren

Halte Vorher/Nachher in einer kurzen Markdown-Datei fest (offene Ports, Maßnahmen, Prüfergebnis, Datum). Genau so eine Dokumentation wird in der Praxis – und in der IHK-Projektarbeit – erwartet. Vorlage: das Runbook aus der Lektion „Sicherheitsvorfall“.

## Weiter vertiefen

- **Monitoring:** Uptime Kuma (Teil 3) auf `fis-lab`, das die Ziel-VM überwacht.
- **Zentrales Logging:** rsyslog der Ziel-VM an `fis-lab` schicken und dort mit dem Mini-SIEM-Muster auswerten.
- **Snapshots:** Vor jeder größeren Änderung in Proxmox einen Snapshot anlegen – wie in der VM-Zentrale.
