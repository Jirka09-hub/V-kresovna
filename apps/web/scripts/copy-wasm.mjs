// Zkopíruje manifold.wasm do public/wasm, odkud ho načítá Web Worker enginu.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, '../../../packages/engine/package.json'))
const source = require.resolve('manifold-3d/manifold.wasm')
const targetDir = join(here, '../public/wasm')
mkdirSync(targetDir, { recursive: true })
copyFileSync(source, join(targetDir, 'manifold.wasm'))
console.log('manifold.wasm → public/wasm')
