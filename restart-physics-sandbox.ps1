# restart-physics-sandbox.ps1
# Kill any python.exe serving on :8081 and relaunch start-server.bat.
# Mirrors the PORTL restart pattern. Self-contained — uses $PSScriptRoot.

$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$launcher   = Join-Path $projectDir 'start-server.bat'

try {
    if (-not (Test-Path -LiteralPath $launcher)) {
        throw "start-server.bat not found at $launcher"
    }

    # Find python.exe processes whose CommandLine references port 8081.
    $targets = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match '8081' }

    foreach ($proc in $targets) {
        try {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
            Write-Host "[restart-physics-sandbox] killed pid $($proc.ProcessId)"
        } catch {
            Write-Host "[restart-physics-sandbox] failed to kill pid $($proc.ProcessId): $($_.Exception.Message)"
        }
    }

    Start-Sleep -Milliseconds 500

    Start-Process `
        -FilePath $launcher `
        -WorkingDirectory $projectDir `
        -WindowStyle Minimized | Out-Null

    Write-Host '[restart-physics-sandbox] OK'
} catch {
    Write-Host "[restart-physics-sandbox] ERROR: $($_.Exception.Message)"
    exit 1
}
