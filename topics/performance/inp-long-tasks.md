---
title: INP, long tasks и длинные списки
category: performance
level: middle
sources: tech-checks/frontend/performance-core-web-vitals.md P3, P14, P13, P15; Interview Shit/Frontend/Performance/Core Web Vitals.md
---
## Что это
**Коротко:** Плохой INP почти всегда из-за long tasks: кусков работы на main thread дольше 50ms. Пока такой кусок идёт, браузер не может ни принять клик, ни перерисовать экран. Лечение по сути одно: делать меньше работы на одно взаимодействие и дробить то, что осталось, чтобы main thread успевал отдавать кадры. 10k строк в DOM это частный случай: рендерить их все не нужно, нужна виртуализация.

Три фазы взаимодействия, из которых складывается INP:
- **Input delay**: от нажатия до старта обработчика. Растёт, если main thread занят чем-то другим: long task от аналитики, рендер предыдущего действия.
- **Processing time**: сами обработчики. Тяжёлый `onClick`, синхронный setState с большим ререндером.
- **Presentation delay**: от конца обработчиков до следующего кадра. Растёт, если после обработки идёт огромный layout/paint (10k узлов) или тяжёлые эффекты.

Как дебажить: Performance panel, запись с взаимодействием, красные long tasks на main thread, flame chart показывает, кто именно. В поле: `web-vitals` с attribution, `onINP` отдаёт элемент и фазу.

Как лечить:
- Меньше JS на интеракцию: не пересчитывать всё, не рендерить невидимое, мемоизация там, где измерено.
- Разбить long task: срочное сразу (показать спиннер, подсветить кнопку), остальное после yield: `scheduler.yield()` (Chrome), `setTimeout(0)`, `requestIdleCallback`; в React `startTransition` / `useDeferredValue`.
- Совсем тяжёлое (парсинг, сортировка 100k, диффы) в Web Worker: main thread свободен, результат через `postMessage`.
- Длинный список: виртуализация (react-window, TanStack Virtual), рендерим 20-30 строк в viewport плюс буфер, остальное это заглушка нужной высоты. Или вообще не тащить 10k на клиент: пагинация, infinite scroll с сервера. DOM-узлы дорогие, тысячи строк никому не нужны одновременно.
- `requestAnimationFrame` против `setTimeout`: rAF вызывается перед следующим кадром, поэтому для анимаций и измерений DOM. `setTimeout` просто откладывает. Анимация на setTimeout дёргается, потому что не синхронизирована с частотой кадров.

## Пример
```js
// ❌ клик → синхронно фильтруем 50k записей → одна long task 400ms, спиннер так и не появится
function onSearch(q) { setLoading(true); setResult(heavyFilter(items, q)); setLoading(false); }

// ✅ срочное сразу, тяжёлое в transition: React рендерит прерываемо
function onSearch(q) {
  setQuery(q);
  startTransition(() => setResult(heavyFilter(items, q)));
}

// ✅ чанки без фреймворка: отдаём main thread между кусками
for (const chunk of chunks(rows, 500)) { process(chunk); await scheduler.yield(); }

// ✅ совсем тяжёлое в Worker
worker.postMessage({ items, q }); worker.onmessage = (e) => setResult(e.data);
```

## Подводные камни
- Debounce снижает число обработок, но не укорачивает саму задачу. Если один прогон 400ms, debounce INP не спасёт, нужно дробить или уносить в worker.
- У Worker нет DOM, данные копируются через structured clone; большие массивы лучше как Transferable (`ArrayBuffer`). Для мелких задач overhead больше пользы.
- Виртуализация ломает Ctrl+F и усложняет доступность, а строки переменной высоты требуют измерения. Это trade-off, называй его.
- `setTimeout(0)` реально ≥ 1ms, а после 5 уровней вложенности минимум 4ms; `scheduler.yield()` возвращает управление раньше других задач в очереди.
- Красный флаг: «обмажу useMemo». Интервьюер хочет фазы, потом «измерил, разбил, перемерил».

## Вопросы вдогонку
- **Почему именно 50ms?** Модель RAIL: реакция ощущается мгновенной до 100ms, задача до 50ms оставляет запас на input delay.
- **INP это худшее взаимодействие за визит?** Почти: для страниц с большим числом взаимодействий отбрасывается по одному выбросу на каждые 50.
- **Чем startTransition отличается от setTimeout?** React в transition рендерит прерываемо и выкидывает устаревший рендер; setTimeout откладывает задачу, но она всё равно блокирует целиком.
- **Как увидеть long tasks в проде?** `PerformanceObserver` с типом `longtask` или `long-animation-frame` (LoAF), web-vitals attribution для INP.
