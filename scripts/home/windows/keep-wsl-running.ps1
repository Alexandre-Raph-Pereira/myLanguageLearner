# Run once in PowerShell on Windows (not as admin):
#   powershell -ExecutionPolicy Bypass -File \\wsl$\Ubuntu\home\<you>\myLanguageLearner\scripts\home\windows\keep-wsl-running.ps1
# or copy this file to Windows first. Optional: -Distro "Ubuntu-24.04" (see `wsl -l -v`).
#
# 1. Registers a scheduled task that starts WSL at logon and keeps it running, so the
#    app (a systemd user service inside WSL) is up without opening a terminal.
# 2. Sets vmIdleTimeout=-1 in %UserProfile%\.wslconfig so the WSL VM is never stopped
#    for being idle.
param([string]$Distro = "Ubuntu")

$ErrorActionPreference = "Stop"
$taskName = "myLanguageLearner - keep WSL running"

# conhost --headless runs wsl.exe with no console window (closing a visible window would
# end the keep-alive). Re-running this script updates an existing task in place.
$action = New-ScheduledTaskAction -Execute "conhost.exe" `
  -Argument "--headless wsl.exe -d $Distro --exec /bin/sh -c `"exec sleep infinity`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Force | Out-Null
Write-Host "Scheduled task '$taskName' registered (starts WSL '$Distro' at logon)."

$wslconfig = Join-Path $env:USERPROFILE ".wslconfig"
$content = if (Test-Path $wslconfig) { Get-Content $wslconfig -Raw } else { "" }
if ($content -match "(?m)^\s*vmIdleTimeout\s*=") {
  Write-Host ".wslconfig already sets vmIdleTimeout; left as is."
} elseif ($content -match "(?m)^\s*\[wsl2\]") {
  $content = $content -replace "(?m)^(\s*\[wsl2\]\s*)$", "`$1`r`nvmIdleTimeout=-1"
  Set-Content -Path $wslconfig -Value $content
  Write-Host "Added vmIdleTimeout=-1 under [wsl2] in $wslconfig."
} else {
  Add-Content -Path $wslconfig -Value "`r`n[wsl2]`r`nvmIdleTimeout=-1`r`n"
  Write-Host "Created [wsl2] vmIdleTimeout=-1 in $wslconfig."
}

Start-ScheduledTask -TaskName $taskName
Write-Host "Started. Run 'wsl --shutdown' once if you changed .wslconfig, then log off/on or start the task again."
