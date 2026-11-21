# Tranche Guard: one script to set up and run the API, the web app and the phone access.
# Run it through dev.cmd (this PC blocks .ps1 files):
#   dev.cmd            set up what is missing, then start the API and the web app
#   dev.cmd stop       stop both
#   dev.cmd status     show what is running and the URLs
#   dev.cmd db         (re)connect backend\.env to Supabase (asks for the database password)
#   dev.cmd key        copy DEVICE_API_KEY to the clipboard (never printed)
#   dev.cmd firewall   allow port 8000 for the phone (asks for admin)
# Kept ASCII only so Windows PowerShell 5.1 reads it correctly.

param([string]$Command = "start")

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$VenvPy = Join-Path $Backend ".venv\Scripts\python.exe"
$EnvFile = Join-Path $Backend ".env"
$PidFile = Join-Path $Root ".dev-pids.json"
# The older separate clone of the backend branch: its .env and database are reused once.
$OldBackend = Join-Path (Split-Path $Root -Parent) "Akatsuki_backend\backend"
$ApiPort = 8000
$WebPort = 5173
$DemoEmail = "demo@trancheguard.tn"
$DemoPassword = "demo1234"
$FirewallRule = "Tranche Guard API 8000"
$PipTrust = @("--trusted-host", "pypi.org", "--trusted-host", "files.pythonhosted.org")

function Say($msg) { Write-Host "  $msg" }
function Step($msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "  XX  $msg" -ForegroundColor Red; exit 1 }

function Get-Http($url) {
    try { return Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3 } catch { return $null }
}

function Test-Login {
    # Returns the HTTP status code of the demo login (0 if the API did not answer).
    $body = @{ email = $DemoEmail; password = $DemoPassword } | ConvertTo-Json
    try {
        $r = Invoke-WebRequest "http://localhost:$ApiPort/api/auth/login" -Method Post `
            -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 5
        return [int]$r.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

function Get-WifiIp {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*" -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1
    if ($ip) { return $ip.IPAddress } else { return $null }
}

function Test-FirewallOpen {
    $rules = Get-NetFirewallPortFilter -Protocol TCP -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -contains "$ApiPort" } |
        Get-NetFirewallRule -ErrorAction SilentlyContinue |
        Where-Object { $_.Enabled -eq "True" -and $_.Direction -eq "Inbound" -and $_.Action -eq "Allow" }
    return [bool]$rules
}

function Get-PortOwners($port) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
}

function Stop-Tree($procId, $why) {
    if (-not (Get-Process -Id $procId -ErrorAction SilentlyContinue)) { return }
    # Through cmd so a "process not found" (child already gone with its parent) is not a PowerShell error.
    & cmd.exe /c "taskkill /T /F /PID $procId >nul 2>&1"
    Say "stopped $why (PID $procId)"
}

function Stop-Servers {
    # 1) The windows this script opened (kills the whole tree: cmd, python, node).
    if (Test-Path $PidFile) {
        $saved = Get-Content $PidFile -Raw | ConvertFrom-Json
        foreach ($p in $saved.PSObject.Properties) {
            # After a reboot Windows may reuse the PID for another program: only stop our cmd windows.
            $proc = Get-Process -Id ([int]$p.Value) -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq "cmd") { Stop-Tree $proc.Id "$($p.Name) window" }
        }
        Remove-Item $PidFile -Force
    }
    # 2) Anything else still listening on the ports (started by hand, older clone...).
    foreach ($port in @($ApiPort, $WebPort)) {
        foreach ($procId in (Get-PortOwners $port)) {
            # A venv python.exe is a launcher with the real server as its child: stop the launcher too.
            $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue).ParentProcessId
            $pp = if ($parent) { Get-CimInstance Win32_Process -Filter "ProcessId=$parent" -ErrorAction SilentlyContinue }
            if ($pp -and $pp.Name -eq "python.exe") { Stop-Tree $parent "server on port $port" }
            Stop-Tree $procId "server on port $port"
        }
    }
}

function Stop-Simulator {
    $sims = Get-CimInstance Win32_Process -Filter "Name like 'python%'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "simulator\.simulator" }
    foreach ($s in $sims) { Stop-Tree $s.ProcessId "Python simulator" }
    if (-not $sims) { Ok "Python simulator is not running" }
}

function Find-SystemPython {
    foreach ($c in @(@("py", "-3.11"), @("py", "-3"), @("python"))) {
        $exe = $c[0]; $args_ = @($c | Select-Object -Skip 1)
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
        try { $v = & $exe @args_ -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null } catch { continue }
        if ($LASTEXITCODE -eq 0 -and $v -and [version]$v -ge [version]"3.11") { return , $c }
    }
    return $null
}

function Setup-Backend {
    Step "Backend setup"
    if (-not (Test-Path $VenvPy)) {
        $py = Find-SystemPython
        if (-not $py) { Fail "Python 3.11+ not found. Install it from python.org, then run dev.cmd again." }
        Say "creating backend\.venv ..."
        $exe = $py[0]; $pyArgs = @($py | Select-Object -Skip 1)
        & $exe @pyArgs -m venv (Join-Path $Backend ".venv")
        if ($LASTEXITCODE -ne 0) { Fail "could not create the virtual environment" }
        Say "installing Python packages (a minute or two) ..."
        & $VenvPy -m pip install --disable-pip-version-check -q -r (Join-Path $Backend "requirements.txt") @PipTrust
        if ($LASTEXITCODE -ne 0) { Remove-Item (Join-Path $Backend ".venv") -Recurse -Force; Fail "pip install failed (see above)" }
    }
    Ok "backend\.venv ready"

    if (-not (Test-Path $EnvFile) -and (Test-Path (Join-Path $OldBackend ".env"))) {
        # Keeps JWT_SECRET and DEVICE_API_KEY, so logins and the device key stay the same.
        Copy-Item (Join-Path $OldBackend ".env") $EnvFile
        Say "copied .env from $OldBackend (same DEVICE_API_KEY as before)"
    }
    if (-not (Test-Supabase)) {
        Connect-Supabase
        if (-not (Test-Supabase)) { Fail "backend\.env has no Supabase DATABASE_URL. Run 'dev.cmd db' to try again." }
    }
    Ok "backend\.env points to Supabase ($(Get-DbHost))"
}

function Test-Supabase {
    if (-not (Test-Path $EnvFile)) { return $false }
    return [bool](Select-String -Path $EnvFile -Pattern "^\s*DATABASE_URL\s*=\s*postgres" -Quiet)
}

function Get-DbHost {
    # Host only, never the password.
    $line = Select-String -Path $EnvFile -Pattern "^\s*DATABASE_URL\s*=\s*\S*@([^:/]+)" | Select-Object -First 1
    if ($line) { return $line.Matches[0].Groups[1].Value } else { return "unknown host" }
}

function Connect-Supabase {
    # The backend's own helper: asks for the Supabase database password (typed hidden),
    # tests the connection and writes DATABASE_URL into backend\.env, keeping the other secrets.
    Step "Connect to Supabase"
    Say "Type the Supabase database password for Akatsuki_db when asked (it stays hidden)."
    Push-Location $Backend
    try { & $VenvPy -m scripts.setup_env } finally { Pop-Location }
}

function Setup-Frontend {
    Step "Frontend setup"
    if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
        if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Fail "Node.js not found. Install it from nodejs.org, then run dev.cmd again." }
        Say "installing npm packages ..."
        $env:NODE_OPTIONS = "--use-system-ca"
        Push-Location $Frontend
        try {
            & npm.cmd install --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) {
                Warn "npm install failed, retrying once without SSL checks (this network intercepts HTTPS)"
                & npm.cmd install --no-audit --no-fund --strict-ssl=false
            }
        } finally { Pop-Location; Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue }
        if ($LASTEXITCODE -ne 0) { Fail "npm install failed (see above)" }
    }
    Ok "frontend\node_modules ready"
}

function Wait-Url($url, $seconds) {
    for ($i = 0; $i -lt $seconds; $i++) {
        if (Get-Http $url) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-Servers {
    Step "Starting servers"
    Stop-Simulator
    Stop-Servers

    $api = Start-Process cmd.exe -WorkingDirectory $Backend -PassThru -ArgumentList "/k", `
        "title Tranche Guard API (close to stop) & `"$VenvPy`" -m uvicorn app.main:app --host 0.0.0.0 --port $ApiPort"
    $web = Start-Process cmd.exe -WorkingDirectory $Frontend -PassThru -ArgumentList "/k", `
        "title Tranche Guard web (close to stop) & npm.cmd run dev"
    @{ api = $api.Id; web = $web.Id } | ConvertTo-Json | Set-Content $PidFile

    if (Wait-Url "http://localhost:$ApiPort/api/health" 60) { Ok "API answers on port $ApiPort" }
    else { Fail "API did not start: read the 'Tranche Guard API' window" }

    $code = Test-Login
    if ($code -eq 401) {
        # Safe to run twice: keeps existing data, only fills what is missing, sets the demo password.
        Warn "demo login refused, creating or resetting the demo account in Supabase"
        Push-Location $Backend
        try { & $VenvPy -m scripts.seed_demo --email $DemoEmail --password $DemoPassword | Out-Null } finally { Pop-Location }
        $code = Test-Login
    }
    if ($code -eq 200) { Ok "demo login works ($DemoEmail / $DemoPassword)" }
    else { Warn "demo login returned HTTP $code" }

    if (Wait-Url "http://localhost:$WebPort" 60) { Ok "web app answers on port $WebPort" }
    else { Fail "web app did not start: read the 'Tranche Guard web' window" }
}

function Show-Summary {
    Step "Ready"
    $ip = Get-WifiIp
    if (Test-Supabase) { Say "Database       Supabase ($(Get-DbHost))" }
    Say "Web app        http://localhost:$WebPort"
    Say "Control page   http://localhost:$WebPort/esp"
    Say "Login          $DemoEmail / $DemoPassword"
    Say "Device key     run 'dev.cmd key' to copy DEVICE_API_KEY, paste it in the device key field"
    if ($ip) { Say "Phone app      http://${ip}:$ApiPort   (phone on the same Wi-Fi)" }
    else { Warn "no Wi-Fi IPv4 address found: connect to Wi-Fi for the phone app" }
    if (Test-FirewallOpen) { Ok "port $ApiPort is allowed through Windows Firewall" }
    else { Warn "port $ApiPort is blocked for the phone: run 'dev.cmd firewall' once (asks for admin)" }
    Say ""
    Say "Stop everything: dev.cmd stop   (or close the two server windows)"
}

switch ($Command.ToLower()) {
    "start" {
        Setup-Backend
        Setup-Frontend
        Start-Servers
        Show-Summary
    }
    "stop" {
        Step "Stopping"
        Stop-Servers
        Ok "API and web app stopped"
    }
    "status" {
        Step "Status"
        if (Get-Http "http://localhost:$ApiPort/api/health") { Ok "API running on port $ApiPort" } else { Warn "API not running" }
        if (Get-Http "http://localhost:$WebPort") { Ok "web app running on port $WebPort" } else { Warn "web app not running" }
        Show-Summary
    }
    "db" {
        if (-not (Test-Path $VenvPy)) { Fail "backend\.venv missing: run dev.cmd first" }
        Connect-Supabase
        if (Test-Supabase) { Ok "backend\.env points to Supabase ($(Get-DbHost)). Run 'dev.cmd' to restart." }
        else { Fail "Supabase is not set up yet" }
    }
    "key" {
        if (-not (Test-Path $EnvFile)) { Fail "backend\.env missing: run dev.cmd first" }
        $line = Select-String -Path $EnvFile -Pattern "^\s*DEVICE_API_KEY\s*=\s*(\S+)" | Select-Object -First 1
        if (-not $line) { Fail "DEVICE_API_KEY is empty in backend\.env" }
        Set-Clipboard -Value $line.Matches[0].Groups[1].Value
        Ok "DEVICE_API_KEY copied to the clipboard (not shown). Paste it on the control page."
    }
    "firewall" {
        if (Test-FirewallOpen) { Ok "port $ApiPort is already allowed"; break }
        Say "Windows will ask for admin rights to add an inbound rule for TCP $ApiPort (local network only)."
        $cmd = "New-NetFirewallRule -DisplayName '$FirewallRule' -Direction Inbound -Protocol TCP -LocalPort $ApiPort -RemoteAddress LocalSubnet -Action Allow -Profile Private,Public"
        try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList "-NoProfile", "-Command", $cmd }
        catch { Fail "cancelled" }
        if (Test-FirewallOpen) { Ok "port $ApiPort allowed for the phone" } else { Warn "rule not added" }
    }
    default { Fail "unknown command '$Command'. Use: start, stop, status, key, firewall" }
}
