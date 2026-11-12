---
title: Как браузер рисует страницу: reflow, repaint и композитинг
category: browser
level: middle
sources: tech-checks/frontend/performance-core-web-vitals.md Q14, Q15, Q16; tech-checks/frontend/styles.md Q13
---
## Что это
**Коротко:** Кадр браузер собирает по конвейеру: JS → style (кому какие CSS-правила) → layout (геометрия, размеры и позиции, это reflow) → paint (пиксели в слои, repaint) → composite (слои складываются, обычно на GPU). Чем раньше в конвейере ты что-то меняешь, тем больше шагов надо пересчитать. Изменил `width` или `top`: layout + paint + composite, дорого. Изменил `transform` или `opacity`: только composite, дёшево, и можно анимировать на 60 fps без участия main thread.

Шаги подробнее:
- **Style**: пересчёт, какие правила применяются к каким элементам. Дорожает от сложных селекторов и большого DOM.
- **Layout (reflow)**: расчёт геометрии. Самый дорогой шаг, потому что изменение одного элемента может сдвинуть всё вокруг. Триггерят `width`, `height`, `margin`, `padding`, `top/left`, `font-size`, добавление и удаление узлов.
- **Paint (repaint)**: заливка пикселей: цвет, фон, тени, бордеры. Дешевле layout, но тени и blur всё ещё дорого. Триггерят `color`, `background`, `box-shadow`, `visibility`.
- **Composite**: готовые слои накладываются друг на друга. `transform` и `opacity` на своём слое меняются без paint. Это делает compositor thread, даже если main thread занят.

Конвейер запускается перед кадром, примерно раз в 16.6 мс. `requestAnimationFrame` вызывается прямо перед style/layout, поэтому он синхронен с кадрами: анимации и измерения DOM делают там. `setTimeout` просто откладывает, с кадром не связан: анимация на нём дёргается, два вызова попадают в один кадр или ни одного.

Long task: любая работа на main thread дольше 50 мс. Пока она идёт, браузер не может дойти до рендера, кадры пропускаются, клик не обрабатывается. INP это ровно про это.

## Пример
```css
/* ❌ анимация left: каждый кадр layout + paint + composite */
.card { transition: left 300ms; }
.card:hover { left: 20px; }

/* ✅ transform: только composite, main thread не нужен */
.card { transition: transform 300ms; }
.card:hover { transform: translateX(20px); }
```

```js
// ❌ layout thrashing: чтение и запись геометрии вперемешку, layout на каждой итерации
items.forEach((el) => { el.style.width = el.offsetWidth + 10 + "px"; });

// ✅ сначала все чтения, потом все записи
const widths = items.map((el) => el.offsetWidth);
items.forEach((el, i) => { el.style.width = widths[i] + 10 + "px"; });

// ✅ анимация в кадр, а не по таймеру
function step(t) { el.style.transform = `translateX(${t / 10}px)`; requestAnimationFrame(step); }
requestAnimationFrame(step);
```

## Подводные камни
- Forced synchronous layout: чтение `offsetWidth`, `getBoundingClientRect`, `scrollTop` после записи стилей заставляет браузер посчитать layout прямо сейчас, вне кадра. В цикле это layout thrashing.
- `will-change: transform` выносит элемент на свой слой заранее. Точечно, на то, что реально анимируется. На всё подряд: сотни слоёв, память GPU, становится хуже.
- `opacity < 1`, `transform`, `filter` создают не только слой, но и stacking context. Отсюда внезапные проблемы с `z-index` и `position: fixed` внутри трансформированного родителя.
- `height: auto` не анимируется, а анимация `height` это reflow на каждый кадр. Варианты: `grid-template-rows: 0fr → 1fr`, `max-height`, `transform: scaleY` с оговорками.
- Как смотреть: DevTools Performance (flame chart, фиолетовый layout, зелёный paint, long tasks с красным уголком), Rendering → Paint flashing и Layer borders.
- Интервьюер хочет услышать порядок шагов, какое свойство какой шаг триггерит, и `transform/opacity` как ответ. Красный флаг: «`will-change` на всё», «анимирую через `setInterval`».

## Вопросы вдогонку
- **Почему `transform` дешевле `left`?** `left` меняет геометрию, значит layout и paint для элемента и соседей. `transform` применяется на этапе композитинга к готовому слою, пересчёта геометрии нет.
- **Чем rAF лучше setTimeout для анимации?** rAF вызывается один раз перед каждым кадром, в фоновой вкладке останавливается. setTimeout о кадрах не знает.
- **Что такое long task и как дробить?** Больше 50 мс на main thread. Чанки с `setTimeout`/`scheduler.yield()`, Web Worker, меньше JS на интеракцию, `startTransition` в React.
- **`display: none` vs `visibility: hidden` vs `opacity: 0`?** `display: none` это reflow (элемент выпадает из layout), `visibility: hidden` это paint, `opacity: 0` это только composite.
