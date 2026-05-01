import { defineConfig } from 'orval';

const openApiTarget =
  process.env['ORVAL_OPENAPI_URL'] ?? 'http://127.0.0.1:3000/docs-json';

export default defineConfig({
  journalApi: {
    input: {
      filters: {
        tags: ['journal'],
      },
      target: openApiTarget,
    },
    output: {
      target: './src/lib/api-client/generated/client.ts',
      schemas: './src/lib/api-client/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'tags-split',
      clean: true,
      formatter: 'prettier',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: './src/lib/api-client/orval-mutator.ts',
          name: 'orvalMutator',
          extension: '.js',
        },
      },
    },
  },
});
