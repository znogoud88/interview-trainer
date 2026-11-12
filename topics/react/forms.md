---
title: "Формы: controlled/uncontrolled, React Hook Form + zod"
category: react
level: middle
sources: tech-checks/frontend/react-angular-vue-next.md R12, R13
---
## Что это
**Коротко:** Controlled input это когда значение живёт в React state и прокидывается через `value`, каждое нажатие клавиши = `setState` + ререндер. Uncontrolled это когда значение хранит сам DOM, а React читает его через ref или `FormData` в момент отправки. Для больших форм дефолт сегодня React Hook Form (uncontrolled внутри, ререндер только того, что нужно) плюс zod-схема как единый источник правил и типов.

Controlled: полный контроль, значение всегда известно, можно форматировать на лету (маска телефона), валидировать на каждый символ, делать зависимые поля. Цена: ререндер на каждый ввод, и на форме в 30 полей с общим state это заметно.

Uncontrolled: `defaultValue` + `ref`, или просто `new FormData(form)` в `onSubmit`. Меньше кода и ререндеров, но React не знает значение до чтения. Подходит для простых форм и файловых инпутов (`<input type="file">` всегда uncontrolled).

Большая форма (30 полей, валидация, условные секции):
- **React Hook Form**: `register` вешает ref и события на инпут, форма не ререндерится на ввод. `useWatch` для точечной подписки на поле, от которого зависит условная секция.
- **zod + zodResolver**: одна схема, из которой выводятся TS-типы (`z.infer`), валидация на клиенте, и та же схема на сервере.
- **useFieldArray** для динамических списков (несколько адресов, контакты).
- **Controller** для сторонних контролов (date picker, select из UI-кита), которые не отдают нативный ref.
- Серверные ошибки через `setError('email', { message })`: маппим `details` из ответа API на поля.

## Пример
```tsx
const schema = z.object({
  email: z.string().email(),
  company: z.string().optional(),
  isBusiness: z.boolean(),
}).refine(d => !d.isBusiness || d.company, { message: "Укажите компанию", path: ["company"] });

type Form = z.infer<typeof schema>;

const { register, handleSubmit, control, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
const isBusiness = useWatch({ control, name: "isBusiness" });   // подписка на одно поле, не на всю форму

<input {...register("email")} aria-invalid={!!errors.email} aria-describedby="email-err" />
{errors.email && <p id="email-err" role="alert">{errors.email.message}</p>}
{isBusiness && <input {...register("company")} />}
```

## Подводные камни
- Клиентская валидация это UX, серверная это безопасность. Схему на клиенте можно обойти, сервер проверяет всегда. Хорошо, когда это один и тот же zod.
- Переключать инпут между controlled и uncontrolled (`value={undefined}`, потом строка) это warning и баги. `useState("")`, не `useState()`.
- `watch()` без аргументов подписывает на всю форму и возвращает ререндеры назад. Подписываться на конкретные поля.
- Доступность: ошибка связана с полем (`aria-describedby`, `aria-invalid`), фокус на первое невалидное поле после сабмита, `role="alert"` для скринридера. Это спрашивают в R13 прямо.
- Красный флаг: «храню всю форму в одном useState-объекте и спредю на каждый onChange». Работает до 10 полей.

## Вопросы вдогонку
- **Почему React Hook Form быстрее Formik?** Formik хранит значения в state и ререндерит форму на каждый ввод. RHF держит значения в ref и подписывает только то, что просили.
- **Как валидировать асинхронно (занят ли email)?** `validate` в `register` с async-функцией, или `superRefine` в zod, с debounce и состоянием «проверяем».
- **Что React 19 добавил для форм?** `<form action={fn}>`, `useActionState`, `useFormStatus` для pending без ручного state. Для сложных форм RHF всё ещё удобнее.
- **Где хранить черновик формы?** URL для простых фильтров; для сложных форм `useWatch` + debounce в sessionStorage, восстановление через `defaultValues`.
