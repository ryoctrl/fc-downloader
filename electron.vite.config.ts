import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const pkgVersion = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')).version as string

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkgVersion)
    },
    build: {
      rolldownOptions: {
        input: {
          index: resolve('src/renderer/index.html')
        }
      }
    }
  }
})
