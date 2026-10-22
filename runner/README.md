# KOMPAS Build

Окно запуска макросов КОМПАС (10_parts.py … 50_snapshots.py) без установленного Python.
`kp_builder.py` собирается PyInstaller в один `KOMPAS-Build.exe` (Python 3.12 + pywin32 + Pillow + Tk внутри, ≈18 МБ).
Сайт берёт его из `../dl/KOMPAS-Build.exe` и кладёт в архив «Скачать всё» как `KOMPAS Build.exe`.

- Окно: этапы с отметками, ход, итог по каждому этапу (по строке «итог …» макроса), журнал; палитра «Журнал», светлая/тёмная — по теме Windows.
- «КОМПАС в фоне» (по умолчанию): макросы получают `KP_KOMPAS_VISIBLE=0` и ставят `app.Visible = False`. В конце `KOMPAS-Build.exe --kompas quit|restore` закрывает КОМПАС, запущенный построением, или снова показывает уже открытый.
- Каждый макрос идёт отдельным процессом того же .exe (`KOMPAS-Build.exe --run 10_parts.py`), поэтому сбой одного не роняет окно.
- Обёртки типов КОМПАС (gen_py) кэшируются в `%LOCALAPPDATA%\KOMPAS-Build\gen_py`.

Пересборка на Windows: `build.bat`, затем скопировать `dist\KOMPAS-Build.exe` в `../dl/` и поднять `BUILDER_VER` в `js/app.js`.
Без Windows: то же под Wine с Windows-сборкой Python (python-build-standalone).
