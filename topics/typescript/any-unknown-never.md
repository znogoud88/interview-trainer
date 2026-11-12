---
title: any, unknown, never и strict mode
category: typescript
level: junior
sources: tech-checks/frontend/typescript.md Q2, Q3, Q4, Q17
---
## Что это
**Коротко:** `any` выключает проверку типов: с ним можно делать что угодно, и TS молчит. `unknown` это честное «не знаю»: положить туда можно что угодно, но перед использованием надо сузить тип. `never` это тип, значений которого не бывает: функция, которая всегда кидает, или ветка switch, в которую нельзя попасть. Strict mode это набор флагов компилятора, которые делают всё это строгим по умолчанию.

- **any** заражает код: `const x: any = ...; const y = x.foo.bar` компилируется, и всё, что выведено из `x`, тоже становится `any`. По сути это JS с расширением `.ts`.
- **unknown** для всего внешнего: ответ API, `JSON.parse`, `catch (e)`, то, что достали из `localStorage`. Пока не проверил `typeof`, `instanceof` или не прогнал через zod, вызвать метод на нём нельзя.
- **never** появляется в двух местах: как возвращаемый тип функции, которая не возвращает (`throw`, бесконечный цикл), и как результат сужения, когда все варианты union уже разобраны. На этом строится exhaustive check.
- **strict** включает семью флагов: `noImplicitAny` (параметр без типа это ошибка, а не `any`), `strictNullChecks` (`null` и `undefined` не входят в каждый тип, их надо проверять), `strictFunctionTypes`, `strictPropertyInitialization`, `useUnknownInCatchVariables`. Главная польза от `strictNullChecks`: ловит самый частый класс рантайм-ошибок, «cannot read properties of undefined».

## Пример
```ts
// ❌ any: опечатка в поле, TS молчит, упадёт в рантайме
const data: any = await res.json();
console.log(data.usre.name);

// ✅ unknown: сначала доказать, потом использовать
const data: unknown = await res.json();
if (typeof data === "object" && data !== null && "user" in data) { /* ... */ }

// ✅ never для exhaustive check: добавили статус, забыли кейс, компилятор скажет
type Status = "idle" | "loading" | "done";
function label(s: Status) {
  switch (s) {
    case "idle": return "Ждём";
    case "loading": return "Грузим";
    case "done": return "Готово";
    default: {
      const exhaustive: never = s; // ошибка, если Status расширили
      return exhaustive;
    }
  }
}

// ✅ catch: ошибка это unknown, а не Error
try { /* ... */ } catch (e) {
  const message = e instanceof Error ? e.message : String(e);
}
```

## Подводные камни
- `any` в одном месте проползает дальше: всё, что из него достали, тоже `any`, и типизация соседнего кода становится фикцией. Поэтому `noImplicitAny` плюс ESLint-правило `no-explicit-any`.
- `catch (e)`: в strict mode `e` это `unknown`. В `catch` может прилететь что угодно, `throw "oops"` валиден. Поэтому `instanceof Error` перед `.message`, а на границе нормализация ошибок в один формат.
- `as` не превращает `unknown` в тип, а просто затыкает компилятор. `res.json() as User` защищает ровно так же, как `any`, то есть никак.
- Красный флаг на собесе: «выключаю strict, мешает» или «ставлю any, когда TS ругается». Интервьюер хочет услышать: `unknown` на границе, `never` в switch, strict включён с первого дня.
- При миграции с JS можно временно жить без strict, но с планом: включать флаги по одному, `strictNullChecks` первым, не переписывать логику одновременно с типизацией.

## Вопросы вдогонку
- **Чем `unknown` лучше `any`, если всё равно потом проверять?** Он заставляет написать проверку явно, в одном месте, и дальше тип честный. `any` проверку не требует и переносит ошибку в рантайм.
- **Где ещё встречается `never` кроме switch?** Литерал `[]` выводится как `never[]`, `Exclude<T, T>`, пересечение несовместимых типов (`string & number`).
- **Что даёт `strictNullChecks` на практике?** `string | null` нельзя передать туда, где ждут `string`. Приходится проверять или ставить `?.`, и класс ошибок «undefined is not a function» ловится на компиляции.
- **Что включить сверх `strict`?** `noUncheckedIndexedAccess`: `arr[0]` становится `T | undefined`, честно отражает реальность.
