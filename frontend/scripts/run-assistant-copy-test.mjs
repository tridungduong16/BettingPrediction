import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'

const rootDir = path.resolve(import.meta.dirname, '..')
const testFile = path.join(rootDir, 'tests', 'assistant-copy.test.ts')
const tempDir = await mkdtemp(path.join(tmpdir(), 'assistant-copy-'))
const outputFile = path.join(tempDir, 'assistant-copy.test.cjs')

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
    define: {
      'import.meta.env.VITE_API_URL': '""',
      'import.meta.env.VITE_APP_ENV': '"test"',
      'import.meta.env.VITE_LIVE_DEBUG_LOGS': '"false"',
      'import.meta.env.VITE_LIVE_POLLING_INTERVAL_MS': '"300000"',
      'import.meta.env.VITE_MATCH_ID': '"2026-001-mexico-vs-south-africa"',
      'import.meta.env.VITE_PUBLIC_STATICS_URL': '""',
      'import.meta.env.VITE_WS_URL': '""',
    },
    entryPoints: [testFile],
    format: 'cjs',
    jsx: 'automatic',
    loader: {
      '.scss': 'empty',
      '.svg': 'text',
    },
    logLevel: 'silent',
    outfile: outputFile,
    platform: 'node',
    plugins: [aliasPlugin],
  })

  await import(pathToFileURL(outputFile).href)
} finally {
  await rm(tempDir, { force: true, recursive: true })
}
