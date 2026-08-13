# Дизайн-система Insure Desk

## Принципы

- Интерфейс desktop-first и рассчитан на плотную ежедневную работу с данными.
- Брендовый синий используется для основного действия, активной навигации и фокуса. Цвета success, warning и danger обозначают только состояние.
- Страница строится в порядке `PageHeader` → действия/фильтры → показатели → таблица или содержимое → пагинация.
- Горизонтальная прокрутка допустима внутри таблицы, но не на уровне документа.

## Токены

Семантические CSS-переменные находятся в `src/index.css`.

- Цвета: `--app-bg`, `--app-surface*`, `--app-border*`, `--app-text*`, `--app-primary*`.
- Семантические состояния: `neutral`, `brand`, `success`, `warning`, `danger`, `info`, `income`, `expense`, `balance`, `due`, `overdue`, `selected`. Для каждого состояния используются пары `--app-*-surface/border/text`.
- Отступы: `--app-space-1/2/3/4/6/8` соответствуют 4/8/12/16/24/32 px.
- Радиусы: `--app-radius-sm/md/lg` соответствуют 8/12/16 px.
- Контролы: `--app-control-height-sm` — 32 px, `--app-control-height-md` — 36 px.
- Тени: `--app-shadow-sm`, `--app-shadow`, `--app-shadow-overlay`.

Прикладные компоненты не должны вводить новый оттенок брендового цвета или собственные значения focus ring, радиуса и тени.

## Компоненты

- Страницы: `PageShell`, `PageHeader`, `Toolbar`, `Panel`, `SectionHeader`.
- Действия: `Button`, `IconButton`, `SortButton`; состояние запроса задаётся `isLoading`, а не ручной заменой разметки. Для текстовых действий используются варианты `link` и `linkDanger`.
- Навигация: `Tabs` для ARIA-вкладок, `SegmentedControl` для выбора режима без tabpanel.
- Формы: `FormField`, `FormSection`, `FormActions`, `CheckboxField`, `DateInput` и классы `.field*`.
- Состояния: `StatusBadge`, `InlineAlert`, `EmptyState`, `LoadingState`, `Spinner`, `KpiCard`, `PanelMessage`.
- Данные: `DataTableShell`, `TableHeadCell`, общие table styles и `Pagination`.
- Оверлеи: `Modal`, `FormModal`, `ConfirmDialog`, `PromptDialog`, `CommandPalette`.

`className` разрешён для размещения компонента в конкретной сетке. Вариант, тон, размер и состояние следует задавать типизированными props.

Нативный `<button>` разрешён только внутри `components/common`. Прикладной код использует общие интерактивные примитивы. Устаревшие `buttonStyles.ts` и `uiClassNames.ts` удалены и запрещены ESLint.

## Dev-каталог

В development-сборке маршрут `/dev/ui-kit` показывает варианты компонентов, состояния форм, таблицу и модальное окно на локальных фикстурах. Маршрут и пункт навигации отсутствуют в production build.

## Визуальные baseline

- `npm run test:visual` сравнивает committed Chromium/Windows snapshots при 1280×800 и 1440×900.
- `npm run test:visual:update` обновляет изображения только после ручной проверки изменений.
- Тесты работают с `ru-RU`, часовым поясом `Europe/Moscow`, отключённой анимацией и скрытым caret.

## Проверка нового UI

1. Проверить клавиатурный фокус, disabled/loading и доступное имя интерактивных элементов.
2. Проверить русский текст, длинные значения и пустые/loading/error-состояния.
3. Проверить 1280×800 и 1440×900 без глобального горизонтального переполнения.
4. Запустить `npm run format:check`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e` и `npm run test:visual`.

## Границы экранов

- Маршрутный или orchestration-компонент связывает controller-hooks и presentation-компоненты и не должен превышать 500 значимых строк.
- Leaf TSX-компонент получает подготовленные данные и callbacks, не выполняет самостоятельных API-запросов и не должен превышать 700 значимых строк.
- Состояние, запросы и side effects размещаются в controller-hooks; сортировка, агрегация, даты и подготовка payload — в тестируемых pure-функциях.
- ESLint проверяет эти пороги правилом `max-lines` в режиме warning, без учёта пустых строк и комментариев.
