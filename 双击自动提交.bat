@echo off
setlocal DisableDelayedExpansion
rem Keep this script ASCII-only to avoid cmd.exe encoding issues.
title Commit and push website updates

pushd "%~dp0"
if errorlevel 1 goto directory_error

rem Find Git in PATH, then check common installation locations.
set "GIT_EXE="
for /f "delims=" %%G in ('where git.exe 2^>nul') do if not defined GIT_EXE set "GIT_EXE=%%G"
if not defined GIT_EXE if exist "D:\Git\cmd\git.exe" set "GIT_EXE=D:\Git\cmd\git.exe"
if not defined GIT_EXE if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT_EXE=%ProgramFiles%\Git\cmd\git.exe"
if not defined GIT_EXE if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "GIT_EXE=%LocalAppData%\Programs\Git\cmd\git.exe"
if not defined GIT_EXE goto git_missing

"%GIT_EXE%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto repository_error

"%GIT_EXE%" add -A
if errorlevel 1 goto failed
"%GIT_EXE%" diff --cached --quiet
if errorlevel 2 goto failed
if not errorlevel 1 goto push_changes
"%GIT_EXE%" commit -m "auto commit"
if errorlevel 1 goto failed

:push_changes
"%GIT_EXE%" push
if errorlevel 1 goto failed
echo Commit and push completed successfully.
popd
pause
exit /b 0

:git_missing
echo Git was not found. Install Git for Windows and add it to PATH.
goto failed
:repository_error
echo This folder is not a Git repository. Place this script in the website repository.
goto failed
:directory_error
echo Cannot open the folder containing this script.
pause
exit /b 1
:failed
echo Commit or push failed. Please read the output above.
popd
pause
exit /b 1
