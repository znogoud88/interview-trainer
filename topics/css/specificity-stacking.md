---
title: Специфичность, stacking context и z-index
category: css
level: middle
sources: tech-checks/frontend/styles.md St3, St17
---
## Что это
**Коротко:** Специфичность решает, какое из конфликтующих правил победит: id бьёт класс, класс бьёт тег, инлайн-стиль выше любого селектора, `!important` выше инлайна. Stacking context решает, кто над кем по оси z: z-index сравнивается только внутри одного контекста, поэтому `z-index: 9999` внутри элемента с `transform` никогда не вылезет над соседом с `z-index: 1`. Обе «войны» лечатся архитектурой, а не числами побольше.

Специфичность:
- Тройка (id, class/attribute/pseudo-class, tag/pseudo-element). `#a .b span` = (1,1,1), `.x.y.z` = (0,3,0), и (1,0,0) всё равно сильнее. `*` и `:where()` дают 0; `:is()`, `:not()`, `:has()` берут специфичность самого сильного аргумента.
- При равной специфичности побеждает то, что позже в коде.
- `!important` переворачивает порядок: среди important побеждает более специфичное. Поэтому `!important` это симптом: кто-то не смог перебить и ударил кувалдой, следующему придётся бить сильнее.
- `@layer`: каскадные слои. Правило из более позднего слоя побеждает независимо от специфичности. Типичный порядок: `@layer reset, base, components, utilities`. Стили вне слоёв сильнее любого слоя; для `!important` порядок слоёв инвертируется.
- Как не воевать: плоские селекторы (один класс), CSS Modules/scoped, BEM, `:where()` вокруг селекторов библиотеки, чтобы её легко перебивать, `@layer` для порядка.

Stacking context:
- Создают: корень документа, `position` + `z-index` не auto, `position: fixed/sticky`, `opacity < 1`, `transform`, `filter`, `will-change`, `isolation: isolate`, `contain: paint`, flex/grid-ребёнок с z-index не auto.
- Внутри контекста элементы сортируются по z-index, а сам контекст участвует в родительском как единое целое с z-index своего корня. Дочерний 9999 не обгонит то, что выше его родителя.
- Шкала слоёв в токенах: `--z-dropdown: 100; --z-sticky: 200; --z-modal: 300; --z-toast: 400`, с шагом, чтобы вставить между. Число не из шкалы это ревью-комментарий.
- Модалки и тосты рендерить через portal в `body`, чтобы не зависеть от контекста родителя. Или `<dialog>`/Popover API: они в top layer, выше всех контекстов.

## Пример
```css
/* ❌ почему модалка под хедером, хотя у неё 9999? */
.header { position: relative; z-index: 10; }
.card { transform: translateZ(0); }                 /* создал stacking context */
.card .modal { position: fixed; z-index: 9999; }    /* 9999 только внутри .card, а .card по z это auto, под header */

/* ✅ шкала + portal */
:root { --z-sticky: 200; --z-modal: 300; }
.header { position: sticky; z-index: var(--z-sticky); }
.modal  { position: fixed;  z-index: var(--z-modal); }   /* отрендерен в body */
```
```css
@layer reset, base, components, utilities;
@layer components { .btn { padding: 8px; } }
@layer utilities  { .p-0 { padding: 0; } }   /* победит при равной специфичности, потому что слой позже */
```

## Подводные камни
- `transform`, `opacity`, `filter`, `will-change` на анимированной карточке молча создают контекст, и всё, что внутри с z-index, запирается. Классика: дропдаун ушёл под соседа после добавления hover-анимации.
- `overflow: hidden` не про stacking, но обрезает выезжающие элементы, визуально похоже, лечится иначе.
- Чужую библиотеку с `#id .class` селекторами перебивать через `@layer` (положить её в низкий слой) или `:where()`, а не `!important`.
- Tailwind v4 строит порядок на нативных `@layer`, поэтому утилиты бьют компоненты предсказуемо.
- Красный флаг: «добавлю z-index побольше», «поставлю !important». Интервьюер ждёт слова stacking context и список, кто его создаёт.

## Вопросы вдогонку
- **Инлайн стиль против `!important` в CSS?** `!important` сильнее инлайна без important. Инлайн с important (`style.setProperty(name, value, 'important')`) сильнее всего.
- **Зачем `isolation: isolate`?** Создать контекст намеренно, без побочек transform: чтобы z-index детей не вытекал наружу.
- **Как отладить, кто над кем?** DevTools → Layers panel, и искать по предкам transform/opacity/filter/position.
- **Что такое top layer?** Слой браузера над всеми stacking contexts: `dialog.showModal()`, popover, fullscreen. z-index там не нужен.
