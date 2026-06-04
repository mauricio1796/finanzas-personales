
# ══════════════════════════════════════════════════════════════════════════════
# FinancyAI — Script de ejecución de pruebas Maestro
# Uso: .\run_tests.ps1 [-Flow nombre] [-Report] [-Clean]
# ══════════════════════════════════════════════════════════════════════════════
param(
    [string]$Flow = "",       # Ejecutar solo un flujo específico (ej: "01_auth")
    [switch]$Report,          # Generar reporte HTML
    [switch]$Clean,           # Limpiar screenshots anteriores antes de correr
    [switch]$Studio           # Abrir Maestro Studio (modo interactivo)
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FlowsDir = Join-Path $RootDir "flows"
$ReportsDir = Join-Path $RootDir "reports"
$ScreenshotsDir = Join-Path $RootDir "screenshots"

# ── Verificar Maestro instalado ───────────────────────────────────────────────
if (-not (Get-Command maestro -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  Maestro no está instalado." -ForegroundColor Red
    Write-Host "  Instalación (bash/WSL):" -ForegroundColor Yellow
    Write-Host '    curl -Ls "https://get.maestro.mobile.dev" | bash' -ForegroundColor Cyan
    Write-Host "  O con brew (Mac):" -ForegroundColor Yellow
    Write-Host '    brew tap mobile-dev-inc/tap && brew install maestro' -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# ── Limpiar si se solicita ────────────────────────────────────────────────────
if ($Clean -and (Test-Path $ScreenshotsDir)) {
    Remove-Item -Recurse -Force $ScreenshotsDir
    Write-Host "Screenshots anteriores eliminados." -ForegroundColor Gray
}

New-Item -ItemType Directory -Force -Path $ReportsDir | Out-Null
New-Item -ItemType Directory -Force -Path $ScreenshotsDir | Out-Null

# ── Modo Studio ───────────────────────────────────────────────────────────────
if ($Studio) {
    Write-Host "Abriendo Maestro Studio..." -ForegroundColor Cyan
    maestro studio
    exit 0
}

# ── Ejecutar flujo(s) ─────────────────────────────────────────────────────────
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

if ($Flow -ne "") {
    $flowFile = Join-Path $FlowsDir "${Flow}.yaml"
    if (-not (Test-Path $flowFile)) {
        Write-Host "Flujo no encontrado: $flowFile" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "  Ejecutando flujo: $Flow" -ForegroundColor Cyan
    Write-Host ""

    if ($Report) {
        maestro test $flowFile --format junit --output "$ReportsDir\${Flow}_${timestamp}.xml"
    } else {
        maestro test $flowFile
    }
} else {
    Write-Host ""
    Write-Host "  FinancyAI — Suite completa de pruebas E2E" -ForegroundColor Cyan
    Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Gray
    Write-Host ""

    $flows = @(
        "01_auth",
        "02_onboarding",
        "03_dashboard_transacciones",
        "04_finn_ai_metas",
        "05_gamificacion_configuracion"
    )

    $passed = 0
    $failed = 0

    foreach ($flow in $flows) {
        $flowFile = Join-Path $FlowsDir "${flow}.yaml"
        Write-Host "  Ejecutando: $flow..." -ForegroundColor White -NoNewline

        try {
            if ($Report) {
                maestro test $flowFile --format junit --output "$ReportsDir\${flow}_${timestamp}.xml" 2>&1 | Out-Null
            } else {
                maestro test $flowFile 2>&1 | Out-Null
            }
            Write-Host " PASS" -ForegroundColor Green
            $passed++
        } catch {
            Write-Host " FAIL" -ForegroundColor Red
            $failed++
        }
    }

    Write-Host ""
    Write-Host "  Resultado: $passed pasados / $($passed + $failed) total" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
    Write-Host ""

    if ($Report) {
        Write-Host "  Reportes guardados en: $ReportsDir" -ForegroundColor Gray
    }
}
