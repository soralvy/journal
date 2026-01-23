// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import pluginPromise from 'eslint-plugin-promise';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import pluginJest from 'eslint-plugin-jest';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**'],
  },
  
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  sonarjs.configs.recommended,

  pluginPromise.configs['flat/recommended'],

  eslintPluginUnicorn.configs['recommended'],

  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },

  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    plugins: { jest: pluginJest },
    languageOptions: {
      globals: pluginJest.environments.globals.globals,
    },
    rules: {
      ...pluginJest.configs['flat/recommended'].rules,
      'jest/prefer-to-have-length': 'warn',
    },
  },

  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      
      'unicorn/no-null': 'off', 
      'unicorn/prevent-abbreviations': 'off', 
      'unicorn/no-static-only-class': 'off',

      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },

  eslintPluginPrettierRecommended,
);