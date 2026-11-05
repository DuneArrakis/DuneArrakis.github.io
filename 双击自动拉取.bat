@echo off
setlocal DisableDelayedExpansion
rem Keep this script ASCII-only to avoid cmd.exe encoding issues.
title Pull latest website updates

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
"%GIT_EXE%" symbolic-ref --quiet HEAD >nul 2>&1
if errorlevel 1 goto branch_error
"%GIT_EXE%" rev-parse --abbrev-ref --symbolic-full-name "@{upstream}" >nul 2>&1
if errorlevel 1 goto upstream_error

echo Pulling updates for the current branch...
echo Git will stop if updates conflict with local changes.
echo.
"%GIT_EXE%" -c rebase.autoStash=false -c merge.autoStash=false pull --ff-only --no-rebase
if errorlevel 1 goto pull_error

echo.
echo Pull completed successfully.
popd
pause
exit /b 0

:git_missing
echo Git was not found. Install Git for Windows and add it to PATH.
goto failed
:repository_error
echo This folder is not a Git repository. Place this script in the website repository.
goto failed
:branch_error
echo No branch is checked out. Switch to the branch you want to update.
goto failed
:upstream_error
echo This branch has no upstream. Configure its upstream before pulling.
goto failed
:pull_error
echo.
echo Pull failed. Please read the Git output above.
echo For local conflicts, commit or save your changes first. Diverged branches need a manual merge.
echo For connection errors, check your network, remote URL and SSH configuration.
goto failed
:directory_error
echo Cannot open the folder containing this script.
pause
exit /b 1
:failed
popd
pause
exit /b 1
