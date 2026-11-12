---
title: CORS и preflight
category: browser
level: middle
sources: Interview Shit/Frontend/Core/Security/CORS.md; tech-checks/common/rest-api.md Q13
---
## Что это
**Коротко:** CORS это браузерная защита. По умолчанию same-origin policy запрещает JS на `app.com` читать ответы с `api.com`. CORS это набор HTTP-заголовков, которыми сервер говорит браузеру «этому origin можно». Простой запрос всё равно уходит, но без `Access-Control-Allow-Origin` браузер не отдаст ответ коду. Чинится на сервере, а не хаками на фронте.

Origin это схема + хост + порт. `http://localhost:3000` и `http://localhost:5000` это разные origin, `https://app.com` и `https://api.app.com` тоже. `fetch` и `XMLHttpRequest` подчиняются политике. `<img>`, `<script>`, `<link>` грузятся с чужих доменов свободно (так работают CDN), просто JS не может прочитать их содержимое.

Простые и непростые запросы:
- **Простой**: `GET`, `HEAD`, `POST` с `Content-Type` из `text/plain`, `multipart/form-data`, `application/x-www-form-urlencoded`, без кастомных заголовков. Уходит сразу, браузер только проверяет `Access-Control-Allow-Origin` в ответе.
- **Непростой**: `PUT`, `DELETE`, `PATCH`, `Content-Type: application/json`, `Authorization` или любой свой заголовок. Браузер сначала сам шлёт **preflight**: `OPTIONS` на тот же URL с `Origin`, `Access-Control-Request-Method`, `Access-Control-Request-Headers`. Сервер отвечает пустым телом и заголовками `Access-Control-Allow-Origin`, `-Allow-Methods`, `-Allow-Headers`, `-Max-Age`. Если всё совпало, браузер шлёт настоящий запрос. Если нет, настоящий запрос даже не уйдёт.

Credentials: cookie и `Authorization` в cross-origin запрос по умолчанию не кладутся. Нужно `fetch(url, { credentials: "include" })` на фронте и `Access-Control-Allow-Credentials: true` на сервере, причём с конкретным origin: `Allow-Origin: *` вместе с credentials браузер отвергнет.

## Пример
```js
// Express: одна middleware, и сервер отвечает CORS-заголовками на всё
import cors from "cors";

app.use(cors({ origin: "https://app.com" }));   // только наш фронт
app.use(cors({ origin: "*" }));                 // откуда угодно, но без cookie
app.use(cors({
  origin: "https://app.com",
  methods: ["GET", "POST", "PATCH"],
  credentials: true,                            // + fetch с credentials: "include"
}));
```

Типичная ситуация: в Postman запрос работает, из приложения «CORS error». Postman это не браузер, у него нет same-origin policy. В Network tab видно: `OPTIONS` вернул 404 или без нужных заголовков, настоящий запрос не ушёл.

## Подводные камни
- CORS защищает пользователя, а не сервер. Запрос с curl или с бэкенда уйдёт без всяких CORS. Это не авторизация и не замена проверке токенов.
- `Allow-Origin: *` плюс `credentials: true` не работает, и это специально: иначе любой сайт ходил бы в API с cookie пользователя. При credentials сервер отражает `Origin` из запроса по whitelist.
- Preflight нужно обрабатывать на том же роуте: если бэкенд на `OPTIONS /users` отдаёт 404 или редирект на логин, CORS сломан. Частая ошибка: auth-middleware стоит раньше cors.
- Preflight это лишний round-trip на каждый непростой запрос. `Access-Control-Max-Age` кэширует его ответ. Сделать запросы «простыми» обычно не выходит: `application/json` уже непростой.
- На dev в Vite/CRA ставят proxy, чтобы запросы шли на тот же origin. Это обход для локалки, не решение для прода. Прод: правильные заголовки на API или gateway/BFF на том же домене.
- Сервер ответил 200, а браузер показывает ошибку и тело пустое: значит, ответ дошёл, а заголовков нет. Маркер, что проблема в CORS, а не в сети.
- Интервьюер ждёт: защита браузера, без заголовков сервера не починить, что такое preflight и когда он есть. Красный флаг: «поставил `mode: 'no-cors'`» или «выключил CORS расширением».

## Вопросы вдогонку
- **Почему `mode: "no-cors"` не помогает?** Запрос уйдёт, но ответ будет opaque: статус 0, тело недоступно. Это для сценариев вроде `<img>`, не для API.
- **Отличие CORS от CSRF?** CORS про чтение ответа чужим origin. CSRF это чужой сайт отправляет запрос с твоими cookie, и ответ ему читать не нужно. Простая POST-форма уйдёт несмотря на CORS, поэтому нужны SameSite и CSRF-токены.
- **Что кэширует `Access-Control-Max-Age`?** Результат preflight для URL и пары метод + заголовки. Браузер не шлёт OPTIONS повторно в течение этого времени (Chrome ограничивает 2 часами).
- **Как увидеть preflight в DevTools?** Network, метод `OPTIONS`, в Chrome тип запроса `preflight`. Смотреть статус и заголовки ответа.
