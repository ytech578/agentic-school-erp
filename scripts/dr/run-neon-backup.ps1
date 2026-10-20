param([string]$NodePath = 'node.exe')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$backupDirectory = Join-Path $taskRoot 'backups/neon'
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$statusFile = Join-Path $backupDirectory 'scheduled-backup-status.json'
$logFile = Join-Path $backupDirectory 'scheduled-backup.log'
$startedAt = [DateTime]::UtcNow.ToString('o')
$resultCode = 1
$previousSuccess = $null
if (Test-Path -LiteralPath $statusFile) {
    try {
        $previous = Get-Content -LiteralPath $statusFile -Raw | ConvertFrom-Json
        $previousSuccess = if ($previous.success) { $previous.finishedAt } else { $previous.lastSuccessAt }
    } catch { $previousSuccess = $null }
}
try {
    & $NodePath (Join-Path $PSScriptRoot 'neon-backup.js') backup *> $logFile
    $resultCode = $LASTEXITCODE
} catch {
    # Do not serialize exception objects: provider errors can contain credentials.
    'Backup runner could not start. Check Node, Docker and the local configuration.' | Set-Content -LiteralPath $logFile
} finally {
    $finishedAt = [DateTime]::UtcNow.ToString('o')
    if ($resultCode -eq 0) { $previousSuccess = $finishedAt }
    @{ startedAt = $startedAt; finishedAt = $finishedAt; success = ($resultCode -eq 0); exitCode = $resultCode; lastSuccessAt = $previousSuccess } |
        ConvertTo-Json | Set-Content -LiteralPath $statusFile
}
if ($resultCode -ne 0) {
    # Only a locally configured BACKUP_ALERT_EMAIL can receive a notification.
    # A failed/missing alert configuration never converts backup failure to success.
    try { & $NodePath (Join-Path $PSScriptRoot 'check-backup-health.js') --notify *> (Join-Path $backupDirectory 'backup-alert.log') } catch { }
}
exit $resultCode
