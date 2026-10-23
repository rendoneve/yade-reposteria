# Abre una ventana de PowerShell por cada servicio.
# Uso (desde la carpeta back-end):   .\iniciar-backend.ps1
# Si Windows bloquea el script:      powershell -ExecutionPolicy Bypass -File .\iniciar-backend.ps1

$servicios = @(
    @{ nombre = "auth";      puerto = 8001 },
    @{ nombre = "catalogo";  puerto = 8002 },
    @{ nombre = "citas";     puerto = 8003 },
    @{ nombre = "negocio";   puerto = 8004 },
    @{ nombre = "actividad"; puerto = 8005 },
    @{ nombre = "gateway";   puerto = 8000 }
)

if (-not (Test-Path "$PSScriptRoot\.env")) {
    Write-Host "Falta el archivo back-end\.env (copia .env.example y llénalo)." -ForegroundColor Red
    exit 1
}

foreach ($s in $servicios) {
    $carpeta = Join-Path $PSScriptRoot "servicio-$($s.nombre)"
    $comando = "`$Host.UI.RawUI.WindowTitle = 'servicio-$($s.nombre) :$($s.puerto)'; " +
               "Set-Location '$carpeta'; uv run fastapi dev app/main.py --port $($s.puerto)"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $comando
}

Write-Host "Listo. Gateway en http://localhost:8000  ·  estado: http://localhost:8000/health" -ForegroundColor Green
