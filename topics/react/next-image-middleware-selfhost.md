---
title: next/image, middleware и self-hosting
category: react
level: middle
sources: tech-checks/frontend/react-angular-vue-next.md Next N14, N16, N17, N20
---
## Что это
**Коротко:** Три темы, которые на собесе проверяют одно и то же: работал ли человек с Next в проде, а не на Vercel-демо. `next/image` ресайзит и конвертирует картинки на сервере и резервирует место под них, чтобы не было CLS. Middleware (в Next 16 переименован в `proxy.ts`) это функция, которая выполняется до рендера на каждый подходящий запрос: редиректы, локали, заголовки. Self-hosting это Docker с `output: 'standalone'` и три вещи, которые на Vercel работали сами, а у тебя нет: ISR-кеш между инстансами, image optimization и CDN.

**next/image**: генерирует `srcset` под разные ширины экрана, отдаёт AVIF/WebP через `sharp`, lazy loading по умолчанию, обязательные `width`/`height` или `fill`, чтобы браузер знал размер до загрузки. Внешние хосты надо разрешить в `images.remotePatterns`.

**Middleware / proxy**: один файл в корне, `matcher` в `config` ограничивает, на какие пути срабатывает. Возвращает `NextResponse.redirect`, `rewrite` или `next()` с изменёнными заголовками. Исторически только edge runtime (нет Node API, лимит размера), с Next 15.5 можно Node, в Next 16 `proxy.ts` работает на Node.

**Self-hosting**: `output: 'standalone'` собирает минимальную папку с `server.js` и только нужными `node_modules`. Multi-stage Dockerfile: builder ставит зависимости и собирает, runner копирует `.next/standalone`, `.next/static` и `public`.

## Пример
```tsx
// ❌ LCP-картинка с lazy по умолчанию: браузер откладывает её, LCP плохой
<Image src={hero} alt="" width={1200} height={600} />
// ✅ priority = eager + preload; sizes говорит, какая ширина реально нужна
<Image src={hero} alt="" width={1200} height={600} priority sizes="(max-width: 768px) 100vw, 1200px" />
```

```ts
// proxy.ts (Next 16) или middleware.ts (Next 15)
export function proxy(req: NextRequest) {
  if (!req.cookies.get("session") && req.nextUrl.pathname.startsWith("/account")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/account/:path*"] };
```

## Подводные камни
- `sizes` не указан: браузер думает, что картинка во всю ширину экрана, и качает самый большой вариант из srcset. Оптимизация есть, пользы нет.
- Image optimization на self-host жрёт CPU: каждая новая комбинация размер+формат это `sharp` на твоём сервере, кеш в `.next/cache/images` локальный поду. Варианты: `loader` на Cloudinary/imgix, CDN перед `/_next/image`, или `unoptimized` для уже подготовленных картинок.
- Middleware это не место для авторизации по БД и тяжёлой логики: оно на каждом запросе, в том числе на prefetch. Проверка cookie и редирект да, запрос в базу нет. И это не единственная линия защиты: в 2025 был CVE-2025-29927, когда заголовок `x-middleware-subrequest` позволял обойти middleware целиком. Проверять права там, где данные (в page, в Server Action), middleware только как быстрый фильтр.
- ISR-кеш по умолчанию файловый в каждом поде: `revalidateTag` пришёл на один, остальные отдают старое. Нужен общий `cacheHandler` (Redis) или кеш уровнем выше, на CDN.
- `NEXT_PUBLIC_*` инлайнятся в бандл на `next build`. Один Docker-образ на dev/stage/prod с разными `NEXT_PUBLIC_API_URL` не сработает: везде будет значение с момента сборки. Либо собирать образ на окружение, либо читать runtime-конфиг на сервере (`process.env` в Server Component) и передавать вниз.
- Статика `/_next/static/*` без CDN отдаётся Node-сервером. Для неё уже стоит `Cache-Control: immutable` (хеш в имени), но раздавать её лучше через nginx или CDN, а не через Node.
- `output: 'standalone'` не копирует `public` и `.next/static` сам, это делают руками в Dockerfile. Классический «картинки 404 в контейнере».

## Вопросы вдогонку
- **Чем next/image отличается от обычного `<img loading="lazy">`?** Обычный `<img>` не ресайзит, не конвертирует и не защищает от CLS без ручных размеров. Next делает это автоматически плюс `srcset` под `deviceSizes`.
- **Middleware или layout для проверки авторизации?** Middleware для быстрого редиректа неавторизованных, layout не защищает: page рендерится параллельно с layout, а не внутри него. Реальная проверка в месте доступа к данным.
- **Что ещё ломается при переезде с Vercel?** `revalidate` для всех инстансов, логирование и трейсинг (`instrumentation.ts` вместо встроенного), ограничение размера тела запроса в Server Actions на reverse proxy, streaming за буферизующим nginx.
- **Pages Router → App Router, главный сюрприз?** Кеширование: `getServerSideProps` всегда был динамическим, в App Router маршрут по умолчанию статический и может закешировать то, что раньше рендерилось на каждый запрос.
