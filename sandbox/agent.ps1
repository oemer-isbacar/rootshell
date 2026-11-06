# Läuft beim Anmelden in der Windows-Sandbox (LogonCommand). C:\lab ist schreibgeschützt eingebunden,
# C:\labout ist der Rückkanal zur App (IP-Adresse, Fehler).
$ErrorActionPreference = 'Stop'
$in = 'C:\lab'; $out = 'C:\labout'; $port = 7777
try {
    Add-Type -TypeDefinition (Get-Content "$in\LabAgent.cs" -Raw)
    $token = (Get-Content "$in\token.txt" -Raw).Trim()
    try { New-NetFirewallRule -DisplayName 'Linux Lab Agent' -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null }
    catch { "Firewall: $_" | Add-Content "$out\warn.txt" }
    [LabAgent]::Start('0.0.0.0', $port, $token)
    # Warten, bis das Netzwerk eine Adresse hat
    $ip = $null
    for ($i = 0; $i -lt 60 -and -not $ip; $i++) {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
               Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
               Select-Object -First 1).IPAddress
        if (-not $ip) { Start-Sleep 1 }
    }
    @{ ip = $ip; port = $port; user = $env:USERNAME; time = (Get-Date).ToString('s') } | ConvertTo-Json | Set-Content "$out\ready.json" -Encoding UTF8
    while ($true) { Start-Sleep 30; if ([LabAgent]::LastError) { [LabAgent]::LastError | Set-Content "$out\agent-error.txt"; [LabAgent]::LastError = '' } }
}
catch { $_ | Out-String | Set-Content "$out\error.txt" }
