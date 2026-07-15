[CmdletBinding()]
param(
    [ValidateSet("all", "frontend", "backend", "ai-worker")]
    [string]$Service = "all"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

function Assert-Command {
    param([string]$Name, [string]$InstallHint)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found. $InstallHint"
    }
}

function Resolve-MavenCommand {
    $command = Get-Command "mvn.cmd" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidates = @(
        "F:\maven\maven3.8.6\apache-maven-3.8.6\bin\mvn.cmd",
        (Join-Path $env:ProgramFiles "Apache\maven\bin\mvn.cmd")
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    throw "Maven was not found. Install Maven or add mvn.cmd to PATH."
}

function Initialize-JavaEnvironment {
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
        return
    }

    $javaHome = "C:\Program Files\Amazon Corretto\jdk17.0.18_9"
    if (Test-Path (Join-Path $javaHome "bin\java.exe")) {
        $env:JAVA_HOME = $javaHome
        $env:Path = (Join-Path $javaHome "bin") + ";" + $env:Path
        return
    }

    throw "JDK 17 was not found. Set JAVA_HOME to a JDK installation."
}

function Stop-PortProcess {
    param([int]$Port)

    $processIds = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($processId in $processIds) {
        if ($processId -and $processId -ne $PID) {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            $name = if ($process) { $process.ProcessName } else { "unknown" }
            Write-Host "Stopping process $processId ($name) on port $Port..."
            Stop-Process -Id $processId -Force
        }
    }
}

function Wait-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
            Write-Host "[OK] $Name - $Url" -ForegroundColor Green
            return $true
        } catch {
            Start-Sleep -Seconds 2
        }
    }

    Write-Warning "$Name did not become ready within $TimeoutSeconds seconds: $Url"
    return $false
}

function Start-ServiceWindow {
    param([string]$Name)

    $arguments = @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$PSCommandPath`"",
        "-Service", $Name
    )
    Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WorkingDirectory $ProjectRoot
}

function Test-DockerDaemon {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        docker info *> $null
        return $LASTEXITCODE -eq 0
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Ensure-DockerDaemon {
    if (Test-DockerDaemon) {
        return
    }

    $dockerDesktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $dockerDesktop)) {
        throw "Docker is installed but its daemon is unavailable. Start Docker Desktop and retry."
    }

    Write-Host "Starting Docker Desktop..."
    Start-Process -FilePath $dockerDesktop
    $deadline = (Get-Date).AddMinutes(2)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3
        if (Test-DockerDaemon) {
            Write-Host "[OK] Docker Desktop is ready." -ForegroundColor Green
            return
        }
    }

    throw "Docker Desktop did not become ready within 2 minutes."
}

if ($Service -eq "frontend") {
    Set-Location (Join-Path $ProjectRoot "frontend")
    $Host.UI.RawUI.WindowTitle = "Edu Evaluation - Frontend"
    npm run dev
    exit $LASTEXITCODE
}

if ($Service -eq "backend") {
    Set-Location (Join-Path $ProjectRoot "backend")
    $Host.UI.RawUI.WindowTitle = "Edu Evaluation - Backend"
    Initialize-JavaEnvironment
    $maven = Resolve-MavenCommand
    $env:Path = (Split-Path $maven) + ";" + $env:Path
    & $maven spring-boot:run
    exit $LASTEXITCODE
}

if ($Service -eq "ai-worker") {
    Set-Location (Join-Path $ProjectRoot "ai-worker")
    $Host.UI.RawUI.WindowTitle = "Edu Evaluation - AI Worker"
    & ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000
    exit $LASTEXITCODE
}

Write-Host "Starting Edu Evaluation local environment..." -ForegroundColor Cyan
Assert-Command "docker" "Install and start Docker Desktop."
Assert-Command "mvn" "Install Maven and ensure it is available on PATH."
Assert-Command "java" "Install JDK 17 or newer and ensure it is available on PATH."
Assert-Command "node" "Install Node.js and ensure it is available on PATH."
Assert-Command "npm" "Install npm and ensure it is available on PATH."
Assert-Command "python" "Install Python and ensure it is available on PATH."

Ensure-DockerDaemon

$frontendPath = Join-Path $ProjectRoot "frontend"
if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $frontendPath
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
    } finally {
        Pop-Location
    }
}

$workerPath = Join-Path $ProjectRoot "ai-worker"
$workerPython = Join-Path $workerPath ".venv\Scripts\python.exe"
if (-not (Test-Path $workerPython)) {
    Write-Host "Creating AI Worker virtual environment..."
    python -m venv (Join-Path $workerPath ".venv")
    & $workerPython -m pip install -r (Join-Path $workerPath "requirements.txt")
    if ($LASTEXITCODE -ne 0) { throw "AI Worker dependency installation failed." }
}

Write-Host "Starting MySQL, Redis, and MinIO..."
docker compose -f (Join-Path $ProjectRoot "infra\docker-compose.yml") up -d
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed to start the infrastructure services."
}

foreach ($port in 5173, 8080, 8000) {
    Stop-PortProcess -Port $port
}

Start-ServiceWindow -Name "ai-worker"
Start-ServiceWindow -Name "backend"
Start-ServiceWindow -Name "frontend"

Write-Host ""
Write-Host "Waiting for application services..." -ForegroundColor Cyan
$workerReady = Wait-Endpoint -Name "AI Worker" -Url "http://localhost:8000/health"
$backendReady = Wait-Endpoint -Name "Backend" -Url "http://localhost:8080/api/health"
$frontendReady = Wait-Endpoint -Name "Frontend" -Url "http://localhost:5173" -TimeoutSeconds 60

Write-Host ""
Write-Host "Local service addresses:" -ForegroundColor Cyan
Write-Host "  Frontend:            http://localhost:5173"
Write-Host "  Backend health:      http://localhost:8080/api/health"
Write-Host "  AI Worker health:    http://localhost:8000/health"
Write-Host "  MinIO console:       http://localhost:9003"

if (-not ($workerReady -and $backendReady -and $frontendReady)) {
    throw "One or more application services failed their readiness check. Review the service windows above."
}

Write-Host ""
Write-Host "All services are ready." -ForegroundColor Green
