---
title: RTL, MSW и async в тестах компонентов
category: testing
level: middle
sources: tech-checks/common/testing.md T6, T7, T8, T9
---
## Что это
**Коротко:** Компоненты тестируют как пользователь: отрендерил, покликал, проверил, что появилось на экране. Инструменты: Testing Library (RTL) поверх Vitest или Jest для рендера и взаимодействия, MSW для моков API на уровне сети, fake timers и `findBy`/`waitFor` для асинхронщины. Мокаем границы (сеть, время), а не внутренности.

Схема теста: render → interaction → assert.
- Рендер через `render(<Component />)`, при необходимости с провайдерами (router, query client, store).
- Взаимодействие через `userEvent`: `type`, `click`, `selectOptions`. Он эмулирует реальную цепочку событий, включая фокус и keydown, в отличие от `fireEvent`.
- Ассерт на видимый результат: текст, роль, состояние кнопки. Не на state и не на вызовы внутренних функций.

**Mocking** это подмена зависимостей контролируемыми: API, модули, время, random. Опасность over-mocking: замокал всё, и тест проверяет моки, а не код. Тест зелёный, прод падает. Правило: мокать границы системы (сеть, таймеры, Date), а не свои же хуки и модули.

**MSW** (Mock Service Worker) перехватывает запросы на уровне сети: в тестах через Node-интерсептор, в браузере через service worker. Код делает реальные `fetch` или axios-запросы, тест не знает и не должен знать, что внутри. Бонус: одни и те же handlers для тестов, Storybook и dev-режима без бэкенда.

**Async**: debounce, таймеры, запросы. `vi.useFakeTimers()` плюс `vi.advanceTimersByTime(300)` для таймеров, `findByText` или `waitFor` для того, что появится после запроса. В Angular аналоги: `fakeAsync` и `tick`, `TestBed` и `HttpTestingController` вместо MSW.

## Пример
```tsx
// ❌ мок внутренностей: тест знает про хук и его форму данных
vi.mock("./useUsers", () => ({ useUsers: () => ({ data: [{ name: "Ann" }] }) }));

// ✅ мок на границе: MSW отвечает на реальный запрос
server.use(http.get("/api/users", () => HttpResponse.json([{ name: "Ann" }])));

render(<UserSearch />);
await user.type(screen.getByRole("searchbox"), "An");
vi.advanceTimersByTime(300);                       // debounce: двигаем время, а не ждём sleep
expect(await screen.findByText("Ann")).toBeInTheDocument();
```

## Подводные камни
- `getBy` для того, что появится асинхронно, упадёт сразу. Нужен `findBy` (ждёт до таймаута) или `waitFor`.
- Fake timers и `userEvent` вместе требуют настройки: `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, иначе `type` зависнет.
- `vi.mock` своего же модуля это сигнал: либо тестируешь не тот уровень, либо модуль плохо разделён.
- Async-тесты это место, где многие сдаются и «просто не тестируют поиск с debounce». На собесе это проверяют как упорство: знаешь ли, как подойти.
- Warning про `act(...)` обычно значит, что состояние обновилось после конца теста: не дождался `findBy` или не замокал запрос.

## Вопросы вдогонку
- **Чем MSW лучше `vi.mock('axios')` или `global.fetch = vi.fn()`?** Не трогает реализацию: поменял axios на fetch, тесты не изменились. И те же handlers работают в Storybook и dev.
- **`fireEvent` или `userEvent`?** `userEvent`: он проходит всю цепочку событий, как реальный браузер. `fireEvent` стреляет одним событием.
- **Как тестировать компонент с React Query?** Оборачивать в `QueryClientProvider` с `retry: false`, сеть мокать через MSW, ждать через `findBy`.
- **Как проверить, что запрос ушёл с нужными параметрами?** В handler MSW проверять URL и body, либо собирать вызовы в массив и ассертить его.
