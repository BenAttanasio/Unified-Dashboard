# deploy.ps1 — build on Windows, ship to the Raspberry Pi 5, restart the service.
#
#   ./deploy.ps1            # incremental deploy (build + ship + restart)
#   ./deploy.ps1 -FirstDeploy   # also create + enable the systemd user service
#
# Pi conventions (see RASPBERRY_PI_REFERENCE.md): single-quoted SSH commands,
# clean PATH for npm, tar+scp (no rsync), native addons rebuilt on-device,
# secrets copied separately with chmod 600.

param([switch]$FirstDeploy)

$ErrorActionPreference = "Stop"
$Pi = "pi@raspberrypi.local"
$RemoteDir = "/home/pi/unified-dashboard"
$Service = "unified-dashboard"
$Port = 3100

Write-Host "==> 1/7 Building (next build, standalone output)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "next build failed" }

Write-Host "==> 2/7 Assembling standalone bundle..." -ForegroundColor Cyan
$stage = Join-Path $PSScriptRoot ".deploy-stage"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item -Recurse -Force ".\.next\standalone\*" $stage
New-Item -ItemType Directory -Force "$stage\.next\static" | Out-Null
Copy-Item -Recurse -Force ".\.next\static\*" "$stage\.next\static"
if (Test-Path ".\public") { Copy-Item -Recurse -Force ".\public" "$stage\public" }

Write-Host "==> 3/7 Packing tarball..." -ForegroundColor Cyan
$tar = Join-Path $PSScriptRoot "deploy.tar.gz"
if (Test-Path $tar) { Remove-Item -Force $tar }
tar czf $tar -C $stage .
if ($LASTEXITCODE -ne 0) { throw "tar failed" }

Write-Host "==> 4/7 Transferring to Pi..." -ForegroundColor Cyan
scp $tar "${Pi}:/tmp/deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

Write-Host "==> 5/7 Extracting + rebuilding better-sqlite3 for aarch64..." -ForegroundColor Cyan
ssh $Pi "mkdir -p $RemoteDir && tar xzf /tmp/deploy.tar.gz -C $RemoteDir && rm /tmp/deploy.tar.gz && cd $RemoteDir && PATH=/home/pi/.npm-global/bin:/usr/local/bin:/usr/bin:/bin npm install better-sqlite3@11 --no-save --no-audit --no-fund"
if ($LASTEXITCODE -ne 0) { throw "remote extract/install failed" }

Write-Host "==> 6/7 Copying secrets (.env, chmod 600)..." -ForegroundColor Cyan
scp ".\.env" "${Pi}:${RemoteDir}/.env"
ssh $Pi "chmod 600 ${RemoteDir}/.env"

if ($FirstDeploy) {
  Write-Host "==> 7/7 Installing systemd user service..." -ForegroundColor Cyan
  $unit = @"
[Unit]
Description=Unified Business Dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$RemoteDir
EnvironmentFile=$RemoteDir/.env
Environment=NODE_ENV=production
Environment=PORT=$Port
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/node $RemoteDir/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
"@
  # Write with LF endings so systemd parses it cleanly.
  $unitFile = Join-Path $PSScriptRoot "$Service.service"
  [IO.File]::WriteAllText($unitFile, ($unit -replace "`r`n", "`n"))
  ssh $Pi "mkdir -p ~/.config/systemd/user"
  scp $unitFile "${Pi}:~/.config/systemd/user/$Service.service"
  Remove-Item -Force $unitFile
  ssh $Pi "systemctl --user daemon-reload && systemctl --user enable $Service && systemctl --user restart $Service"
} else {
  Write-Host "==> 7/7 Restarting service..." -ForegroundColor Cyan
  ssh $Pi "systemctl --user restart $Service"
}

Start-Sleep -Seconds 3
Write-Host "==> Health check:" -ForegroundColor Green
ssh $Pi "curl -s http://localhost:$Port/api/health"
Write-Host ""
Write-Host "Done. If kiosk still points at 3099, update ~/.config/labwc/autostart and reboot." -ForegroundColor Yellow
