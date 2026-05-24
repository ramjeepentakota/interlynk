@echo off
REM Local launcher for the Narada backend.
REM Secrets (DB_PASSWORD, JWT_SECRET, ADMIN_INITIAL_PASSWORD, ...) live in
REM env.local.bat, which is NOT committed to git. Copy env.local.bat.example
REM to env.local.bat and fill in your values before first run.
if exist "%~dp0env.local.bat" call "%~dp0env.local.bat"
set JPA_DDL_AUTO=update
java -jar target\enterprise-collab.jar
