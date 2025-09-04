# Zombie Survival Shooter

Мини-игра в браузере (HTML5 Canvas): стрелялка с зомби в топ-даун виде.

Управление:

- WASD/стрелки: движение
- Мышь: прицеливание
- ЛКМ: стрельба
- Enter: перезапуск после поражения

Запуск в браузере:

1. Откройте `index.html` в браузере, или
2. Поднимите простой сервер из корня проекта:

```bash
python3 -m http.server 8000 --directory ./
```

Затем перейдите в браузере по адресу `http://localhost:8000/zombie-shooter/` и откройте `index.html`.

Игра не использует внешние ассеты и работает целиком на Canvas и JavaScript.

## Windows (.exe) через Electron

Сборка простого .exe (установщик) выполняется через Electron Builder.

Шаги (Windows 10/11):

1. Установите Node.js LTS (включите «Automatically install necessary tools» если предложит).
2. Откройте терминал PowerShell или CMD.
3. Перейдите в папку проекта:

```bash
cd path\to\zombie-shooter
```

4. Установите зависимости:

```bash
npm install
```

5. Локальный запуск десктоп-версии для проверки:

```bash
npm start
```

6. Сборка Windows-установщика (.exe):

```bash
npm run dist:win
```

Готовый инсталлятор появится в папке `dist/`. По умолчанию используется цель `nsis` и иконка из `build/icon.ico` (замените файл на свою иконку при желании).

### Вариант: GitHub Actions (получить .exe как артефакт)

1. Залей проект в GitHub (репозиторий приватный или публичный).
2. Вкладка Actions → выбери "Build Windows EXE" → Run workflow.
3. По завершении скачай артефакт `Zombie-Shooter-Windows-Installer` — внутри будет `.exe`.
