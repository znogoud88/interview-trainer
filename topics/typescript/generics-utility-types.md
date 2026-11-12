---
title: Generics, utility types и satisfies
category: typescript
level: middle
sources: tech-checks/frontend/typescript.md Q6, Q11, Q12
---
## Что это
**Коротко:** Generics это параметризация типов: функция или компонент работает с любым типом `T`, но не теряет его по дороге, `get<User>(url)` вернёт `Promise<User>`, а не `any`. Utility types это встроенные generic-типы для производных форм (`Partial`, `Pick`, `Omit`, `Record`, `ReturnType`). `satisfies` проверяет, что значение подходит под тип, но не расширяет его: узкий выведенный тип остаётся.

Generics:
- `function first<T>(arr: T[]): T`: `T` подставится при вызове, `first([1, 2])` будет `number`.
- Constraints через `extends`: `<T extends { id: string }>` ограничивает, что можно передать, и внутри доступен `item.id`.
- Живые примеры: типизированный API-клиент, `useFetch<T>`, generic-компонент `Table<Row>` с типизированными колонками, `Select<Option>`.

Utility types из повседневки:
- `Partial<T>`: все поля опциональны, для патчей и форм. `Required<T>` наоборот.
- `Pick<T, K>` и `Omit<T, K>`: производные DTO, `Omit<User, "password">` для ответа API.
- `Record<K, V>`: словари. `Record<Status, string>` для лейблов, компилятор требует все ключи.
- `ReturnType<typeof fn>`, `Parameters<typeof fn>`, `Awaited<T>`: вывести тип из функции, не дублируя. Для union `Exclude`/`Extract`, `NonNullable`.

`satisfies` (TS 4.9+): аннотация `const routes: Record<string, string> = {...}` теряет конкретные ключи, автокомплит по `routes.home` пропадает. `satisfies` проверяет форму и оставляет вывод: `routes.home` есть, `routes.typo` ошибка. Главный кейс: конфиги, темы, таблицы роутов.

## Пример
```ts
// generic API-клиент и constraint
async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json();
}
const user = await get<User>("/api/me"); // user: User

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((i) => [i.id, i]));
}

// utility types вместо копипасты
type UpdateUserDto = Partial<Omit<User, "id" | "createdAt">>;
type Labels = Record<User["role"], string>; // забыл роль, ошибка

// ❌ аннотация: ключи стёрлись, config.cdn2 это string, компилятор молчит
const config: Record<string, string> = { api: "/api", cdn: "/cdn" };

// ✅ satisfies: проверка формы + точные ключи
const config = { api: "/api", cdn: "/cdn" } satisfies Record<string, string>;
config.cdn2; // ошибка
```

## Подводные камни
- Generic ради generic: `function log<T>(x: T) { console.log(x) }` ничего не даёт, `unknown` честнее. Generic нужен, когда тип входа связан с типом выхода.
- `get<User>(url)` это тот же `as`: `T` взят с потолка, в рантайме никто не проверяет. Честный вариант принимает zod-схему и выводит `T` из неё.
- `Omit` на union работает не так, как ожидают: распределения нет, остаются только общие ключи. Для union нужен свой distributive-хелпер через conditional type.
- `Partial` для патча удобен, но `{ email: undefined }` и «поле не прислали» для него одно и то же. Для PATCH с «обнулить поле» нужна отдельная семантика (`null`).
- Слишком умные типы (условные, рекурсивные, `infer`) превращают ошибки компилятора в нечитаемую простыню. Если тип не объяснить коллеге за минуту, это проблема.
- Интервьюер ждёт живой пример generic-функции из своего кода, а не определение. «Писал `<T>` в useState» это мало.

## Вопросы вдогонку
- **`satisfies` или `as const`?** `as const` делает всё литералами и readonly, без проверки формы. `satisfies` проверяет форму и сохраняет вывод. Часто вместе: `{...} as const satisfies Config`.
- **Как вывести тип из значения, а не наоборот?** `typeof obj`, `keyof typeof obj`, `(typeof arr)[number]`. Одна точка правды, тип следует за данными.
- **Что такое constraint и default у generic?** `<T extends Base = Base>`: ограничение, что можно передать, и значение по умолчанию, если не указали.
- **Чем `Record<string, T>` отличается от `{ [key: string]: T }`?** По сути одно и то же, `Record` это mapped type. Разница видна с литеральными ключами: `Record<"a" | "b", T>` требует оба.
