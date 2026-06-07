/*
 * Generate the app icon assets from build/icon.svg:
 *   build/icon.png  (512x512, used by electron-builder for non-Windows / store)
 *   build/icon.ico  (multi-size, used as the Windows app icon)
 *
 * Run with: npm run gen:icons
 * Requires the `sharp` and `png-to-ico` devDependencies.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = join(root, 'build')
const svg = readFileSync(join(buildDir, 'icon.svg'))

// 512x512 PNG
await sharp(svg).resize(512, 512).png().toFile(join(buildDir, 'icon.png'))

// Multi-size ICO for Windows
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = await Promise.all(sizes.map((s) => sharp(svg).resize(s, s).png().toBuffer()))
writeFileSync(join(buildDir, 'icon.ico'), await pngToIco(pngs))

console.log('Generated build/icon.png and build/icon.ico')
