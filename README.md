# Gleuderoff — редактор мира

Настольная программа (Windows) для лора D&D-мира Gleuderoff: интерактивная карта, государства, таймлайн и справочник.

## Установка
`release/Gleuderoff-Setup-0.1.0.exe` — обычный установщик. Создаёт ярлык на рабочем столе.

Данные мира хранятся в `Документы\Gleuderoff\worlds\gleuderoff\`:
- `world.json` — весь лор;
- `assets\` — флаги, портреты, карты городов;
- `backups\` — копия при каждом запуске (последние 40).

## Разработка
```
npm install
npm run dev        # запуск в режиме разработки
npm run dist       # собрать установщик в release/
```

Сборка стартового мира (resources/default-world) — по порядку:
1. `node --max-old-space-size=8192 scripts/import-psd.mjs` — страны и их подписи из `source-maps/political.psd`;
2. `node scripts/seed-lore.mjs` — лор из `scripts/lore/*.mjs` и `source-lore/*.md` (боги, расы, Монстарги, государства, география);
3. `node --max-old-space-size=8192 scripts/provinces.mjs` — тысячи провинций: местность, иерархия (континент → регион → область → провинция), культуры, имена;
4. `node --max-old-space-size=8192 scripts/smooth-provinces.mjs` — плавные границы провинций, закрытие щелей от линий PSD, соседи;
5. `node --max-old-space-size=8192 scripts/terrain.mjs` — маска рек и поселения провинций (деревни, города, порты, замки…);
6. `node scripts/history-provinces.mjs` — постепенная история владения: завоевания Тейбера, восстания, Лесная война, распад 975–980; великие дома за регионами; места битв;
6а. `node scripts/empire-detail.mjs` — описания поселений Империи, низшая знать округов, гнёзда домов, кастры легионов, Аурхафен;
7. `node --max-old-space-size=8192 scripts/roads.mjs` — дороги между поселениями: мощёные тракты, грунтовки, горные тропы (`source-maps/roads.json`);
8. `node --max-old-space-size=14000 scripts/render-map.mjs` — новая подложка 32768×18688: рельеф со светотенью и тенями гор, кроны деревьев, пашни, дороги, скалы и снега, барханы, реки, мелководье (≈3 мин);
9. `node --max-old-space-size=12000 scripts/make-tiles.mjs` — плитки 1024 px, уровни z −4…2.

Версия для телефона: `npm run build:web` → папка `out-web` (плитки до z=1), публикуется закрытой страницей на claude.ai.

Подробный план карты — [MAP_PLAN.md](MAP_PLAN.md).

Подложка: Real-ESRGAN (`tools/realesrgan`, не в git) увеличивает `source-maps/base-4096.png` в 4 раза, затем `node scripts/make-tiles.mjs` режет плитки.

Если стартовый мир меняется — поднимите `version` в `seed-lore.mjs` и допишите шаг в `migrateWorld` (src/main/index.ts), чтобы обновить миры пользователей без потери их правок.
