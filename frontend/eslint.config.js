import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

const FRONTEND_STYLE_STANDARD_FILES = [
  'src/components/ActivityTimeline.tsx',
  'src/components/DriveFilesModal.tsx',
  'src/components/LoginPage.tsx',
  'src/components/MainLayout.tsx',
  'src/components/Modal.tsx',
  'src/components/Pagination.tsx',
  'src/components/PanelMessage.tsx',
  'src/components/views/commissions/AllRecordsPanel.tsx',
  'src/components/views/dealsView/tabs/FilesTab.tsx',
];

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/buttonStyles', '**/uiClassNames'],
              message: 'Используйте типизированные примитивы дизайн-системы.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/common/**/*', 'src/**/__tests__/**/*', 'src/**/*.test.*'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: 'Используйте Button, IconButton или другой общий интерактивный примитив.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/__tests__/**/*', 'src/**/*.test.*'],
    rules: {
      'max-lines': [
        'warn',
        {
          max: 700,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    files: [
      'src/AppContent.tsx',
      'src/components/forms/AddPolicyForm.tsx',
      'src/components/views/SellerDashboardView.tsx',
      'src/components/views/PoliciesView.tsx',
      'src/components/views/CommissionsView.tsx',
      'src/components/views/SettingsView.tsx',
      'src/components/views/KnowledgeDocumentsView.tsx',
      'src/components/views/dealsView/DealDetailsPanel.tsx',
      'src/components/views/dealsView/DealsList.tsx',
      'src/components/views/dealsView/tabs/FilesTab.tsx',
      'src/components/views/dealsView/tabs/PoliciesTab.tsx',
      'src/components/views/commissions/RecordsTable.tsx',
    ],
    rules: {
      'max-lines': [
        'warn',
        {
          max: 500,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    files: FRONTEND_STYLE_STANDARD_FILES,
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Используйте именованные export, default export запрещён во frontend-коде.',
        },
        {
          selector:
            "TSTypeReference[typeName.type='TSQualifiedName'][typeName.left.name='React'][typeName.right.name='FC']",
          message: 'Используйте именованные функции компонентов вместо React.FC.',
        },
        {
          selector:
            "TSTypeReference[typeName.type='TSQualifiedName'][typeName.left.name='React'][typeName.right.name='FunctionComponent']",
          message: 'Используйте именованные функции компонентов вместо React.FunctionComponent.',
        },
      ],
    },
  },
]);
