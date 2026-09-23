import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', proxy: 'src/proxy.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: 'es2022',
  external: ['next', 'react'],
});
