---
title: Токены, SCSS vs custom properties и dark mode
category: css
level: middle
sources: tech-checks/frontend/styles.md St2, St10, St11, St16
---
## Что это
**Коротко:** Дизайн-токены это именованные значения дизайна: `--color-primary`, `--space-m`, `--radius-s`. Компоненты знают только имена, а тема или бренд это другой набор значений. SCSS-переменные компилируются и исчезают, custom properties живут в браузере и меняются на лету, поэтому темизация и мультибренд это только custom properties. Dark mode это не «белое на чёрное», а семантические токены (background, surface, text) с двумя наборами значений и переключение через `prefers-color-scheme` плюс `data-theme`.

SCSS variables vs custom properties:
- `$primary` подставляется при сборке, в CSS остаётся литерал. Не знает про DOM, не каскадирует, не меняется в рантайме. Зато участвует в вычислениях на сборке: миксины, циклы, генерация утилит.
- `--primary` это свойство элемента: наследуется, каскадирует, переопределяется в любом селекторе и из JS (`el.style.setProperty`), читается через `getComputedStyle`. Переключается на лету, с `@property` даже анимируется.
- Практика: SCSS для структуры сборки (миксины, брейкпоинты), custom properties для всего, что может меняться: цвета, отступы, тема. Многие проекты уже обходятся без SCSS: нативный nesting, `@layer`, `color-mix()`.

Токены и мультибренд:
- Слои: примитивы (`--blue-500`) → семантические (`--color-primary: var(--blue-500)`, `--color-bg`, `--color-text-muted`) → компонентные (`--button-bg: var(--color-primary)`). Компоненты используют семантические или компонентные, никогда примитивы.
- Бренд = набор значений семантических токенов: `[data-brand="acme"] { --color-primary: ... }`. Код компонентов не меняется, форков нет. Источник правды: JSON (Style Dictionary, Tokens Studio в Figma), из него генерируются CSS, TS, iOS, Android.
- Библиотека компонентов: изоляция (модули/scoped), кастомизация через токены и переменные компонента (`--button-radius`), не через «перебей наш селектор»; варианты через пропсы, не глобальные классы; `:where()` на внутренних селекторах, чтобы потребитель переопределял без войны специфичности.

Dark mode:
- Семантические цвета: `--color-bg`, `--color-surface`, `--color-text`, `--color-border`. В тёмной теме surface светлее background (слои «приподнимаются»), а не наоборот.
- Источник: `@media (prefers-color-scheme: dark)` как дефолт плюс `[data-theme]` для ручного выбора с сохранением в localStorage/cookie. `color-scheme: light dark`, чтобы нативные контролы и скроллбары тоже потемнели.
- Детали практика: картинки с белым фоном, тени почти не видны (вместо них границы и яркость surface), контраст (чисто белый на чёрном режет, берут off-white), иллюстрации с вариантами через `<picture media="(prefers-color-scheme: dark)">`.
- Flash неправильной темы при SSR: инлайн-скрипт в `<head>` ставит `data-theme` до первой отрисовки, или тема в cookie и SSR сразу с атрибутом.

## Пример
```css
:root { --blue-500: #2563eb; --color-primary: var(--blue-500); --color-bg: #fff; --color-surface: #f6f6f6; --color-text: #111; color-scheme: light; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --color-bg: #111; --color-surface: #1c1c1c; --color-text: #eee; color-scheme: dark; }
}
:root[data-theme="dark"] { --color-bg: #111; --color-surface: #1c1c1c; --color-text: #eee; color-scheme: dark; }
[data-brand="acme"] { --color-primary: #e11d48; }

.card { background: var(--color-surface); color: var(--color-text); }   /* не знает ни про тему, ни про бренд */
```
```scss
// ❌ $primary исчезнет после сборки, переключить тему без пересборки нельзя
.card { background: darken($primary, 10%); }
// ✅ то же в рантайме
.card { background: color-mix(in srgb, var(--color-primary), black 10%); }
```

## Подводные камни
- Компонент с примитивом `--blue-500` внутри при смене бренда не перекрасится. Правило: в компонентах только семантические токены.
- Токен `--color-white`, который в тёмной теме чёрный: имя врёт. Называть по роли, не по значению.
- Темизация на SCSS: либо два CSS-бандла, либо дублирование каждого селектора под `.dark`. Работает, но переключение на лету всё равно упирается в custom properties.
- Custom properties не работают в условиях media query и внутри `url()`; для брейкпоинтов остаются SCSS или `@custom-media` через PostCSS.
- Красный флаг: «SCSS-переменные и CSS-переменные это одно и то же». По заметке это практический детектор понимания.

## Вопросы вдогонку
- **Можно ли анимировать custom property?** По умолчанию нет, меняется скачком. С `@property` и объявленным типом (`<color>`, `<length>`) да.
- **Как переключать тему без flash при SSR?** Инлайн-скрипт в head читает localStorage и ставит `data-theme` до рендера, или тема в cookie и сервер рендерит сразу с атрибутом.
- **Что такое `color-scheme`?** Подсказка браузеру, какие UA-стили брать для форм, скроллбаров, системных цветов. `light dark` разрешает оба.
- **Как хранить токены для веба и мобилок?** JSON по формату W3C Design Tokens, Style Dictionary генерирует CSS, TS, Swift, Kotlin из одного источника.
