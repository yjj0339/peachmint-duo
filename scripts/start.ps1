param([int]$Port = 4412)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $root.StartsWith('D:\', [StringComparison]::OrdinalIgnoreCase)) { throw 'only run from D:' }
$node = 'D:\codexAI\.toolchains\emsdk\node\24.19.0_64bit\node.exe'
$env:PORT = [string]$Port
$env:TEMP = Join-Path $root 'runtime\temp'; $env:TMP = $env:TEMP
foreach ($d in @('temp', 'logs', 'data')) { New-Item -ItemType Directory -Force -Path (Join-Path $root "runtime\$d") | Out-Null }
$stateFile = Join-Path $root 'runtime\state.json'
$ready = $false
try { $h = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2; $ready = $h.ok -and $h.name -eq 'PEACHMINT' } catch {}
$pid_ = 0
if (-not $ready) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $p = Start-Process -FilePath $node -ArgumentList @('"' + (Join-Path $root 'server\index.js') + '"') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root "runtime\logs\server-$stamp.log") -RedirectStandardError (Join-Path $root "runtime\logs\server-$stamp.err.log") -PassThru
  for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 500; try { $h = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2; if ($h.ok) { $ready = $true; break } } catch {} }
  if (-not $ready) { throw 'server did not become healthy; see runtime/logs' }
  $pid_ = $p.Id
}
$state = [ordered]@{ project = $root; port = $Port; serverPid = $pid_; tunnelPid = 0; updatedAt = (Get-Date).ToString('o') }
if (Test-Path $stateFile) { try { $old = Get-Content $stateFile -Raw | ConvertFrom-Json; if ($old.project -eq $root) { $state.tunnelPid = $old.tunnelPid; if (-not $pid_) { $state.serverPid = $old.serverPid } } } catch {} }
$state | ConvertTo-Json | Set-Content $stateFile -Encoding utf8
Write-Host "PEACHMINT local: http://127.0.0.1:$Port"
