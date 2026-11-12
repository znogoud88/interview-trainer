---
title: "Серверные данные: React Query/SWR, гонки запросов, optimistic updates"
category: react
level: middle
sources: tech-checks/frontend/react-angular-vue-next.md R8, R9; tech-checks/common/caching.md Q13; tech-checks/common/rest-api.md Q17
---
## Что это
**Коротко:** Серверные данные это кэш, а не state: они могут устареть, грузиться, падать и приходить не в том порядке. Голый `fetch` в `useEffect` даёт гонки, дубли запросов и ручной loading/error в каждом компоненте. React Query (TanStack Query) и SWR решают это одним слоем: ключ запроса, кэш, stale-while-revalidate, дедупликация, retry, инвалидация после мутации.

Как работает кэш React Query:
- **queryKey** это идентификатор данных: `['todos', { page: 2 }]`. Одинаковый ключ в двух компонентах = один запрос и одна запись в кэше (дедупликация).
- **staleTime**: сколько данные считаются свежими. Пока свежие, повторный `useQuery` просто отдаёт кэш. По умолчанию 0: новый mount или фокус окна делает refetch в фоне, а на экране сразу старое. Это и есть stale-while-revalidate на клиенте.
- **gcTime** (раньше `cacheTime`): сколько неиспользуемые данные живут в памяти после unmount последнего подписчика. По умолчанию 5 минут.
- **invalidateQueries(['todos'])** после мутации: пометить устаревшим и перезапросить всё, что начинается с этого ключа.
- Состояния UI: `isPending` (данных ещё нет), `isError`, `isFetching` (идёт фоновый запрос), и отдельно пустой результат. Показывать все, не только спиннер.

Гонка в поиске (R9): пользователь печатает «re», «rea», «react», ответы приходят в порядке «rea», «react», «re», и в списке результаты для «re». Фикс руками: AbortController в cleanup эффекта или флаг `ignore`, плюс debounce ввода. React Query решает сам: ключ `['search', query]` поменялся, старый запрос больше не привязан к текущему ключу, его ответ на экран не попадёт.

## Пример
```jsx
// optimistic update: UI меняем сразу, запрос в фоне, при ошибке откат
const qc = useQueryClient();
const toggle = useMutation({
  mutationFn: (todo) => api.patch(`/todos/${todo.id}`, { done: !todo.done }),
  onMutate: async (todo) => {
    await qc.cancelQueries({ queryKey: ["todos"] });   // чтобы идущий refetch не перетёр оптимистичное
    const prev = qc.getQueryData(["todos"]);
    qc.setQueryData(["todos"], old => old.map(t => t.id === todo.id ? { ...t, done: !t.done } : t));
    return { prev };
  },
  onError: (_e, _todo, ctx) => qc.setQueryData(["todos"], ctx.prev),   // откат
  onSettled: () => qc.invalidateQueries({ queryKey: ["todos"] }),       // в любом случае сверяемся с сервером
});
```

## Подводные камни
- `staleTime: 0` по умолчанию удивляет: «почему запрос улетает при каждом переключении вкладки?». Для справочников ставить минуты, для ленты секунды.
- Ключ должен содержать всё, от чего зависит ответ: фильтры, страницу, id пользователя. Забыл параметр в ключе, получил чужие данные из кэша.
- Optimistic update требует продуманного API: сервер возвращает обновлённую сущность, ошибки различимы (409 конфликт vs 500). И UI должен уметь показать откат, а не молча вернуть старое.
- Retry по умолчанию 3 раза с backoff, на мутациях выключен, и правильно: повторить не идемпотентный POST значит создать дубль.
- Красный флаг: «использую React Query, потому что все используют», без объяснения staleTime и ключей. R9 специально просит объяснить гонку руками.

## Вопросы вдогонку
- **В чём разница staleTime и gcTime?** staleTime: когда данные устарели и нужен refetch. gcTime: когда неиспользуемые данные выкинуть из памяти.
- **Как сделать debounce поиска с React Query?** Дебаунсить значение (`useDebounce`), в ключ класть уже дебаунснутое. `placeholderData: keepPreviousData`, чтобы список не мигал.
- **Зачем cancelQueries в onMutate?** Если в этот момент идёт refetch, его ответ перетрёт оптимистичное значение старым.
- **Нужен ли React Query с Server Components / Next.js?** Для первичной загрузки нет, данные приходят с сервера. Для клиентских мутаций, polling, infinite scroll всё ещё удобен, часто через `HydrationBoundary`.
