---
title: Discriminated unions: невозможные состояния невозможны
category: typescript
level: middle
sources: tech-checks/frontend/typescript.md Q7
---
## Что это
**Коротко:** Если состояние запроса описать независимыми полями (`isLoading`, `data`, `error`), типы разрешают комбинации, которых в жизни не бывает: `isLoading: true` и `error` одновременно. Discriminated union решает это: одно поле `status` с литералами, и у каждого варианта только те поля, которые в нём реально есть. Компилятор не даст прочитать `data` в состоянии `loading`.

Как устроено:
- Общее поле-дискриминант с литеральным типом: `status: "idle" | "loading" | "success" | "error"`.
- Каждый вариант это отдельный объектный тип со своими полями: `success` несёт `data`, `error` несёт `message`, у `idle` и `loading` ничего лишнего.
- Сужение через `if (state.status === "success")` или `switch`: внутри ветки TS знает точный вариант.
- Переходы между состояниями это функции, которые возвращают новый объект нужного варианта, а не мутация трёх флагов.

Это любимая мини-задачка на TS-мышление: «смоделируй state запроса так, чтобы невозможные состояния были невозможны». Решается за 3 минуты и показывает, думает человек типами или просто расставляет аннотации.

## Пример
```ts
// ❌ три поля, восемь комбинаций, валидных четыре
type State = { isLoading: boolean; data?: User[]; error?: string };
// isLoading: true + error: "oops" компилируется. Что рисовать, спиннер или ошибку?

// ✅ discriminated union: ровно четыре состояния
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; message: string };

function render(state: State) {
  switch (state.status) {
    case "idle":    return null;
    case "loading": return <Spinner />;
    case "success": return <List items={state.data} />;   // data есть только здесь
    case "error":   return <Alert>{state.message}</Alert>;
  }
}
// state.data вне ветки "success": ошибка компиляции
```

Тот же паттерн для ответов API (`{ ok: true; data } | { ok: false; error }`), событий (`{ type: "click"; x; y } | { type: "key"; code }`), форм (`draft | submitting | submitted`).

## Подводные камни
- Дискриминант должен быть литералом, а не `string`. `status: string` ничего не сужает.
- Без exhaustive check union молча деградирует: добавили `"cancelled"`, `switch` без `default: never` не ругнётся, и новый статус отрисует `undefined`. Поэтому `default` с `const _: never = state`.
- Переусложнение: пара boolean-флагов в маленькой форме иногда честнее, чем union из семи вариантов. Паттерн окупается, когда набор полей зависит от состояния.
- Опциональные поля в варианте (`data?: User[]` внутри `success`) возвращают ту же проблему через чёрный ход. Если в `success` данные есть всегда, поле обязательное.
- Интервьюер хочет услышать слова «discriminated union», «сужение по status», «компилятор не даст». Красный флаг: `data: User[] | null` плюс `isLoading` плюс комментарий «не забудь проверить».

## Вопросы вдогонку
- **А если нужно показывать старые данные во время перезагрузки?** Это новое состояние: `{ status: "refreshing"; data: User[] }`. Главное, чтобы это было явно в типе, а не «data иногда есть».
- **Чем это отличается от enum?** Enum даёт набор значений, union даёт набор форм объекта с разными полями. Discriminated union это enum плюс payload на каждый вариант.
- **Как это ложится на useReducer или Redux?** Идеально: action это тоже discriminated union по `type`, reducer делает `switch` и возвращает новый вариант state.
- **Где это уже сделано за тебя?** React Query отдаёт `status: "pending" | "error" | "success"` и сужает `data` по нему.
