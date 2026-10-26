@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
title 拉取网站最新内容

pushd "%~dp0"
if errorlevel 1 goto directory_error

rem 优先使用 PATH 中的 Git，再查找常见安装位置。
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

echo 正在拉取当前分支对应的远端更新……
echo 本地修改如与远端冲突，Git 会停止更新，请按提示处理。
echo.
"%GIT_EXE%" -c rebase.autoStash=false -c merge.autoStash=false pull --ff-only --no-rebase
if errorlevel 1 goto pull_error

echo.
echo 拉取完成，已同步远端更新。
popd
pause
exit /b 0

:git_missing
echo 未找到 Git，请安装 Git for Windows，并将 Git 加入 PATH。
goto failed
:repository_error
echo 脚本所在目录不是 Git 仓库，请将脚本放在网站仓库中。
goto failed
:branch_error
echo 当前没有检出分支，请先切换到需要更新的分支。
goto failed
:upstream_error
echo 当前分支没有关联远端分支，请先配置上游分支后再拉取。
goto failed
:pull_error
echo.
echo 拉取未完成，请查看上方 Git 提示。
echo 若提示本地修改冲突，请先提交或妥善保存修改；分支分叉需手动合并。
echo 若连接失败，请检查网络、远端地址及 SSH 登录配置后重试。
goto failed
:directory_error
echo 无法进入脚本所在目录。
pause
exit /b 1
:failed
popd
pause
exit /b 1
