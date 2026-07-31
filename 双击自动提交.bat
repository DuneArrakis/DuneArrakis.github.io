@echo off
chcp 65001 >nul

set "GIT_BASH_PATH=D:\Git\bin\bash.exe"

:: 自动取脚本所在目录作为项目路径
set "PROJECT_PATH=%~dp0"

cd /d "%PROJECT_PATH%" || (
    echo 无法进入目录: "%PROJECT_PATH%"
    pause
    exit /b 1
)

:: 路径转换
set "UNIX_PATH=%PROJECT_PATH:\=/%"
set "UNIX_PATH=%UNIX_PATH::=%"
set "UNIX_PATH=/%UNIX_PATH%"
:: 去掉末尾斜杠
if "%UNIX_PATH:~-1%"=="/" set "UNIX_PATH=%UNIX_PATH:~0,-1%"

echo 正在处理: %PROJECT_PATH%
"%GIT_BASH_PATH%" -lc "cd '%UNIX_PATH%' && git add -A && if git diff --cached --quiet; then echo No changes to commit.; else git commit -m 'auto commit' && git push; fi"

pause