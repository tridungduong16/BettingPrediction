import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'

const rootDir = path.resolve(import.meta.dirname, '..')
const testFile = path.join(rootDir, 'tests', 'dashboard-chat-initial-state.test.ts')
const tempDir = await mkdtemp(path.join(tmpdir(), 'dashboard-mapper-'))
const outputFile = path.join(tempDir, 'dashboard-chat-initial-state.test.cjs')

const aliasPlugin = {
  name: 'alias-src',
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const basePath = path.join(rootDir, args.path.replace(/^@\//, 'src/'))
      const candidates = [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.json`,
        path.join(basePath, 'index.ts'),
        path.join(basePath, 'index.tsx'),
      ]
      const resolvedPath = candidates.find((candidate) => existsSync(candidate))

      return {
        path: resolvedPath ?? basePath,
      }
    })
  },
}

try {
  await build({
    absWorkingDir: rootDir,
    bundle: true,
    entryPoints: [testFile],
    format: 'cjs',
    logLevel: 'silent',
    outfile: outputFile,
    platform: 'node',
    plugins: [aliasPlugin],
  })

  await import(pathToFileURL(outputFile).href)
} finally {
  await rm(tempDir, { force: true, recursive: true })
}
