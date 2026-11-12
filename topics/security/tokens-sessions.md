---
title: JWT vs сессии, access/refresh и где хранить токены
category: security
level: middle
sources: tech-checks/common/auth-security.md Q5, Q6, Q7, Q8; Interview Shit/Security/Auth vs Authorization.md; tech-checks/common/rest-api.md Q14
---
## Что это
**Коротко:** Сессия это состояние на сервере, у клиента только cookie с id. JWT это подписанный токен, в котором само состояние лежит внутри, сервер ничего не хранит и просто проверяет подпись. Сессии дают мгновенный logout и отзыв, JWT даёт stateless и масштабирование, но отозвать его до истечения нельзя. Поэтому JWT живёт парой: короткий access и длинный refresh.

JWT это `header.payload.signature`. Header и payload это base64url, не шифрование: payload читает кто угодно, в том числе через jwt.io. Подпись (HMAC или RSA) гарантирует целостность, не секретность. Внутрь кладём `sub`, роли, `exp`. Никогда: пароли, секреты, персональные данные.

Access + refresh flow:
- Access token живёт ~15 минут, ходит в заголовке `Authorization: Bearer ...`.
- Refresh token живёт 7-30 дней, нужен только для одного эндпоинта `/auth/refresh`.
- Access истёк или юзер нажал F5 и память очистилась: клиент дёргает `/refresh`, получает новый access и продолжает.
- Зачем два: украли короткий access, через 15 минут он мёртв. Один длинный токен это долгий доступ для вора.

Где хранить в SPA:
- **localStorage**: удобно, переживает перезагрузку, но любой XSS читает его одной строкой.
- **HttpOnly cookie**: JS не достанет, XSS не украдёт, но cookie летят сами, нужна защита от CSRF (SameSite).
- **In-memory** (state, zustand, переменная в модуле): безопаснее всего, но слетает на F5.
Рабочая связка: access в памяти, refresh в HttpOnly Secure SameSite cookie с `Path=/auth/refresh`.

## Пример
```js
// ✅ interceptor: 401 → один рефреш на всех → повтор запроса
let refreshing = null;

api.interceptors.response.use(null, async (error) => {
  const req = error.config;
  if (error.response?.status !== 401 || req._retried) throw error;
  req._retried = true;

  refreshing ??= refreshAccessToken().finally(() => { refreshing = null; });
  const token = await refreshing;           // параллельные 401 ждут один и тот же promise

  req.headers.Authorization = `Bearer ${token}`;
  return api(req);
});
```

Без `refreshing` пять параллельных запросов получают пять 401 и запускают пять рефрешей. Если бэк делает rotation (старый refresh гаснет после использования), второй рефреш уже невалиден и юзера выкидывает. Это и есть «шторм рефрешей».

## Подводные камни
- «Храню в localStorage, всё норм» без оговорок это флаг. Нет идеального варианта, интервьюер хочет услышать trade-offs.
- Отзыв JWT это всегда костыль: короткий TTL + refresh, denylist по `jti` в Redis, refresh rotation с детектом повторного использования. Кандидат должен понимать, что это осознанные костыли, а не «JWT просто безопасен».
- `_retried` обязателен: иначе 401 на самом `/refresh` или после рефреша уходит в бесконечный цикл.
- Проверять `alg` на сервере и не принимать `none`. Проверять `exp`, `iss`, `aud`, не только подпись.
- Сессии не хуже JWT. Для одного бэка с Redis сессия проще и безопаснее. JWT нужен, когда токен проверяют несколько сервисов без общего состояния.

## Вопросы вдогонку
- **Что делать с refresh, если access в памяти, а юзер открыл вторую вкладку?** Вторая вкладка сама сходит в `/refresh`, cookie общие. Либо BroadcastChannel, чтобы делиться access между вкладками.
- **Можно ли положить роль в JWT?** Можно, но роль «замораживается» до истечения. Для критичных действий перепроверять в базе.
- **Что такое refresh token rotation?** Каждый `/refresh` выдаёт новый refresh и гасит старый. Если старый пришёл повторно, значит украден, гасим всю семью токенов.
- **Почему не хранить refresh в localStorage?** XSS его утащит, а он живёт 30 дней. Для HttpOnly cookie XSS максимум сделает запрос с твоей страницы, но не унесёт токен.
