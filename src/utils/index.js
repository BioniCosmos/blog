'use strict'

import fs from 'fs'
import path from 'path'
import { execFile } from 'node:child_process'
import cwebp from 'cwebp-bin'

function isImage(pathname) {
    const imageExtNames = ['.png', '.jpg', '.jpeg', '.bmp']
    const ext = path.extname(pathname)
    return imageExtNames.includes(ext)
}

function toWebP(dir) {
    fs.readdirSync(dir).forEach(file => {
        const pathname = path.join(dir, file)
        if (fs.statSync(pathname).isDirectory()) {
            toWebP(pathname)
        } else if (isImage(pathname)) {
            execFile(cwebp, ['-q', '80', pathname, '-o', `${path.join(dir, path.basename(file, path.extname(pathname)))}.webp`], err => {
                if (err) {
                    throw err
                }
                fs.unlinkSync(pathname)
                console.log(pathname)
            })
        }
    })
}

const args = process.argv.slice(2)
if (args.length === 0) {
    console.log('Please specify a directory.')
    process.exit(1)
}
args.forEach(arg => toWebP(arg))
