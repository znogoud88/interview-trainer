---
title: OAuth 2.0 + PKCE и OIDC
category: security
level: senior
sources: tech-checks/common/auth-security.md Q2, Q3, Q4; Interview Shit/Security/Auth vs Authorization.md
---
## Что это
**Коротко:** OAuth 2.0 это протокол авторизации: приложение получает токен для доступа к ресурсам юзера у провайдера (Google, GitHub), не зная его пароля. Для SPA используется Authorization Code flow + PKCE: редирект на провайдера, логин, обратно прилетает одноразовый `code`, его меняем на токены. PKCE защищает этот обмен, потому что SPA не может хранить `client_secret`. OIDC это слой аутентификации поверх OAuth: добавляет `id_token` и отвечает на вопрос «кто этот юзер».

Flow по шагам для SPA:
1. Генерим случайный `code_verifier` (43-128 символов) и `code_challenge = base64url(sha256(verifier))`.
2. Редиректим на `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=openid profile&state=...&code_challenge=...&code_challenge_method=S256`.
3. Юзер логинится у провайдера и подтверждает доступ.
4. Провайдер редиректит на `redirect_uri?code=...&state=...`. Сверяем `state` с тем, что сохранили.
5. POST на `/token` с `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `code_verifier`.
6. Провайдер считает sha256 от verifier, сравнивает с challenge из шага 2, отдаёт `access_token`, `refresh_token`, `id_token`.

Зачем PKCE: `code` летит через URL, его можно перехватить (логи, referer, вредоносное приложение на телефоне). Но без `code_verifier` он бесполезен, а verifier никуда кроме прямого POST на `/token` не ходил. У серверного приложения ту же роль играл `client_secret`, у SPA его хранить негде, весь код публичный.

OAuth vs OIDC: OAuth отвечает «можно ли этому приложению читать календарь юзера», и access token там вообще не обязан быть читаемым. OIDC добавляет `scope=openid`, `id_token` (JWT с `sub`, `iss`, `aud`, `exp`, `nonce`) и эндпоинт `/userinfo`. «Login with Google» это OIDC.

## Пример
```js
// ✅ старт flow в SPA
const verifier = randomString(64);
sessionStorage.setItem("pkce_verifier", verifier);
sessionStorage.setItem("oauth_state", state);
const challenge = base64url(await crypto.subtle.digest("SHA-256", enc(verifier)));
location.href = `${AUTH}/authorize?response_type=code&client_id=${ID}` +
  `&redirect_uri=${CB}&scope=openid%20profile&state=${state}` +
  `&code_challenge=${challenge}&code_challenge_method=S256`;

// на callback: сверили state, обменяли code + verifier на токены
```

Implicit flow (`response_type=token`) делал то же самое без обмена: токен прилетал прямо в URL-фрагмент. Он светился в истории браузера, в логах, утекал через referer, и не было refresh token. В OAuth 2.1 его убрали, PKCE стал обязательным для всех клиентов.

## Подводные камни
- `state` защищает callback от CSRF: без него злоумышленник подсунет свой `code`, и ты залогинишься в его аккаунт. `nonce` делает то же для `id_token`.
- `redirect_uri` регистрируется у провайдера точным совпадением. Wildcard в redirect_uri это классическая дыра: code уезжает на чужой домен.
- Проверять `id_token` на клиенте мало: подпись, `iss`, `aud` (это наш client_id), `exp`, `nonce`. Иначе подсунут чужой токен.
- Access token от провайдера предназначен для его API, а не для нашего бэка. Наш бэк либо проверяет `id_token` и выдаёт свою сессию, либо у него своя пара access/refresh.
- Для SPA всё чаще рекомендуют BFF: токены живут на нашем сервере, фронт получает только HttpOnly session cookie. Тогда XSS не утащит refresh token провайдера.
- Интервьюер хочет понимание flow, а не термины. Красный флаг: «PKCE это такой secret для SPA» без объяснения, что именно защищается.

## Вопросы вдогонку
- **Почему SPA не может хранить client_secret?** Весь бандл публичный, secret виден в DevTools. Поэтому SPA это public client, и его единственная защита обмена это PKCE.
- **Чем отличаются access_token и id_token?** Access для API провайдера, часто opaque. `id_token` всегда JWT с данными о юзере, для нашего приложения.
- **Что такое scope?** Список разрешений, которые просим: `openid`, `email`, `calendar.readonly`. Юзер видит их на экране consent.
- **Когда нужен Client Credentials flow?** Сервис ходит к сервису без юзера: cron, интеграция. Там `client_secret` живёт на сервере, PKCE не нужен.
