@echo off
chcp 65001 >nul

set "GIT_BASH_PATH=D:\Git\bin\bash.exe"
set "PROJECT_PATH=E:\github\DuneArrakis.github.io"

cd /d "%PROJECT_PATH%" || (
  echo Cannot enter project folder: "%PROJECT_PATH%"
  pause
  exit /b 1
)

"%GIT_BASH_PATH%" -lc "cd /e/github/DuneArrakis.github.io && git add -A && if git diff --cached --quiet; then echo No changes to commit.; else git commit -m 'auto commit' && git push; fi"

pause
