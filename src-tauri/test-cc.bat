@echo off
call "D:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
echo LIB=%LIB%
echo INCLUDE=%INCLUDE%
where cl.exe
