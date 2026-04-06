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
