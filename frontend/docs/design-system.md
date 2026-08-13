# Дизайн-система Insure Desk

## Принципы

- Интерфейс desktop-first и рассчитан на плотную ежедневную работу с данными.
- Брендовый синий используется для основного действия, активной навигации и фокуса. Цвета success, warning и danger обозначают только состояние.
- Страница строится в порядке `PageHeader` → действия/фильтры → показатели → таблица или содержимое → пагинация.
- Горизонтальная прокрутка допустима внутри таблицы, но не на уровне документа.

## Токены

Семантические CSS-переменные находятся в `src/index.css`.

- Цвета: `--app-bg`, `--app-surface*`, `--app-border*`, `--app-text*`, `--app-primary*`, `--app-success`, `--app-warning`, `--app-danger`.
- Отступы: `--app-space-1/2/3/4/6/8` соответствуют 4/8/12/16/24/32 px.
- Радиусы: `--app-radius-sm/md/lg` соответствуют 8/12/16 px.
- Контролы: `--app-control-height-sm` — 32 px, `--app-control-height-md` — 36 px.
- Тени: `--app-shadow-sm`, `--app-shadow`, `--app-shadow-overlay`.

Прикладные компоненты не должны вводить новый оттенок брендового цвета или собственные значения focus ring, радиуса и тени.

## Компоненты

- Страницы: `PageShell`, `PageHeader`, `Toolbar`, `Panel`, `SectionHeader`.
- Действия: `Button` и `IconButton`; состояние запроса задаётся `isLoading`, а не ручной заменой разметки.
- Навигация: `Tabs` для ARIA-вкладок, `SegmentedControl` для выбора режима без tabpanel.
- Формы: `FormField`, `FormSection`, `FormActions`, `DateInput` и классы `.field*`.
- Состояния: `StatusBadge`, `InlineAlert`, `EmptyState`, `PanelMessage`.
- Данные: `DataTableShell`, `TableHeadCell`, общие table styles и `Pagination`.
- Оверлеи: `Modal`, `FormModal`, `ConfirmDialog`, `PromptDialog`, `CommandPalette`.

`className` разрешён для размещения компонента в конкретной сетке. Вариант, тон, размер и состояние следует задавать типизированными props.

## Проверка нового UI

1. Проверить клавиатурный фокус, disabled/loading и доступное имя интерактивных элементов.
2. Проверить русский текст, длинные значения и пустые/loading/error-состояния.
3. Проверить 1280×800 и 1440×900 без глобального горизонтального переполнения.
4. Запустить `npm run format:check`, `npm run lint`, `npm run test`, `npm run build` и desktop Playwright smoke.
