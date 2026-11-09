# Teilprojekt 4: Lernpfad für alle Themen

Stand: 2026-11-09 · Branch `feature/lernpfad-alle-themen`

## Ziel

Alle Linux-Themen folgen dem Pfad ① Lernen (Browser) → ② Üben (Übungs-VM) → ③ Anwenden (Server-VM) → ④ Störfall.

## Zuordnung

| Thema | ① Lernen | ② Üben (Übungs-VM) | ③ Anwenden (Server-VM) | ④ Störfall |
|---|---|---|---|---|
| Linux-Grundlagen & Dienste | b1–b8, b10 | v1 apt, v2 Benutzer, v3 systemd, v4 Netz | v5 SSH … v15 Troubleshooting | m-disk, m-cpu, m-hosts, m-user, m-nginx, m-cron, m-ssh, m-502 |
| Bash-Skripte | b9 Shell-Skripte | x1–x5 | x6 Systembericht | msc-* |
| Netzwerk | **net0-mini (neu)** | net1–net5 | – | mnet-* |
| IT-Security | **sec0-mini (neu)** | sec1, sec4, sec7 | sec2, sec3, sec5, sec6 | m-ufw, msec-* |
| Git, Docker & Selbst hosten | – | dev1–dev4 | s1–s4 | m-docker, mdev-* |
| Datenbanken | Krimi 1–2 | db2 | v8, v8b, WordPress, Gitea, Nextcloud | mdb-* |

Windows-Kurs (PowerShell, Sandbox) bleibt vorerst ohne Lernpfad.

## Technik

- Übungen in der Übungs-VM müssen **für sich allein** laufen, weil „Übung vorbereiten“ auf `basis` zurücksetzt.
  Abhängigkeiten stellt ein `prep` her (x2, x3, x5: `~/bin`; dev2: Git-Repository; dev4: Docker).
- Browser-Lektionen können ein `prep` haben (BusyBox-sh, unsichtbar über die serielle Konsole). Knopf „Übungsdaten bereitstellen“.
- `vmRunHidden` schreibt lange Skripte in Stücken in eine Datei – die BusyBox-Shell nimmt nur ~1000 Zeichen pro Zeile an.
- `test:vm-lessons --reset-each` setzt die Übungs-VM vor jeder Lektion zurück (wie die App) und führt `prep` aus.
  Der Testlauf hält Variablen, `PATH` und Funktionen zwischen den Befehlen (wie ein echtes Terminal) und beantwortet `read` mit einer Testeingabe.

## Geprüft

- Übungs-VM mit `--reset-each`: Bash 26/26, Netzwerk 25/25, Git/Docker 24/24, Security 14/14, Linux 29/29
- Mini-Linux: net0-mini 7/7, sec0-mini 4/4; Wargame-Level weiterhin ok
- `npm test`
