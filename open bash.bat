@echo off
rem 设置 Git Bash 的安装路径和项目所在目录
set "GIT_BASH_PATH=D:\Git\git-bash.exe"
set "PROJECT_PATH=E:\github\DuneArrakis.github.io"

rem 切换到项目目录
cd /d %PROJECT_PATH%

rem 按顺序执行命令：git add .; git commit -a -m "自动提交"; git push
%GIT_BASH_PATH% -c "git add .; git commit -a -m \"自动提交\"; git push"

pause
