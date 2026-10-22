@echo off
rem Сборка KOMPAS Build в один .exe (Windows, Python 3.12 x64).
rem Результат: dist\KOMPAS-Build.exe — его кладут в ../dl/ (оттуда сайт добавляет его в архив «Скачать всё»).
cd /d "%~dp0"
py -3.12 -m pip install --upgrade pyinstaller pywin32 pillow || exit /b 1
py -3.12 -m PyInstaller --noconfirm --clean --onefile --windowed --name KOMPAS-Build --icon kp.ico --add-data "kp.ico;." ^
  --hidden-import win32com.client --hidden-import win32com.client.gencache --hidden-import pythoncom --hidden-import pywintypes ^
  --hidden-import win32api --hidden-import win32gui --hidden-import win32con --hidden-import PIL.ImageGrab ^
  --version-file version.txt kp_builder.py
