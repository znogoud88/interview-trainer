---
title: Картинки и шрифты
category: performance
level: middle
sources: tech-checks/frontend/performance-core-web-vitals.md P9, P10; Interview Shit/Frontend/Performance/Core Web Vitals.md
---
## Что это
**Коротко:** Картинки и шрифты это обычно самые тяжёлые байты на странице, и они напрямую бьют по LCP и CLS. Чеклист картинок: современный формат (WebP/AVIF), размер под viewport (srcset/sizes), lazy ниже фолда, высокий приоритет для LCP, размеры в разметке, CDN с трансформациями. Чеклист шрифтов: `font-display`, preload критичного, self-hosting, subsetting, fallback с `size-adjust`.

Картинки:
- **Формат**: AVIF легче WebP, WebP легче JPEG/PNG при том же качестве. Через `<picture>` с `<source type="image/avif">` и fallback, или CDN отдаёт формат по заголовку `Accept`.
- **Размер под экран**: `srcset` даёт браузеру набор файлов разной ширины, `sizes` говорит, сколько места картинка займёт в layout. Браузер сам выбирает под ширину и DPR. Без `sizes` он считает 100vw и берёт слишком большую.
- **Приоритет**: LCP-картинка с `fetchpriority="high"` и без lazy, при необходимости `<link rel="preload" as="image">`. Всё ниже фолда `loading="lazy"` и `decoding="async"`.
- **CLS**: `width`/`height` в атрибутах или `aspect-ratio`.
- **CDN с трансформациями** (Cloudinary, imgix, Cloudflare Images, `next/image`): ресайз, формат и качество по параметрам URL, кеш на edge. Не хранить 15 размеров руками.

Шрифты:
- **FOIT/FOUT**: пока шрифт грузится, браузер либо прячет текст (invisible), либо показывает fallback и потом подменяет (unstyled). Подмена это layout shift.
- **`font-display`**: `swap` (сразу fallback, потом подмена: текст виден, но прыгает), `optional` (не успел за ~100ms, остаёмся на fallback до следующего визита: CLS нет), `fallback` посередине. Для body-текста часто `optional`, для брендового заголовка `swap`.
- **Preload** критичного: `<link rel="preload" as="font" type="font/woff2" crossorigin>`, иначе браузер узнает о шрифте только после разбора CSS и первого использования.
- **Self-hosting** вместо Google Fonts: нет лишнего соединения с чужим доменом, свой кеш и заголовки, preload работает.
- **Subsetting**: только нужные глифы (латиница + кириллица без 3000 CJK), `unicode-range`, чтобы браузер качал только нужный кусок. Всегда woff2.
- **Fallback с метриками**: `size-adjust`, `ascent-override`, `line-gap-override` подгоняют локальный Arial под веб-шрифт, подмена почти не двигает текст. Это продвинутый уровень, звучит хорошо.

## Пример
```html
<picture>
  <source type="image/avif" srcset="hero-800.avif 800w, hero-1600.avif 1600w" sizes="(max-width: 800px) 100vw, 800px">
  <img src="hero-800.jpg" srcset="hero-800.jpg 800w, hero-1600.jpg 1600w" sizes="(max-width: 800px) 100vw, 800px"
       width="800" height="400" fetchpriority="high" alt="Товар">
</picture>
<img src="review.jpg" width="300" height="200" loading="lazy" decoding="async" alt="Отзыв">

<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
```
```css
@font-face { font-family: Inter; src: url(/fonts/inter-latin.woff2) format("woff2"); font-display: swap; unicode-range: U+0000-00FF; }
```

## Подводные камни
- `loading="lazy"` на всём подряд, включая LCP-картинку: браузер откладывает её, LCP растёт.
- `srcset` без `sizes` почти бесполезен: браузер считает, что картинка на всю ширину экрана.
- Preload шрифта без `crossorigin`: шрифты всегда грузятся в CORS-режиме, без атрибута браузер скачает файл дважды.
- Preload всех шрифтов подряд: они конкурируют с LCP-картинкой за полосу. Только то, что реально в первом экране.
- `swap` без size-adjust даёт CLS, `optional` даёт «первый визит без фирменного шрифта». Это trade-off, называй его.
- Иконки через icon font это устаревшая практика: инлайн SVG или спрайт.

## Вопросы вдогонку
- **Чем `fetchpriority` отличается от `preload`?** preload говорит «начни грузить раньше, чем нашёл бы сам», fetchpriority говорит «грузи важнее остальных». Для LCP часто нужны оба.
- **Что делает `next/image`?** srcset/sizes, формат по Accept, lazy по умолчанию, размеры против CLS, `priority` для LCP-картинки.
- **Что такое variable font?** Один файл со всеми начертаниями по осям (вес, ширина). Меньше запросов, но файл тяжелее: выгоден, если нужны 3+ начертания.
- **Как проверить, что шрифт реально подрезан?** Network panel: латинский subset woff2 это 20-30 КБ, полный Inter 300+. Резать через `pyftsubset` или glyphhanger.
