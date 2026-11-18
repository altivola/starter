// Bundles the Node server into one file so the Docker image needs no node_modules.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/node.ts'],
  outfile: 'dist/node.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external: ['pg-native'],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
})
console.info('built dist/node.js')
