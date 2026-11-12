---
title: "Слои кэша в App Router: цена обновилась, а сайт показывает старую"
category: react
level: senior
sources: tech-checks/frontend/react-angular-vue-next.md Next N5-N10; tech-checks/common/caching.md Q5, Q9
---
## Что это
**Коротко:** В App Router четыре независимых кэша, и у каждого своя инвалидация. На сервере: Request memoization (один fetch на рендер), Data Cache (результаты fetch между запросами) и Full Route Cache (готовый HTML + RSC payload статических маршрутов). На клиенте: Router Cache (RSC payload посещённых и prefetched сегментов в памяти вкладки). «Обновил в админке, сайт показывает старое» это вопрос «в каком из четырёх слоёв застряло», и ответ «поставлю no-store везде» это не ответ.

Слои по порядку:
- **Request memoization**: одинаковые `fetch(url)` или вызовы через React `cache()` в одном рендере дедуплицируются. Живёт один запрос, нужен чтобы layout и page могли спокойно дёргать одну функцию. Инвалидировать нечего.
- **Data Cache**: результат `fetch` на сервере, переживает запросы и деплой. В Next 15 по умолчанию выключен (`fetch` ведёт себя как `no-store`), включается явно: `cache: 'force-cache'` или `next: { revalidate: 60, tags: ['product-123'] }`. Сбрасывается `revalidateTag` / `revalidatePath` или по таймеру.
- **Full Route Cache**: если маршрут статический, HTML и payload собираются на билде (или при первом ISR-запросе) и лежат на сервере. Сбрасывается деплоем и ревалидацией данных, из которых собран.
- **Router Cache**: браузер хранит payload сегментов, чтобы навигация назад и prefetch были мгновенными. В Next 15 динамические сегменты по умолчанию не переиспользуются (`staleTime` 0), статические живут 5 минут. Чистится `router.refresh()`, `revalidatePath/Tag` из Server Action, а также `cookies.set` в action.

ISR это и есть stale-while-revalidate: после истечения `revalidate` первый запрос получает старую страницу мгновенно, свежая собирается в фоне, следующий получает новую. Паттерн не эксклюзив Next: тот же `Cache-Control: s-maxage=60, stale-while-revalidate=600` на CDN, тот же `staleTime` в React Query, то же можно собрать на Redis с фоновой пересборкой.

## Пример
Цена обновилась в админке, на сайте старая. Идём по слоям:
1. **Data Cache**: fetch цены закеширован с `revalidate: 3600`, а вебхук из админки не вызывает `revalidateTag('product-123')`. Самая частая причина.
2. **Full Route Cache**: страница статическая, собрана на билде, данные читаются не через fetch (ORM), и Next не знает, что их надо обновить. Нужен `revalidatePath('/products/123')` или `unstable_cache` / `use cache` с тегом.
3. **Router Cache**: ревалидация сработала, но пользователь уже был на странице, и его вкладка показывает payload из памяти. Лечится `router.refresh()` или тем, что ревалидацию вызывают из Server Action, а не из Route Handler: Route Handler не знает, у какого клиента что лежит.
4. **CDN / браузер**: Next всё отдал свежее, а перед ним Cloudflare с `s-maxage` на HTML. Purge по URL или surrogate key.

```ts
// Вебхук из админки: app/api/revalidate/route.ts
export async function POST(req: Request) {
  if (req.headers.get("x-secret") !== process.env.REVALIDATE_SECRET) return new Response(null, { status: 401 });
  const { productId } = await req.json();
  revalidateTag(`product-${productId}`);     // сбросит Data Cache и Full Route Cache
  return Response.json({ ok: true });        // Router Cache у открытых вкладок обновится на следующей навигации
}
```

Для цен: on-demand по тегу как основной механизм плюс `revalidate: 3600` как страховка, если вебхук потерялся. Наличие на экране чекаута вообще без кеша (`no-store` или dynamic), потому что продать то, чего нет, дороже, чем лишний запрос в базу.

## Подводные камни
- Multi-instance (Kubernetes, несколько подов): Data Cache и Full Route Cache по умолчанию файловые в `.next/cache` каждого пода. `revalidateTag` пришёл на под A, под B дальше отдаёт старое. Фикс: `cacheHandler` в `next.config` с общим хранилищем (Redis), плюс `cacheMaxMemorySize: 0`, чтобы выключить in-memory слой. Или вынести кэш уровнем выше, на CDN с purge по тегам.
- Ревалидация по тегу лучше, чем по пути: товар лежит на своей странице, в каталоге, в поиске, в «похожих». Один тег `product-123` сбрасывает всё, по путям надо помнить каждый.
- `revalidateTag` в Next 16 принимает второй аргумент (`'max'` или профиль `cacheLife`), а для «сразу увидеть свою запись» в Server Action есть `updateTag`. Сам слой `use cache` + `cacheTag` + `cacheLife` (Cache Components) это новый явный способ кешировать не только fetch, но и любой компонент или функцию.
- Красный флаг: `export const dynamic = 'force-dynamic'` на весь проект «чтобы не было проблем с кешем». Это убить ISR и платить рендером за каждый запрос.
- Ещё одна ловушка: Data Cache переживает деплой, Full Route Cache нет. После релиза HTML свежий, а данные внутри могут быть из прошлой недели.

## Вопросы вдогонку
- **Что изменил Next 15 в кешировании?** `fetch` и GET route handlers больше не кешируются по умолчанию, Router Cache для динамических страниц не переиспользуется. Кеш стал opt-in.
- **Чем revalidatePath отличается от revalidateTag?** Path сбрасывает конкретный маршрут (и все fetch внутри него), tag сбрасывает все записи с этим тегом, где бы они ни использовались.
- **Как ревалидация ведёт себя на самом запросе?** Она только помечает запись stale. Следующий запрос получит старые данные и запустит пересборку (SWR), либо, при `revalidatePath` из action, уже свежие.
- **Зачем React `cache()`, если fetch и так мемоизируется?** Для не-fetch источников: ORM, SDK. `cache()` дедуплицирует вызовы функции в одном рендере, но не хранит между запросами.
