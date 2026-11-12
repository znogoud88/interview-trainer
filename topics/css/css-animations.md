---
title: Анимации, reflow/repaint и sticky
category: css
level: middle
sources: tech-checks/frontend/styles.md St13, St14, St15, St19; tech-checks/frontend/performance-core-web-vitals.md P16
---
## Что это
**Коротко:** Браузер рисует страницу по pipeline: style → layout (геометрия) → paint (пиксели) → composite (сборка слоёв на GPU). Изменил `width` или `top`: пересчёт layout всего, что зависит (reflow), потом paint и composite. Изменил `color`: только repaint. Изменил `transform` или `opacity`: только composite, main thread не участвует. Поэтому плавные анимации это transform и opacity, а `will-change` точечно. Sticky это отдельная практическая тема: липнет в пределах родителя и ломается от `overflow` на предках.

Reflow vs repaint:
- **Reflow (layout)**: пересчёт размеров и позиций. Дорого, потому что каскадно: изменил ширину блока, пересчитались соседи и дети. Вызывают width/height/margin/padding/top/left, font-size, добавление и удаление DOM, а также чтение `offsetWidth`/`getBoundingClientRect` сразу после записи стилей (layout thrashing: браузер обязан пересчитать синхронно).
- **Repaint**: перерисовать пиксели без изменения геометрии: color, background, box-shadow, visibility. Дешевле, но тени и большие области всё равно стоят.
- **Composite**: слой уже нарисован, его двигает и прозрачит компоновщик на GPU. transform, opacity, частично filter. Работает, даже когда main thread занят JS.

Плавные анимации:
- Только `transform` и `opacity`. Сдвинуть: `translate`, не `left`. Раскрыть: `scale`, `clip-path`, или `grid-template-rows: 0fr → 1fr`, но не `height: auto` напрямую.
- `will-change: transform` заранее выносит элемент в свой слой. Точечно (модалка перед открытием, карточка при наведении), не на всё: каждый слой это память GPU, лишние слои сами тормозят.
- CSS против JS: CSS transitions/animations для простого (hover, появление, смена состояния), браузер гонит их off main thread. JS (WAAPI `element.animate`, Framer Motion, GSAP) для последовательностей, физики, прерываемых жестов, scroll-driven. JS-анимации через `requestAnimationFrame`, не setTimeout.
- `prefers-reduced-motion`: пользователь попросил меньше движения (укачивание, вестибулярные). Уважать: в `@media (prefers-reduced-motion: reduce)` отключать или заменять движение на fade. Это a11y, не «приятная мелочь».
- Из той же a11y-корзины: видимый фокус обязателен, `outline: none` без замены это бан; `:focus-visible` показывает outline только с клавиатуры. Контраст 4.5:1 для текста, тап-таргеты от 44px, `rem` для масштабирования, visually-hidden класс вместо `display: none` для текста скринридеру.

Sticky:
- `position: sticky; top: 0`: ведёт себя как relative, пока не доскроллили до порога, потом липнет, но только в пределах родителя: уехал родитель, уехал и он.
- Ломается: `overflow: hidden/auto/scroll` на любом предке (скролл-контейнером становится он, а не окно; `overflow: clip` не ломает), родитель той же высоты, что sticky-элемент (липнуть некуда), не задан `top`/`bottom`, во flex-родителе нужен `align-self: flex-start`. Sticky создаёт stacking context, помни про z-index.

## Пример
```css
/* ❌ layout на каждый кадр, дёргается на телефоне */
.drawer { left: -300px; transition: left .3s; }  .drawer.open { left: 0; }
/* ✅ только composite */
.drawer { transform: translateX(-100%); transition: transform .3s; }  .drawer.open { transform: none; }
@media (prefers-reduced-motion: reduce) { .drawer { transition: none; } }

:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.sidebar { position: sticky; top: 16px; align-self: flex-start; }   /* внутри flex-родителя */
```
```js
// ❌ layout thrashing: чтение после записи в цикле
items.forEach((el) => { el.style.width = el.offsetWidth + 10 + 'px'; });
// ✅ сначала все чтения, потом все записи
const widths = items.map((el) => el.offsetWidth);
items.forEach((el, i) => { el.style.width = widths[i] + 10 + 'px'; });
```

## Подводные камни
- `transform` и `opacity` создают stacking context: z-index дропдауна «сломался» после добавления hover-анимации.
- `will-change` на сотнях карточек или через `*`: GPU-память кончается, стало хуже. Ставить перед анимацией, снимать после.
- Анимация `box-shadow` на hover это repaint большой области на каждом кадре; лучше псевдоэлемент с готовой тенью и анимировать его `opacity`.
- Проверка: DevTools → Rendering → Paint flashing (зелёное = repaint), Layers panel, Performance panel с «Enable advanced paint instrumentation».
- Красный флаг: «анимирую через margin-left», `outline: none` «потому что некрасиво», не слышал про reduced-motion.

## Вопросы вдогонку
- **Что такое бюджет кадра?** 16.7ms при 60Hz (8.3ms на 120Hz): JS + style + layout + paint + composite должны уложиться, иначе jank.
- **Что такое layout thrashing?** Чередование записи стилей и чтения геометрии заставляет браузер синхронно пересчитывать layout на каждой итерации. Лечится группировкой чтений и записей.
- **Как анимировать height: auto?** `grid-template-rows: 0fr → 1fr` с `overflow: hidden` у ребёнка, `interpolate-size: allow-keywords` в свежих Chrome, или измерить в JS и анимировать transform/clip-path.
- **Чем sticky отличается от fixed?** Fixed всегда привязан к viewport и выпадает из потока; sticky остаётся в потоке и липнет, пока виден его родитель.
