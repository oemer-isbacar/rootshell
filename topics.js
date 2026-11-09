/* Themen des Lernpfads: ① Lernen (Browser) → ② Üben (Übungs-VM) → ③ Anwenden (Server-VM) → ④ Störfall (Mission).
 * Lektionen gehören über topic + stage (1–3) zu einem Thema, Missionen über topic (Stufe 4).
 */
window.TOPICS = [
  { id: "linux", title: "Linux-Grundlagen & Dienste" },
  { id: "script", title: "Bash-Skripte" },
  { id: "net", title: "Netzwerk" },
  { id: "sec", title: "IT-Security" },
  { id: "devops", title: "Git, Docker & Selbst hosten" },
  { id: "db", title: "Datenbanken" },
  // Windows-Kurs: PowerShell 7 in der Übungs-VM, angewendet in der echten Windows-Sandbox
  { id: "ps", title: "PowerShell & Windows-Verwaltung" },
  { id: "ps-script", title: "PowerShell-Skripte" },
];
