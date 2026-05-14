# watchdog-physics-sandbox.ps1
# Poll http://127.0.0.1:8081/ every 5s; on failure, invoke restart-physics-sandbox.ps1.
# Mirrors the PORTL watchdog pattern. Runs until Ctrl+C.

$ErrorActionPreference = 'Continue'
$projectDir   = $PSScriptRoot
$restartPath  = Join-Path $projectDir 'restart-physics-sandbox.ps1'
$healthUrl    = 'http://127.0.0.1:8081/'
$intervalSec  = 5
$timeoutSec   = 4

if (-not (Test-Path -LiteralPath $restartPath)) {
    Write-Host "[watchdog-physics-sandbox] FATAL: restart-physics-sandbox.ps1 not found at $restartPath"
    exit 1
}

Write-Host "[watchdog-physics-sandbox] watching $healthUrl every ${intervalSec}s (timeout ${timeoutSec}s)"

while ($true) {
    $healthy = $false
    $reason  = ''
    try {
        $resp = Invoke-WebRequest `
            -Uri $healthUrl `
            -Method Head `
            -TimeoutSec $timeoutSec `
            -UseBasicParsing `
            -ErrorAction Stop
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
            $healthy = $true
        } else {
            $reason = "status $($resp.StatusCode)"
        }
    } catch {
        $reason = $_.Exception.Message
    }

    if (-not $healthy) {
        Write-Host "[watchdog-physics-sandbox] DOWN: $reason — restarting"
        try {
            & $restartPath
        } catch {
            Write-Host "[watchdog-physics-sandbox] restart invocation failed: $($_.Exception.Message)"
        }
        # Give the server a moment to come up before next probe.
        Start-Sleep -Seconds 3
    }

    Start-Sleep -Seconds $intervalSec
}
