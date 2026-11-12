---
title: Что нового в React 18 и 19
category: react
level: middle
sources: tech-checks/frontend/react-angular-vue-next.md R16
---
## Что это
**Коротко:** React 18 (2022) принёс concurrent rendering: `createRoot`, автоматический батчинг везде, `useTransition`/`useDeferredValue`, streaming SSR с Suspense. React 19 (декабрь 2024) добавил Actions для мутаций и форм, хук `use()`, `useOptimistic`, `ref` как обычный prop, и стал базой для React Compiler. Интервьюер спрашивает не список, а что из этого ты реально применял.

React 18:
- **Automatic batching**: несколько `setState` в одном тике = один ререндер, теперь и в промисах, таймерах, нативных обработчиках, а не только в React-событиях.
- **useTransition / startTransition**: пометить обновление как несрочное. Ввод в поле срочный, фильтрация списка на 10 000 строк в transition: React прервёт её ради следующего нажатия клавиши. `isPending` для индикатора.
- **useDeferredValue**: то же для значения, которое не ты обновляешь (prop).
- **Streaming SSR + Suspense**: `renderToPipeableStream`, HTML приходит частями, selective hydration: где пользователь кликнул, то гидрируется первым.
- **useId**, **useSyncExternalStore** (для внешних сторов без tearing), StrictMode с двойным mount.

React 19:
- **Actions**: асинхронная функция в `<form action={fn}>` или в `startTransition`. React сам ведёт pending, ошибки, сброс формы. Рядом `useActionState` (state + pending + результат) и `useFormStatus` (pending для кнопки внутри формы).
- **use(promise | context)**: читать промис или контекст прямо в рендере, можно условно и в циклах, в отличие от других хуков. Промис должен быть кэширован, не создаваться в рендере.
- **useOptimistic**: показать ожидаемое значение, пока action в полёте, автоматически откатить при ошибке.
- **ref как prop**: `forwardRef` больше не нужен. `<Context>` вместо `<Context.Provider>`. Cleanup-функция из ref-колбэка.
- **Document metadata**: `<title>`, `<meta>` рендерятся из любого компонента и поднимаются в `<head>`. Прелоад ресурсов через `preload`/`preinit`.
- **Server Components и Server Actions** стабильны как платформа для фреймворков (Next.js App Router).
- **React Compiler** 1.0 (октябрь 2025) ставится отдельно, авто-мемоизация. 19.2 (октябрь 2025) добавил `<Activity>` (скрыть поддерево с сохранением state), `useEffectEvent`, `cacheSignal`.

## Пример
```jsx
// React 19: форма без ручного loading/error state
async function addTodo(prev, formData) {
  const res = await api.post("/todos", { title: formData.get("title") });
  return res.ok ? null : "Не удалось сохранить";
}
function TodoForm() {
  const [error, submit, pending] = useActionState(addTodo, null);
  return (
    <form action={submit}>
      <input name="title" />
      <button disabled={pending}>Добавить</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

## Подводные камни
- Переход на 18 требует `createRoot`, иначе всё работает в legacy-режиме и новых фич нет. Классический «обновили, но ничего не изменилось».
- `useTransition` не ускоряет вычисление, он делает его прерываемым. Тяжёлая синхронная функция внутри всё равно тяжёлая.
- Actions это не замена React Query: нет кэша и инвалидации. В приложении с кэшем запросов они дополняют друг друга.
- Из 19 убрали `propTypes`, `defaultProps` для функций, string refs, legacy context. Старые библиотеки могут сломаться.
- Красный флаг: назвал фичи по списку, но не может сказать, где `useTransition` помог бы в его проекте.

## Вопросы вдогонку
- **Что такое concurrent rendering одной фразой?** React может прервать рендер, отдать браузеру кадр и продолжить или начать заново с более срочным обновлением. Fiber это делает возможным.
- **useTransition или useDeferredValue?** Transition, когда ты вызываешь setState сам. Deferred, когда значение приходит снаружи (prop) и ты его не контролируешь.
- **Чем use() отличается от useContext?** Для контекста результат тот же, но вызывать можно условно и после early return. Плюс читает промисы.
- **Что такое selective hydration?** Гидрация по Suspense-границам в порядке приоритета: там, где пользователь кликнул, оживает первым.
