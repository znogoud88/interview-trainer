---
title: localStorage, sessionStorage, cookies, IndexedDB и URL как state
category: browser
level: junior
sources: Interview Shit/Frontend/Core/Storage/Local Storage, Session Storage, Cookies.md; Interview Shit/Frontend/Core/Storage/IndexedDB, URL as storage.md; tech-checks/common/caching.md Q18
---
## Что это
**Коротко:** Выбор хранилища это всегда три вопроса: lifetime (сколько живёт и где), security (кто может прочитать) и UX (что должно пережить reload, вкладку, шаринг ссылки). Cookies уходят на сервер с каждым запросом, localStorage живёт в браузере пока не удалишь, sessionStorage до закрытия вкладки, IndexedDB для больших данных, URL для состояния, которым делятся.

- **Cookies**: часть HTTP, а не просто хранилище. Браузер автоматически отправляет их на сервер с каждым запросом на этот домен. ~4KB на cookie. Использование: auth (сессии, refresh token), CSRF-защита, аналитика. Флаги:
  - `HttpOnly`: нельзя прочитать из JS, защита от XSS.
  - `Secure`: только по HTTPS, по обычному http не отправится.
  - `SameSite`: `Strict` вообще не уходит на другие сайты, `Lax` (дефолт в Chrome) уходит при обычном переходе по ссылке, но не в POST с чужого сайта и не в iframe, `None` можно везде, но только вместе с `Secure`.
- **localStorage**: key-value, только строки, ~5MB, синхронный API (может блокировать UI), общий для всех вкладок origin, живёт пока не удалишь. Доступен любому JS на странице, то есть уязвим к XSS. Использование: тема, язык, некритичный кэш UI.
- **sessionStorage**: то же, но привязан к вкладке, очищается при её закрытии, не шарится между вкладками. Использование: данные формы, шаги wizard, временный UI state (открытые табы, фильтры, страница пагинации). Плюс: cleanup не нужен.
- **IndexedDB**: асинхронная база в браузере, сотни мегабайт, хранит объекты и blob, индексы, транзакции. «Лёгкий бэкенд» внутри браузера. Использование: offline-first (Google Docs, Notion), кэш API, service worker в PWA. Голый API неудобный, берут обёртки (idb, Dexie).
- **URL**: стейт приложения, которым можно поделиться. Фильтры, поиск, сортировка, пагинация, id открытой сущности. Работает back/forward, переживает reload, ссылку можно скинуть коллеге.

## Пример
Страница каталога:
- выбранные фильтры и номер страницы: URL (`?category=shoes&page=3`), чтобы ссылка открывалась в том же состоянии;
- тема и язык: localStorage, должны пережить закрытие браузера;
- полузаполненная форма заказа: sessionStorage, после закрытия вкладки чистится само;
- refresh token: cookie `HttpOnly; Secure; SameSite=Lax`, JS его не видит;
- каталог для офлайна в PWA: IndexedDB.

```js
// ❌ токен в localStorage: любой XSS уносит аккаунт
localStorage.setItem("token", jwt);

// ✅ сервер ставит cookie, JS её не читает, браузер сам прикладывает к запросам
// Set-Cookie: refresh=...; HttpOnly; Secure; SameSite=Lax; Path=/auth
```

## Подводные камни
- Токены в localStorage: XSS плюс localStorage это полная компрометация. HttpOnly cookie JS не достанет. Компромисс: access token в памяти, refresh в HttpOnly cookie.
- localStorage синхронный: большой `JSON.parse` при старте блокирует main thread. Для больших данных IndexedDB.
- Всё клиентское хранилище пользователь может почистить или подменить, в приватном окне лимиты меньше. Это кэш, а не источник правды.
- `JSON.parse(localStorage.getItem(...))` может кинуть или вернуть не то: старая версия приложения, мусор. Нужны try/catch и версия схемы в ключе.
- Cookies уходят с каждым запросом: десяток cookie по 4KB это 40KB на каждую картинку. Статику выносят на cookie-less домен.
- В URL не класть чувствительное: он попадает в историю, логи, referer.
- Интервьюер хочет услышать «lifetime + security + UX», а не список API. Красный флаг: «JWT в localStorage, так удобнее».

## Вопросы вдогонку
- **Где хранить JWT?** Refresh в HttpOnly cookie, access в памяти или тоже в cookie. localStorage только если осознанно принят риск XSS.
- **Чем SameSite=Lax отличается от Strict?** Lax отправит cookie при обычном переходе по ссылке на сайт, Strict не отправит даже тогда: пользователь по ссылке из письма окажется разлогиненным.
- **Зачем IndexedDB, если есть localStorage?** Асинхронность, объём, объекты вместо строк, индексы и транзакции. localStorage на сотнях килобайт уже тормозит.
- **Как синхронизировать localStorage между вкладками?** Событие `storage` на `window` срабатывает в других вкладках при изменении.
