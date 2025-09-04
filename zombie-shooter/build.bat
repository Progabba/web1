@echo off
setlocal
echo Installing dependencies...
call npm install || goto :error
echo Running Windows build...
call npm run dist:win || goto :error
echo.
echo Build finished. Check the dist folder.
exit /b 0

:error
echo.
echo Build failed. See the log above.
exit /b 1
