---
title: Бандл 3 МБ: code splitting, tree shaking, analyzer
category: performance
level: middle
sources: tech-checks/frontend/performance-core-web-vitals.md P7; Interview Shit/Frontend/Performance/Core Web Vitals.md
---
## Что это
**Коротко:** Бандл 3 МБ это не «оптимизировать всё», а сначала измерить: открыть bundle analyzer и посмотреть, кто жирный. Дальше три рычага: code splitting (не грузить то, что не нужно этой странице), tree shaking (не тащить неиспользуемое), замена и удаление библиотек. После каждого шага мерить снова: 3 МБ обычно это две-три конкретные причины, а не тысяча мелких.

Процесс:
1. **Измерить**: `webpack-bundle-analyzer`, `rollup-plugin-visualizer` для Vite, `source-map-explorer`, `@next/bundle-analyzer`. Treemap сразу показывает классику: moment со всеми локалями, lodash целиком, две версии одной либы, все иконки сразу, редактор или PDF-вьюер в main chunk.
2. **Code splitting**: по роутам (`lazy` на страницах), по тяжёлым фичам (`import()` редактора при открытии, модалки, чартов). Цель: маленький initial chunk, остальное догружается по требованию.
3. **Tree shaking**: бандлер выкидывает неиспользуемые экспорты, но только у ESM и только если пакет помечен `"sideEffects": false` или бандлер уверен, что модуль чистый. `import _ from 'lodash'` тянет весь lodash (это CommonJS), `import debounce from 'lodash-es/debounce'` только его.
4. **Замена**: `moment` (с локалями около 300 КБ) на `dayjs` (около 2 КБ) или `date-fns`; `lodash` на нативные методы; тяжёлые UI-либы на точечные импорты.
5. **Barrel-файлы**: `index.ts`, который реэкспортит 200 компонентов. Импорт одной кнопки заставляет бандлер разобрать весь индекс, а если где-то есть side effects, tree shaking их не выкинет. Решение: импорт из конкретных файлов, в Next `optimizePackageImports`.

Ещё проверить: дубли зависимостей (`npm ls`, dedupe), polyfills под IE из-за старого browserslist, source maps в проде, картинки и шрифты, зашитые в JS через base64.

## Пример
```js
// ❌ всё в initial chunk
import moment from 'moment';
import _ from 'lodash';
import { Button } from '@/components';          // barrel с 200 реэкспортами
import PdfViewer from './PdfViewer';            // 800 КБ, нужен 2% пользователей

// ✅
import dayjs from 'dayjs';
import debounce from 'lodash-es/debounce';
import { Button } from '@/components/Button';
const PdfViewer = lazy(() => import('./PdfViewer'));   // отдельный chunk по требованию
```
Как понять, tree-shake-ится ли библиотека: в её `package.json` есть `"module"` или `exports` на ESM и `"sideEffects": false`. Если только `main` на CJS, бандлер возьмёт всё.

## Подводные камни
- Gzip/brotli это про сеть, парсинг и выполнение идут по raw-размеру. Телефон за 100 долларов на 3 МБ JS тратит секунды CPU независимо от сжатия.
- Code splitting сверх меры: 200 чанков по 5 КБ и waterfall запросов. Группируй, prefetch следующего роута.
- `lazy` без `Suspense`/fallback даёт пустой экран и CLS; `lazy` на компоненте из первого экрана ухудшает LCP.
- `import { x } from 'lib'` не гарантирует tree shaking: если `lib` на CJS или с side effects, прилетит всё. Analyzer покажет.
- Красный флаг: «включу минификацию и gzip». Это и так включено. Интервьюер ждёт «измерить → срезать → проверить» и знание, что барелы и CJS мешают.

## Вопросы вдогонку
- **Как не дать бандлу вырасти обратно?** `size-limit` или `bundlesize` в CI, бюджет на чанки, сборка красная при превышении.
- **Что такое side effects для tree shaking?** Код, который выполняется при импорте: полифил, `import './styles.css'`, регистрация. Бандлер не выкинет модуль, если не уверен, что он чистый.
- **Vite/Rollup против webpack здесь?** Rollup агрессивнее tree-shake-ит, но правила те же: ESM и `sideEffects`.
- **Почему barrel-файлы ещё и замедляют сборку и dev-сервер?** Бандлер обязан разобрать все реэкспортированные модули, даже если возьмёт один.
