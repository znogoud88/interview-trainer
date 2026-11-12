---
title: RUM, perf budget, третьи скрипты, preload/prefetch
category: performance
level: senior
sources: tech-checks/frontend/performance-core-web-vitals.md P11, P12, P17, P18, P19, P20
---
## Что это
**Коротко:** Lighthouse на ноутбуке разработчика ничего не говорит о пользователях. Зрелый подход: RUM в проде (web-vitals в аналитику, p75, разрезы по странице, устройству и гео), performance budget в CI, чтобы регрессии не доезжали до прода, контроль третьих скриптов, которые съедают main thread, и осознанные resource hints: preload для этой страницы, prefetch для следующей, preconnect для чужого домена. Плюс умение рассказать про конкретный win с цифрами до и после.

**RUM (Real User Monitoring)**:
- `web-vitals` (лучше `/attribution`) отправляет LCP/INP/CLS/TTFB через `sendBeacon` в свою аналитику, Sentry, Datadog, Grafana. Или готовое: Vercel Speed Insights, SpeedCurve.
- Смотрим **p75**, не среднее: среднее прячет хвост. Разрезы: route, устройство, страна, тип сети, версия релиза. Один общий график бесполезен.
- Алерты на деградацию после релиза, связь с бизнесом: конверсия, bounce.
- «У меня быстро, у пользователей в другой стране медленно»: RUM с гео-разбивкой и CrUX покажут, что именно; воспроизводим через throttling в DevTools (Slow 4G, 4x CPU) и на реальном дешёвом Android. Лечение: CDN edge для статики и HTML, меньше бандл и round-trips, региональные бэкенды.

**Performance budget**: зафиксированные лимиты (initial JS < 200 КБ gzip, LCP < 2.5s на throttled профиле, число запросов), проверяются в CI: `size-limit`/`bundlesize` на чанки, Lighthouse CI с assertions на метрики. Превысил, PR красный. Деградация ловится до прода, а не по жалобам.

**Третьи скрипты** (аналитика, чаты, A/B, ads, tag managers): нередко половина JS и источник long tasks. Порядок: аудит (что реально используется, кто владелец, что даёт бизнесу), отложенная загрузка после interactive или по действию, `async`/`defer`, фасады (lite-youtube, картинка чата вместо виджета, грузим по клику), Partytown в worker, self-host там, где можно. Это переговоры с маркетингом, не война: приносишь цифры «этот тег стоит 300ms INP и X% конверсии».

**Resource hints**:
- `preload`: критичный ресурс этой страницы, который браузер нашёл бы поздно: шрифт, LCP-картинка из CSS, критичный chunk. Должен использоваться в первые секунды, иначе warning и зря съеденная полоса.
- `prefetch`: ресурс следующей навигации, низкий приоритет, в idle. Next делает это для `<Link>` во viewport.
- `preconnect`: DNS + TCP + TLS с чужим доменом заранее (CDN картинок, API). `dns-prefetch` как лёгкий fallback. Не больше 2-4 доменов.
- `modulepreload` для ESM-чанков.

## Пример
```js
import { onLCP, onINP, onCLS } from 'web-vitals/attribution';
const send = (m) => navigator.sendBeacon('/rum', JSON.stringify({
  name: m.name, value: m.value, rating: m.rating, route, device, element: m.attribution?.element,
}));
onLCP(send); onINP(send); onCLS(send);
```
```yaml
# lighthouserc.yml: assertions в CI
assertions: { 'largest-contentful-paint': ['error', { maxNumericValue: 2500 }] }
```
Формат истории про win: как нашёл (RUM: p75 LCP 4.2s на продукт-пейдже с мобилок), что сделал (hero был lazy и через JS, TTFB 1.5s без кеша; preload + fetchpriority + ISR), как измерил (та же панель через две недели: 1.8s, конверсия мобилок +X%). Без цифр это «оптимизировал на глаз».

## Подводные камни
- RUM без сегментации показывает «в среднем нормально», пока конкретный route на Android лежит.
- INP и CLS финализируются, когда пользователь уходит: отправлять на `visibilitychange`/`pagehide` через `sendBeacon`, обычный fetch при закрытии вкладки теряется.
- Бюджет без владельца умирает: нужен человек, который разбирает красный CI, и правило, что бюджет поднимают осознанно, а не «чтобы прошло».
- Preload всего подряд: ресурсы конкурируют, LCP хуже. Prefetch на мобильной сети жжёт трафик пользователя.
- Красный флаг: «стало быстрее» без цифр и без того, где и как измерял; «мы просто удалили аналитику» без разговора с теми, кому она нужна.

## Вопросы вдогонку
- **CrUX или свой RUM?** CrUX: бесплатно, только Chrome, только origin/URL с достаточным трафиком, окно 28 дней. Свой RUM: все браузеры, любые разрезы, сразу после релиза.
- **Как загрузить третий скрипт, чтобы не мешал?** После `load` или по интеракции, фасад, Partytown. И сначала спросить, нужен ли он вообще.
- **Почему p75, а не p50 или p95?** Google выбрал p75 как порог для CWV: покрывает большинство пользователей, но не так шумно, как p95.
- **Что такое Lighthouse CI?** Прогон Lighthouse на каждый PR с assertions и сравнением с базой; ловит регрессии в lab до прода.
