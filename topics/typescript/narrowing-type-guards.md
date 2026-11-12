---
title: Narrowing, type guards и zod на границе
category: typescript
level: middle
sources: tech-checks/frontend/typescript.md Q9, Q10, Q20; Interview Shit/Frontend/TypeScript/TypeGuards.md
---
## Что это
**Коротко:** Narrowing это когда TS сужает тип по ветке кода: написал `if (typeof x === "string")`, внутри `x` уже `string`, а не `string | number`. Type guard это способ сузить тип во время выполнения: TS сам точный тип не знает, а мы «доказываем» его через проверки. Zod это тот же type guard, но на границе с внешним миром: валидация в рантайме и вывод типа из схемы заодно.

Техники сужения:
- `typeof` для примитивов, `instanceof` для классов (`Error`, `Date`), `in` для проверки поля (`"data" in res`), `Array.isArray`.
- Дискриминант: общее поле-литерал в union (`status: "ok" | "error"`), по нему TS сам разводит ветки. Самая надёжная техника.
- Truthiness и равенство: `if (user)`, `if (x === null)`.
- Кастомный type guard: функция с возвращаемым типом `arg is Type`. Возвращает boolean, но TS верит ей и сужает тип в ветке. `asserts x is Type` для функций, которые кидают, если проверка не прошла.

Где используется: разбор ответа API, работа с `unknown`, библиотеки валидации форм. Zod под капотом делает то же самое: TS в рантайме не существует, поэтому `z.string()` это просто класс с `typeof input !== "string"` внутри, который возвращает `{ success, data }`.

## Пример
```ts
// кастомный type guard: TS верит возвращаемому типу
function isSuccess(res: unknown): res is Success {
  return typeof res === "object" && res !== null && "status" in res && res.status === "ok";
}
if (isSuccess(res)) res.data; // здесь res: Success

// ❌ "as и надеюсь": тип есть, защиты нет. API прислал null в email, упало в рендере
const user = (await res.json()) as User;

// ✅ zod на границе: парсит, валидирует, тип выводится из схемы
const User = z.object({ id: z.number(), email: z.string().email() });
type User = z.infer<typeof User>;
const user = User.parse(await res.json()); // кинет ZodError, если форма не та
```

Zod внутри грубо говоря такой: `class ZodString { _parse(input) { if (typeof input !== "string") return { success: false }; return { success: true, data: input }; } }`. Никакой магии, обычный JS-guard.

## Подводные камни
- Кастомный guard это обещание компилятору. Если написал `res is Success`, а проверил только `status`, остальные поля TS считает доказанными. Guard с багом хуже, чем его отсутствие: код выглядит типобезопасным, а падает в рантайме.
- Narrowing не переживает callback: после `if (user)` внутри `items.map(() => user.name)` `user` снова `User | null`, TS не знает, когда вызовут. Лечится `const u = user` перед.
- Типы стираются при компиляции. Интерфейс `User`, написанный руками, не защищает от того, что бэкенд поменял поле. Поэтому на границе либо генерация из OpenAPI (orval, openapi-typescript), либо zod. Лучше оба: генерация для контракта, zod там, где не доверяешь.
- Zod на каждом запросе стоит времени. На горячих путях с большими массивами парсить всё целиком может быть дорого, иногда валидируют только критичное.
- Красный флаг на собесе: «as MyType и надеюсь». Интервьюер хочет услышать, что TS защищает только на компиляции, а граница (API, `JSON.parse`, `localStorage`, query params) это место для рантайм-проверки.

## Вопросы вдогонку
- **Чем `satisfies` отличается от type guard?** `satisfies` это проверка на компиляции, guard это проверка в рантайме. Разные моменты времени.
- **Когда достаточно дискриминанта, а когда нужен guard?** Если union свой и у вариантов есть поле-литерал, дискриминант, это бесплатно. Guard нужен для `unknown` и внешних данных.
- **Где TS вообще не защищает?** Всё, что приходит снаружи: API, формы, URL, storage, `postMessage`. Плюс `as`, `!` и `any`, которыми можно соврать компилятору.
- **Zod или генерация из OpenAPI?** Генерация даёт контракт и синхронность с бэком бесплатно, zod даёт реальную проверку. На практике генерируют типы и валидируют zod только ненадёжное.
