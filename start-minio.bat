@echo off
REM Windows CMD script to start MinIO AIStor Server with license
set MINIO_ROOT_USER=minioadmin
set MINIO_ROOT_PASSWORD=minioadmin

set LICENSE_PATH=%~dp0minio-license.jwt
set DATA_DIR=C:\minio

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
copy /Y "%LICENSE_PATH%" "%DATA_DIR%\minio.license" >nul

echo Starting MinIO Server with license: %LICENSE_PATH%
C:\minio.exe server "%DATA_DIR%" --license "%LICENSE_PATH%" --console-address ":9001"
