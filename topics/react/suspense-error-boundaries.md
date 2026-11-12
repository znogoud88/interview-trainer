---
title: Suspense и Error Boundaries
category: react
level: middle
sources: tech-checks/frontend/react-angular-vue-next.md R14, R15
---
## Что это
**Коротко:** Suspense и Error Boundary это два декларативных способа обработать «ещё не готово» и «сломалось» для целого поддерева. Suspense показывает `fallback`, пока что-то внутри ждёт (lazy-компонент, данные через `use()` или интеграцию React Query/Next.js). Error Boundary ловит ошибку рендера в детях и показывает запасной UI вместо белого экрана. Ставятся по секциям: упал виджет, страница жива.

Suspense:
- `React.lazy(() => import('./Chart'))` + `<Suspense fallback={<Spinner />}>`: code splitting без ручного loading-state.
- Данные: компонент «бросает» промис, Suspense ловит и ждёт. Промис не создают в рендере, используют `use(promise)` с кэшированным промисом, `useSuspenseQuery` из React Query, или RSC/Next.js, где это из коробки.
- Streaming SSR (React 18+): сервер отдаёт HTML оболочки сразу, а содержимое Suspense-границ дольёт позже, когда будет готово. Пользователь не ждёт самый медленный запрос.
- Вложенные границы = разная гранулярность: страница целиком, потом каждый виджет отдельно.
- `useTransition`/`startTransition` при переходе не показывают fallback, а держат старый UI, пока новый готовится.

Error Boundary:
- Только class-компонент с `static getDerivedStateFromError` (что показать) и `componentDidCatch` (куда залогировать). Хука для этого нет, поэтому все берут `react-error-boundary` с `FallbackComponent` и `resetErrorBoundary`.
- Ловит: ошибки в рендере, в lifecycle и в конструкторах детей. Включая rejected промисы, на которых завис Suspense или `use()`.
- Не ловит: обработчики событий (обычный `try/catch`), асинхронный код (`setTimeout`, `fetch().then`), ошибки самой границы, ошибки на сервере при SSR.

## Пример
```jsx
<ErrorBoundary FallbackComponent={WidgetError} onError={logToSentry}>
  <Suspense fallback={<ChartSkeleton />}>
    <SalesChart />       {/* lazy + данные через useSuspenseQuery */}
  </Suspense>
</ErrorBoundary>
```
Порядок важен: Error Boundary снаружи, чтобы поймать и ошибку загрузки чанка, и ошибку данных. Один такой блок на каждый независимый виджет дашборда.

## Подводные камни
- Одна граница на всё приложение это то же самое, что белый экран, только с текстом. Границы по секциям, с кнопкой «повторить» (`resetErrorBoundary` + `invalidateQueries` или `resetKeys`).
- Ошибка в `onClick` не дойдёт до boundary. Если нужно показать fallback из обработчика, положи ошибку в state и брось её в рендере (`useErrorBoundary().showBoundary(e)` в `react-error-boundary`).
- `React.lazy` без Suspense выше по дереву упадёт с ошибкой: lazy всегда внутри Suspense.
- Waterfall: вложенные Suspense с запросами внутри каждого грузят последовательно. Запускать запросы выше (prefetch, loader), а Suspense использовать только для показа.
- В React 19 ошибки, пойманные границей, не перебрасываются второй раз в консоль, а идут в `onCaughtError`/`onUncaughtError` на `createRoot`: туда и вешать Sentry.
- Красный флаг: «Error Boundary ловит всё». Кто ставил в прод, перечислит miss-кейсы.

## Вопросы вдогонку
- **Почему Error Boundary нельзя написать хуком?** Нужен lifecycle `componentDidCatch`, у функциональных компонентов его аналога нет. Библиотека просто прячет класс.
- **Как Suspense знает, что компонент «ждёт»?** Компонент бросает промис (throw promise), React ловит его как сигнал особого типа, показывает fallback и ререндерит, когда промис резолвится.
- **Что показывать: спиннер или skeleton?** Skeleton того же размера, чтобы не было layout shift. И не мигать fallback на 50 мс: `useTransition` или минимальная задержка.
- **Как Suspense связан с React Query?** `useSuspenseQuery` вместо `useQuery`: нет `isPending`, данные всегда есть, загрузка и ошибки уходят в Suspense/Error Boundary.
