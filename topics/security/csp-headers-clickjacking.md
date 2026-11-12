---
title: CSP, security headers и clickjacking
category: security
level: middle
sources: tech-checks/common/auth-security.md Q11, Q16, Q18; Interview Shit/Security/Vulnerabilities/Clickjacking.md
---
## Что это
**Коротко:** Security headers это заголовки ответа, которыми сервер говорит браузеру, что на странице можно, а что нет. Главные три: CSP (откуда можно грузить скрипты и кто может встраивать нас в iframe), X-Frame-Options (запрет iframe, старый способ) и HSTS (только HTTPS). В Node базовый набор ставится одной строкой через `helmet`.

**CSP (Content-Security-Policy)**: список правил по типам ресурсов. `script-src 'self'` означает, что выполнятся только скрипты с нашего домена, inline `<script>` и `onclick=""` не выполнятся. Это вторая линия против XSS: даже если скрипт попал в HTML, браузер его не запустит. Чтобы разрешить свой inline-скрипт, сервер генерит случайный `nonce` на каждый ответ, кладёт его в заголовок и в `<script nonce="...">`. Чужой inline-скрипт nonce не знает.

**Clickjacking**: банальный UI-обман. Твой сайт грузят в невидимый iframe (`opacity: 0`) поверх чужой страницы, юзер жмёт «play», а на самом деле жмёт «delete account» или «подтвердить перевод» на твоём сайте, где он залогинен. Защита: запретить встраивание. `frame-ancestors 'none'` в CSP или `X-Frame-Options: DENY`.

**HSTS (Strict-Transport-Security)**: браузер запоминает, что на этот домен ходить только по HTTPS, и даже `http://` ссылку сам переписывает. Защищает от downgrade и от перехвата первого незащищённого запроса.

Остальной набор: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (камера, геолокация).

## Пример
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-r4nd0m'; img-src 'self' data:; frame-ancestors 'none'
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
```

```js
// Node: базовый набор одной строкой, CSP и frame-ancestors настраиваются опциями
app.use(helmet({ contentSecurityPolicy: { directives: { "script-src": ["'self'", nonceFn] } } }));
```

Clickjacking живьём: страница `evil.com` показывает «Нажми, чтобы получить приз», под кнопкой прозрачный `<iframe src="https://bank.com/confirm-transfer">`, позиционированный так, что кнопка «Подтвердить» ровно под курсором.

## Подводные камни
- Боль CSP в реальной жизни: inline-стили, аналитика, теги маркетинга, виджеты. Все ломаются. Начинать с `Content-Security-Policy-Report-Only`, смотреть отчёты, потом включать.
- `'unsafe-inline'` в `script-src` убивает смысл CSP: inline-скрипт из XSS выполнится. Правильно либо nonce, либо hash, либо `'strict-dynamic'`.
- Nonce должен быть новым на каждый ответ. Статический nonce в кэшированном HTML это тот же `'unsafe-inline'`. Для SPA со статикой это ограничение: nonce нужен серверный рендер или edge.
- `X-Frame-Options` и `frame-ancestors` ставить оба: старые браузеры понимают только первый, новые при наличии `frame-ancestors` игнорируют `X-Frame-Options`. `ALLOW-FROM` мёртв, нужен список доменов, используй `frame-ancestors https://partner.com`.
- Frame-busting на JS (`if (top !== self) top.location = self.location`) обходится через `sandbox` на iframe. Это не защита.
- Знание `helmet` на собесе читается как практика. Знание nonce как понимание CSP, а не заученный термин.

## Вопросы вдогонку
- **CSP защищает от XSS полностью?** Нет, это митигация. Скрипт из разрешённого источника или `eval` при `'unsafe-eval'` всё равно выполнится. Экранирование остаётся первой линией.
- **Что делать, если нужно встраиваться в iframe партнёра?** `frame-ancestors https://partner.com` с точным списком, не `*`. И `SameSite=None; Secure` на cookie, если в iframe нужна сессия.
- **Как узнать, что CSP что-то заблокировал?** Ошибка в консоли и `report-uri` / `report-to`: браузер шлёт JSON с нарушением на наш эндпоинт.
- **HSTS preload это что?** Домен попадает в список, зашитый в браузер, и первый запрос тоже будет HTTPS. Откатить сложно, ставить, когда HTTPS везде.
