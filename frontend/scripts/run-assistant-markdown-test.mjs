import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'

const rootDir = path.resolve(import.meta.dirname, '..')
const testFile = path.join(rootDir, 'tests', 'assistant-markdown-rendering.test.tsx')
const tempDir = await mkdtemp(path.join(tmpdir(), 'assistant-markdown-'))
const outputFile = path.join(tempDir, 'assistant-markdown-rendering.test.cjs')

try {
  await build({
    absWorkingDir: rootDir,
    bundle: true,
    entryPoints: [testFile],
    format: 'cjs',
    jsx: 'automatic',
    logLevel: 'silent',
    outfile: outputFile,
    platform: 'node',
  })

  await import(pathToFileURL(outputFile).href)
} finally {
  await rm(tempDir, { force: true, recursive: true })
}
