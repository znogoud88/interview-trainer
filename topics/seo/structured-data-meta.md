---
title: Structured data, title/description и Open Graph
category: seo
level: middle
sources: tech-checks/frontend/seo.md SEO5, SEO8, SEO12
---
## Что это
**Коротко:** Три слоя метаданных страницы, за которые отвечает фронт. Title это главный on-page фактор ранжирования и заголовок сниппета. Meta description не ранжирует, но определяет CTR из выдачи. Structured data (JSON-LD по schema.org) даёт rich snippets: звёзды, цену, наличие, хлебные крошки прямо в выдаче. Open Graph это превью в соцсетях и мессенджерах, и их краулеры JS не исполняют, поэтому всё это должно быть в серверном HTML.

Title и description:
- Title уникальный на каждую страницу, ключевая фраза ближе к началу, примерно до 60 символов (дальше обрежется), бренд в конце. Google может переписать title, если он не соответствует контенту или дублируется.
- Description: 150-160 символов, конкретное обещание (цена, бесплатная доставка, срок). Google часто подставляет свой фрагмент из текста, если description не отвечает запросу.
- Для тысяч страниц шаблоны: «Купить {товар} в {городе}: цена от {min}», «{Категория}: {count} моделей». Данные из того же источника, что и контент, чтобы не расходились.
- H1 один на страницу, по смыслу совпадает с title, но не обязан быть одинаковым.

Structured data:
- Формат JSON-LD в `<script type="application/ld+json">`, Google рекомендует его вместо microdata.
- Что размечают: `Product` (name, image, offers с price/priceCurrency/availability, aggregateRating), `BreadcrumbList`, `Organization`, `Article`, `LocalBusiness`, `Event`.
- Что даёт: rich results в выдаче (звёзды, цена, наличие), выше CTR при тех же позициях. Напрямую ранжирование не меняет.
- Правило Google: разметка описывает то, что видно на странице. Рейтинг в JSON-LD без рейтинга в UI это manual action.
- Проверка: Rich Results Test, Schema Markup Validator, отчёт Enhancements в Search Console.

Open Graph и соцсети:
- `og:title`, `og:description`, `og:image` (1200×630), `og:url`, `og:type`, для X ещё `twitter:card`.
- Краулеры Facebook, Telegram, Slack, LinkedIn читают сырой HTML. SPA без SSR даст превью «site.com» без картинки.
- OG-картинки для динамических страниц генерируют на лету (Next.js `ImageResponse`, satori) и кэшируют. Картинка товара с ценой в превью это трафик.
- Превью кэшируется на стороне соцсети, после правки сбрасывать (Facebook Sharing Debugger, LinkedIn Post Inspector).

## Пример
```tsx
// Next.js App Router: всё уходит в серверный HTML
export async function generateMetadata({ params }) {
  const p = await getProduct(params.id);
  return {
    title: `${p.name} купить, цена ${p.price} ₽`,
    description: `${p.name}: в наличии, доставка завтра. ${p.shortDescription}`,
    openGraph: { title: p.name, images: [`/api/og/product/${p.id}`] },
  };
}

// JSON-LD в теле страницы, < экранируем, чтобы данные из CMS не закрыли </script>
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: p.images,
  offers: { '@type': 'Offer', price: p.price, priceCurrency: 'RUB', availability: 'https://schema.org/InStock' },
}).replace(/</g, '\\u003c');
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
```

## Подводные камни
- JSON-LD через `dangerouslySetInnerHTML` без экранирования: строка `</script>` из CMS ломает страницу и это XSS-вектор. Экранировать `<`, как выше.
- Одинаковый title на всех страницах («Главная | Магазин») или title, собранный в `useEffect` на клиенте, это самый частый баг SPA. Соцсети и часть краулеров его не увидят.
- Разметка ради разметки: `Review` с выдуманными оценками, FAQ на странице без FAQ. За это Google выдаёт ручные санкции. И FAQ rich results с 2023 показываются почти только для госсайтов и медицины, HowTo убрали совсем.
- Rich result это не гарантия: Google решает сам, показывать ли расширенный сниппет, даже если разметка валидна.
- Красный флаг: «мета заполняет маркетинг через плагин». Интервьюер хочет: что в HTML с сервера, откуда данные, чем проверяется.

## Вопросы вдогонку
- **Что делать с title в SPA без SSR?** Минимум `document.title` при роутинге для пользователя и Google. Для соцсетей без SSR или prerender решения нет.
- **Microdata или JSON-LD?** JSON-LD: отдельный блок, не размазан по вёрстке, легко генерировать из данных. Google рекомендует его.
- **Как узнать, что rich snippets появились?** Search Console, Enhancements (Products, Breadcrumbs): валидные и с ошибками, плюс Performance с фильтром Search appearance.
- **Почему description не ранжирует, но важен?** Он влияет на CTR, а CTR это трафик при тех же позициях.
