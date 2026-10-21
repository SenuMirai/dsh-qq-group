import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  dts: false,
  outDir: 'lib',
  clean: false,
  external: [/^@deepseek-ai\//, /^node:/],
});
