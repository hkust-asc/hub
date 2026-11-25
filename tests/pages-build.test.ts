import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { resolveConfig } from 'vite'

test('production Vite config resolves relative ./ base for GitHub Pages subpath hosting', async () => {
  const config = await resolveConfig({}, 'build')
  assert.equal(config.base, './')

  const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8')
  const rootAssetRefs = [...html.matchAll(/\b(?:href|src)=["'](\/[^"']*)["']/g)]
    .map(match => match[1]!)
    .filter(ref => !ref.startsWith('/src/'))

  assert.deepEqual(rootAssetRefs, [])
})
