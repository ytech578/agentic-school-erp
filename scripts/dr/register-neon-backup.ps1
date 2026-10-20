param([string]$At = '02:00', [switch]$Update)
$ErrorActionPreference = 'Stop'
$taskName = 'Agentic School ERP - Encrypted Neon Backup'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$runner = Join-Path $PSScriptRoot 'run-neon-backup.ps1'
$powershellPath = (Get-Command pwsh.exe -ErrorAction Stop).Source
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}" -NodePath "{1}"' -f $runner, $nodePath
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $arguments -WorkingDirectory ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')))
$trigger = New-ScheduledTaskTrigger -Daily -At ([DateTime]::ParseExact($At, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture))
$userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
# Interactive-token execution needs no stored password. It runs only while this
# user is signed in and requires Docker Desktop to be available.
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Daily AES-256-GCM Neon ERP backup; requires signed-in user and Docker. See backups/neon/scheduled-backup-status.json.'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    if ($Update) {
        Set-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Select-Object TaskName,State
        exit 0
    }
    throw 'The ERP backup task already exists. Inspect it before changing its schedule.'
}
Register-ScheduledTask -TaskName $taskName -InputObject $task | Select-Object TaskName,State
