---
title: Flex vs Grid, responsive и container queries
category: css
level: junior
sources: tech-checks/frontend/styles.md St4, St5, St18, St6
---
## Что это
**Коротко:** Flex это раскладка по одной оси: ряд или колонка, распределить и выровнять. Grid это двумерная раскладка: строки и колонки сразу, области. Они не конкуренты: grid для каркаса страницы и сеток карточек, flex для навбаров, кнопок в ряд, выравнивания внутри ячейки. Responsive: mobile-first, относительные единицы, `clamp()` и container queries вместо десятка брейкпоинтов.

Flex vs Grid:
- **Flex**: контент диктует размер, элементы «текут». `justify-content`, `align-items`, `gap`, `flex: 1`. Навбар, группа кнопок, иконка + текст, центрирование.
- **Grid**: контейнер диктует сетку. `repeat(auto-fill, minmax(250px, 1fr))` даёт адаптивную сетку карточек без медиазапросов. `grid-template-areas` для «header / sidebar main / footer». Выравнивание по обеим осям сразу.
- Вместе, не вместо: grid-каркас, внутри ячеек flex.

Responsive:
- **Mobile-first**: базовые стили для узкого экрана, `@media (min-width: ...)` добавляет. На мобилке меньше переопределений, и ты вынужден думать о приоритете контента.
- **Единицы**: `rem` для текста и отступов (уважает настройки пользователя), `%`/`fr`/`minmax` для раскладки, `px` для бордеров. `vh` на мобилке осторожно.
- **`clamp(min, preferred, max)`** для типографики: `font-size: clamp(1rem, 0.5rem + 2vw, 2rem)` плавно, без брейкпоинтов.
- **Брейкпоинты** по контенту (где layout ломается), не по моделям телефонов. Их должно быть мало.
- **Container queries**: компонент подстраивается под ширину своего контейнера, а не окна. Родитель `container-type: inline-size`, в компоненте `@container (min-width: 400px)`. Один и тот же Card в сайдбаре вертикальный, в основной зоне горизонтальный, без пропсов и без знания о странице. Во всех современных браузерах с 2023.

## Пример
```css
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }

.card-wrap { container-type: inline-size; }
.card { display: flex; flex-direction: column; }
@container (min-width: 400px) { .card { flex-direction: row; } }

h1 { font-size: clamp(1.5rem, 1rem + 2.5vw, 3rem); }
```
Layout ломается только в Safari. Процесс: изолировать свойство (отключать по одному в DevTools, минимальный репро), caniuse / MDN compat, фикс или fallback через `@supports`. Классика:
- `100vh` на iOS: viewport считается с учётом скрытой адресной строки, низ страницы уезжает за экран. Лечение: `100dvh`, или `min-height: 100vh` плюс `-webkit-fill-available`, или JS.
- `position: sticky` внутри flex-контейнера: ребёнок растянут на высоту родителя (`align-self: stretch`) и ему некуда липнуть. Нужен `align-self: flex-start`.
- Flex-баги старых Safari: `gap` в flex появился поздно, `height: 100%` у flex-ребёнка, картинки растягиваются в flex без `min-width: 0`/`align-self`.
- Нативные контролы (`input[type=date]`), скролл-баунс, `-webkit-backdrop-filter`.

## Подводные камни
- Grid для всего, включая кнопку с иконкой: overkill. Flex для сетки одинаковых карточек: считать проценты и воевать с последним рядом.
- Desktop-first с `max-width`: мобилка сначала получает десктопные стили, потом их переопределяют. Больше CSS, легче сломать.
- `px` в font-size ломает масштабирование текста в настройках браузера, это a11y-претензия.
- Container queries не работают без `container-type` на родителе, и элемент не может измерять сам себя, только предка.
- Красный флаг: «flex устарел, всё на grid» или «брейкпоинты 320/768/1024 всегда». Интервьюер ждёт «вместе, не вместо» и выбор по задаче.

## Вопросы вдогонку
- **Как отцентрировать div?** `display: grid; place-items: center` или flex с `justify-content` и `align-items` по center. Старые хаки с `margin: auto` и `transform` знать, но не предлагать первыми.
- **Чем `auto-fill` отличается от `auto-fit`?** `auto-fit` схлопывает пустые треки и растягивает элементы, `auto-fill` оставляет пустые колонки.
- **Что такое `dvh`, `svh`, `lvh`?** Dynamic / small / large viewport height, учитывают появление и скрытие панелей браузера на мобилке.
- **Чем container query отличается от media query?** Media смотрит на окно, container на ближайшего предка с `container-type`. Компонент переиспользуется независимо от места.
