export default {
    'apps/app/**/*.{ts,tsx,js,jsx}': [
      'eslint --fix -c apps/app/eslint.config.js',
      'prettier --write',
    ],
  
    'apps/api/**/*.{ts,js}': [
      'eslint --fix -c apps/api/eslint.config.mjs',
      'prettier --write',
    ],
  
    'packages/**/*.{ts,tsx,js,jsx}': ['prettier --write'],
  
    '*.{json,md,yml,yaml}': ['prettier --write'],
  };