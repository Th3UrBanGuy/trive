@echo off
set "PORT=3000"
set "NODE_PATH=C:\Users\Diamond Technology\tectonic\node_modules;%~dp0node_modules"
node .\node_modules\next\dist\bin\next dev --webpack -p 3000
