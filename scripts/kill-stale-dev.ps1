$ErrorActionPreference = "SilentlyContinue"

$workspacePath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Write-Output "Cleaning stale dev processes in: $workspacePath"

$devPorts = 3000..3010
$listenLines = netstat -ano -p tcp | Select-String "LISTENING"
$targetPids = @()

foreach ($line in $listenLines) {
  $parts = ($line.Line -replace "\s+", " ").Trim().Split(" ")
  if ($parts.Count -lt 5) { continue }

  $localAddress = $parts[1]
  $pid = $parts[4]
  $port = 0
  if ($localAddress -match ":(\d+)$") {
    $port = [int]$Matches[1]
  }

  if ($devPorts -contains $port) {
    $targetPids += [int]$pid
  }
}

$targetPids = $targetPids | Select-Object -Unique

if ($targetPids.Count -eq 0) {
  Write-Output "No stale dev processes found."
  exit 0
}

foreach ($pid in $targetPids) {
  try {
    taskkill /PID $pid /T /F | Out-Null
    Write-Output "Stopped PID $pid (and child processes)"
  } catch {
    Write-Output "Failed to stop PID ${pid}: $($_.Exception.Message)"
  }
}

Write-Output "Done."
