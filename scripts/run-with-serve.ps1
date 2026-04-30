param(
  [string]$NodeScript = "scripts/e2e-smoke.cjs",
  [int]$Port = 4300
)

$ErrorActionPreference = "Stop"
$workdir = "d:\senclinic\senclinic-frontend"
$proc = $null
try {
  $proc = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start", "--", "--port", "$Port", "--host", "127.0.0.1" -WorkingDirectory $workdir -PassThru -WindowStyle Hidden
  $ready = $false
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 1000
    try {
      $res = Invoke-WebRequest -Uri "http://127.0.0.1:$Port" -UseBasicParsing -TimeoutSec 2
      if ($res.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {}
  }

  if (-not $ready) {
    throw "Le serveur Angular sur $Port n'a pas demarre a temps."
  }

  $env:BASE_URL = "http://127.0.0.1:$Port"
  node $NodeScript
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }
}
