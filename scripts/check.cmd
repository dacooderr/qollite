@echo off
REM Double-clickable launcher for the upstream check.
REM Running a .py straight from Explorer closes the window before you can read
REM anything; this keeps it open and also leaves the output in a file.
REM
REM   check.cmd            check bundled mods against GameBanana
REM   check.cmd test       run the offline test suite instead
REM   check.cmd --json     any other argument is passed straight through

setlocal
cd /d "%~dp0\.."
set "LOG=%TEMP%\qollite_upstream.txt"

where python >nul 2>&1
if errorlevel 1 (
    echo Python was not found on PATH.
    echo Install it from https://www.python.org/downloads/
    echo and tick "Add python.exe to PATH" during setup.
    goto :done
)

if /i "%~1"=="test" (
    echo Running the offline test suite - no network, changes nothing.
    echo.
    python scripts\test_check_upstream.py > "%LOG%" 2>&1
    goto :show
)

echo Checking bundled mods against GameBanana.
echo Read-only: downloads no mod files, changes nothing in the tree.
echo.
python scripts\check_upstream.py %* > "%LOG%" 2>&1

:show
set "CODE=%errorlevel%"
type "%LOG%"
echo.
echo ---------------------------------------------------------------
echo Exit code %CODE%   ^(0 = nothing to do, 1 = updates found, 2 = error^)
echo Output saved to %LOG%

:done
echo.
echo Press any key to close...
pause >nul
endlocal
