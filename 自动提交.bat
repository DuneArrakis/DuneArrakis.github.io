@echo off

chcp 65001

set "GIT_BASH_PATH=D:\Git\git-bash.exe"
set "PROJECT_PATH=E:\github\DuneArrakis.github.io"

cd /d %PROJECT_PATH%

%GIT_BASH_PATH% -c "git add .; git commit -a -m \"自动提交\"; git push"

pause
