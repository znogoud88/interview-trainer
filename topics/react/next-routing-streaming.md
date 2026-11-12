---
title: Файловый роутинг, loading/error, streaming и PPR
category: react
level: middle
sources: tech-checks/frontend/react-angular-vue-next.md Next N11, N13, N19
---
## Что это
**Коротко:** В App Router маршрут это папка в `app/`, а файлы с фиксированными именами внутри неё описывают, что рендерить: `page.tsx` сама страница, `layout.tsx` обёртка, которая не перерендеривается при навигации внутри, `loading.tsx` и `error.tsx` автоматические Suspense и Error Boundary на сегмент. Streaming это когда сервер отдаёт HTML частями: оболочка сразу, медленные куски дольются, когда дорендерятся. PPR (Partial Prerendering) идёт дальше: статическая оболочка берётся из кеша, динамические дырки стримятся, и всё это в одном ответе.

Роутинг:
- `[slug]` динамический сегмент, `[...slug]` catch-all, `[[...slug]]` опциональный catch-all. В Next 15 `params` и `searchParams` это Promise, читать через `await`.
- `(marketing)` route group: папка для организации и своих layout, в URL не попадает. `@modal` parallel routes и `(.)photo` intercepting routes для модалок с собственным URL.
- `generateStaticParams` в динамическом сегменте: список значений для пререндера на билде. Остальные значения рендерятся на лету и кешируются, если `dynamicParams` не выключен.
- `layout.tsx` сохраняет state и не перемонтируется при переходе между дочерними страницами. Если нужно перемонтировать (анимация входа, сброс формы), есть `template.tsx`.

Загрузка и ошибки:
- `loading.tsx` рядом с `page.tsx` = `<Suspense fallback={<Loading/>}>` вокруг страницы. Навигация становится мгновенной: показали скелетон, страница стримится следом.
- `error.tsx` это client component с пропсами `error` и `reset()`. Ловит ошибки рендера своего сегмента и детей, но не своего `layout.tsx` на том же уровне: для него нужен `error.tsx` родителя, а для корневого layout `global-error.tsx`.
- `not-found.tsx` плюс `notFound()` из кода, когда сущности нет.

## Пример
```tsx
// app/products/[id]/page.tsx
export default async function Page({ params }) {
  const { id } = await params;
  const product = await getProduct(id);          // быстрый запрос, ждём в самой странице
  return (
    <>
      <ProductHeader product={product} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews id={id} />                       {/* медленный внешний API: стримится отдельно */}
      </Suspense>
      <Suspense fallback={<RecsSkeleton />}>
        <Recommendations userId={id} />           {/* читает cookies, динамический кусок для PPR */}
      </Suspense>
    </>
  );
}
```

Без Suspense TTFB страницы равен самому медленному из трёх запросов. С Suspense пользователь видит заголовок и цену сразу, отзывы приедут через секунду, и Google видит то же самое, потому что это один HTTP-ответ, просто чанками.

## Подводные камни
- `loading.tsx` на весь сегмент это грубо: один медленный виджет держит скелетон на всей странице. Точечные `<Suspense>` вокруг медленного лучше, `loading.tsx` оставить как сетку-заглушку.
- Streaming требует, чтобы между Next и браузером никто не буферизовал ответ: nginx с `proxy_buffering on`, некоторые CDN и WAF ломают его, страница приходит целиком в конце.
- `error.tsx` не ловит ошибки в обработчиках событий и в async-коде вне рендера, как любой Error Boundary. И ошибку в Server Action тоже нужно обрабатывать руками.
- PPR в Next 15 был experimental, в Next 16 это часть Cache Components (`cacheComponents: true` в конфиге): статичное кешируется через `use cache`, всё, что читает запрос, должно быть под Suspense, иначе билд ругается. Это сдвиг от «маршрут либо статический, либо динамический» к «статика и динамика в одном ответе».
- Красный флаг: «сделал всю страницу dynamic, чтобы не разбираться с Suspense». Потерян кеш и TTFB.

## Вопросы вдогонку
- **Чем layout отличается от template?** Layout живёт при навигации между детьми, сохраняет state. Template создаёт новый инстанс на каждый переход.
- **Зачем generateStaticParams, если ISR и так закеширует при первом запросе?** Чтобы первый пользователь не ждал рендер и чтобы популярные страницы были готовы к моменту деплоя.
- **Как показать ошибку одного виджета, не роняя страницу?** Свой Error Boundary (client component) вокруг виджета внутри Suspense. `error.tsx` для этого слишком крупный.
- **Что видит поисковик при streaming?** Полный HTML, как и браузер: чанки склеиваются в один документ. Suspense fallback в итоговом DOM заменяется контентом инлайн-скриптом.
