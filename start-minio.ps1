# PowerShell script to start MinIO AIStor Server with license
$ErrorActionPreference = "Stop"

$MinioExe = "C:\minio.exe"
if (-not (Test-Path $MinioExe)) {
    $MinioExe = (Get-Command minio -ErrorAction SilentlyContinue).Source
}

if (-not $MinioExe -or -not (Test-Path $MinioExe)) {
    Write-Error "MinIO executable not found at C:\minio.exe or in PATH."
    exit 1
}

$LicenseFile = Join-Path $PSScriptRoot "minio-license.jwt"
if (-not (Test-Path $LicenseFile)) {
    Write-Error "License file not found at $LicenseFile"
    exit 1
}

$DataDir = "C:\minio"
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

# Ensure destination license copy exists at C:\minio\minio.license
Copy-Item $LicenseFile -Destination (Join-Path $DataDir "minio.license") -Force

Write-Host "Starting MinIO Server with license: $LicenseFile" -ForegroundColor Green
$env:MINIO_ROOT_USER = "minioadmin"
$env:MINIO_ROOT_PASSWORD = "minioadmin"

& $MinioExe server $DataDir --license $LicenseFile --console-address ":9001"
