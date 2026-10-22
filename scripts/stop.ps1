$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$stateFile = Join-Path $root 'runtime\state.json'
if (-not (Test-Path $stateFile)) { Write-Host 'no recorded processes'; exit 0 }
$state = Get-Content $stateFile -Raw | ConvertFrom-Json
if ($state.project -ne $root) { throw 'state file belongs to another project' }
foreach ($kind in @('tunnel', 'server')) {
  $id = if ($kind -eq 'tunnel') { $state.tunnelPid } else { $state.serverPid }
  if (-not $id) { continue }
  $proc = Get-CimInstance Win32_Process -Filter ("ProcessId=" + [int]$id) -ErrorAction SilentlyContinue
  if (-not $proc) { continue }
  $ok = if ($kind -eq 'server') { $proc.ExecutablePath -eq 'D:\codexAI\.toolchains\emsdk\node\24.19.0_64bit\node.exe' -and $proc.CommandLine.Contains('peachmint-duo\server\index.js') } else { $proc.Name -eq 'cloudflared.exe' }
  if ($ok) { Stop-Process -Id ([int]$id) -Force; Write-Host "stopped $kind $id" } else { Write-Warning "pid $id not ours, kept" }
}
