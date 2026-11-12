---
title: Server Components, Client Components и Server Actions
category: react
level: middle
sources: tech-checks/frontend/react-angular-vue-next.md Next N3, N12, N18
---
## Что это
**Коротко:** В App Router все компоненты по умолчанию серверные: они выполняются только на сервере, могут быть `async`, ходить в базу напрямую и не попадают в JS-бандл. `"use client"` сверху файла делает компонент клиентским: он получает `useState`, обработчики событий, браузерные API, но и уезжает в бандл. Server Actions это функции с `"use server"`, которые вызываются с клиента как обычные функции, а под капотом Next делает POST на сгенерированный эндпоинт.

Как решать, где граница:
- Всё, что просто показывает данные, остаётся серверным. Клиентским становится только то, где нужна интерактивность: `onClick`, `useState`, `useEffect`, `window`.
- Граница как можно ниже по дереву. Не весь `ProductPage` в `"use client"`, а только кнопка `AddToCart` внутри него.
- `"use client"` заражает всё, что этот файл импортирует: все его импорты тоже становятся клиентскими. Обратно не бывает: клиентский компонент не может импортировать серверный. Но может принять его как `children` или любой проп типа ReactNode, потому что тот уже отрендерен на сервере.
- Пропсы через границу должны быть сериализуемыми: строки, числа, массивы, plain objects, Date, Map, Set, Promise (можно `use()` на клиенте). Функции, классы, инстансы ORM-моделей не пройдут. Исключение: Server Action, это тоже функция, но Next передаёт вместо неё ссылку.

## Пример
```tsx
// app/products/[id]/page.tsx, серверный: нет "use client", async, прямой доступ к БД
export default async function Page({ params }) {
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });
  // ❌ product целиком: там могут быть costPrice, internalNotes, они уедут в HTML
  // ✅ только то, что нужно кнопке
  return <AddToCart id={product.id} price={product.price} action={addToCart} />;
}

// components/add-to-cart.tsx
"use client";
export function AddToCart({ id, price, action }) {
  const [pending, start] = useTransition();
  return <button onClick={() => start(() => action(id))}>{price} ₽</button>;
}

// actions.ts
"use server";
export async function addToCart(productId: string) {
  const session = await auth();                 // ✅ авторизация внутри каждого action
  if (!session) throw new Error("Unauthorized");
  const { id } = schema.parse({ id: productId }); // ✅ валидация, как в любом эндпоинте
  await cart.add(session.userId, id);
  revalidateTag("cart");
}
```

## Подводные камни
- Server Action это публичный HTTP-эндпоинт. Next генерирует ему id и не показывает в бандле неиспользуемые, но любой, кто знает id, может его вызвать с любыми аргументами. Поэтому проверка прав и валидация внутри каждого action, а не «кнопку же видит только админ».
- Пропсы Server → Client видны в RSC payload на странице (можно открыть в DevTools). Не передавать сырые объекты из БД, токены, email других пользователей. Отдавать DTO с нужными полями.
- Секреты: на клиент попадают только `NEXT_PUBLIC_*`. Модуль с `import "server-only"` упадёт на билде, если его случайно затащат в клиентский компонент. Это дешёвая страховка для файлов с ключами и доступом к БД.
- Server Actions против Route Handlers (`app/api/.../route.ts`): actions для своих форм и мутаций из UI, route handlers когда потребитель внешний: мобильное приложение, вебхук от платёжки, другой сервис.
- Красный флаг: `"use client"` в корневом layout «чтобы всё работало». Это выключает главный смысл RSC, весь сайт снова в бандле.
- `useEffect` для загрузки данных в клиентском компоненте, когда родитель серверный и мог бы передать данные готовыми. Два round-trip вместо одного.

## Вопросы вдогонку
- **Серверный компонент это то же, что SSR?** Нет. SSR рендерит клиентские компоненты в HTML, но их код всё равно едет на клиент и гидрируется. Серверный компонент на клиент не попадает вообще, только результат.
- **Почему клиентский компонент не может импортировать серверный?** Импорт тянет код в бандл, а серверный код там исполняться не может. Передача через `children` работает, потому что сервер уже отрендерил его в payload.
- **Как в Server Action вернуть ошибку в форму?** Возвращать объект `{ error }` вместо throw и читать его через `useActionState`. Throw годится для «не должно случиться», для валидации нужен state.
- **Как защититься от CSRF в Server Actions?** Next принимает только POST и сверяет `Origin` с `Host`; при reverse proxy с другим хостом настраивается `serverActions.allowedOrigins`.
