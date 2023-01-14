import * as ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import { humanFileSize } from './utils.js'

const getDirectories = (source: string): string[] =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `${source}/${dirent.name}`)

const getFiles = (source: string): { dir: string; file: string }[] =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((file) => file.isFile())
    .map((file) => {
      return { dir: source, file: file.name }
    })

async function run() {
  for (let folder of getDirectories('./ts')) {
    const files = getFiles(folder)
    if (files.map(({ file }) => file).includes('merge')) {
      await new Promise((res) => {
        const ff = new ffmpeg.FfmpegCommand()
        const newPath = `${files[0].dir}/${files[0].file
          .replace('.mp4', '-full.mp4')
          .replace('.ts', '-full.ts')}`
        for (let { dir, file } of files) {
          if (file !== 'merge') ff.input(`${dir}/${file}`)
        }
        ff.on('error', (error) => {
          console.log(`Error: ${newPath} => ${error}`)
          res(null)
        })
          .on('progress', (progress) => {
            process.stdout.clearLine(0)
            process.stdout.cursorTo(0)
            process.stdout.write(
              `Processing: ${progress.currentFps} fps | ${
                progress.frames
              } frames | ${humanFileSize(progress.targetSize * 1024)} | ${
                progress.timemark
              }`
            )
          })
          .on('end', (_) => {
            console.log(`\nDone: ${newPath}`)
            for (let { dir, file } of files) fs.unlinkSync(`${dir}/${file}`)
            res(null)
          })
          .mergeToFile(newPath)
      })
    }
  }

  console.log('Done')
}

run()
