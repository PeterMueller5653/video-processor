import chalk from 'chalk'
import * as ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import logUpdate from 'log-update'
import pathLib from 'path'
import process from 'process'
import {
  autoTag,
  editScene,
  scanFolder,
  searchPerformer,
  searchVideo,
  waitForJobs
} from './graphqlFunctions.js'
import {
  calculateEta,
  clamp,
  formatDate,
  humanFileSize,
  loading,
  millisecondsToTime,
  progressBar
} from './utils.js'

const getDirectories = (
  source: string
): {
  folder: string
  name: string
}[] =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => ({
      folder: `${source}/${dirent.name}`,
      name: dirent.name,
    }))

const getFiles = (
  source: string
): {
  dir: string
  file: string
  stats: fs.Stats
}[] =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((file) => file.isFile())
    .map((file) => ({
      dir: source,
      file: file.name,
      stats: fs.statSync(pathLib.join(source, file.name)),
    }))

const Processing = (
  {
    position,
    total,
  }: {
    position: number
    total: number
  },
  message: string,
  log: boolean = false
): string => {
  const line =
    '[ ] ' +
    chalk.blueBright(
      `Processing [${position}/${total}]:`,
      chalk.whiteBright(message)
    )
  if (log) console.log(line)
  return line
}

const Processed = (
  {
    position,
    total,
  }: {
    position: number
    total: number
  },
  message: string,
  log: boolean = false
): string => {
  const line =
    `[${chalk.greenBright('✓')}] ` +
    chalk.greenBright(
      `Processed [${position}/${total}]:`,
      chalk.whiteBright(message)
    )
  if (log) console.log(line)
  return line
}

async function run(merge: boolean = false, page: string): Promise<string[]> {
  const processedFiles: string[] = []
  const folders = getDirectories('./ts')
  const prefixes: string[] = []
  for (let [index, { folder, name }] of folders.entries()) {
    const files = getFiles(folder)
      .filter((f) => f.file.endsWith('.ts') || f.file.endsWith('.mp4'))
      .map((f) => ({
        ...f,
        stats: fs.statSync(pathLib.join(f.dir, f.file)),
      }))
    const totalSize = files.reduce((a, b) => a + b.stats.size, 0)
    const modelPrefix = Processing(
      { position: index + 1, total: folders.length },
      `${name} => ${files.length} files (${humanFileSize(totalSize)})`
    )
    logUpdate(`${prefixes.join('\n')}\n${modelPrefix}`)

    let processedSize = 0
    let mainPrefix = `${prefixes.join('\n')}\n${modelPrefix}`
    let currentLine = mainPrefix

    const videos: string[] = []

    for (let [index, { dir, file, stats }] of files.entries()) {
      const path = `${dir}/${file}`
      const newPath = path.replace('./ts', './' + page).replace('.ts', '.mp4')
      processedSize += stats.size
      const prefix = [
        mainPrefix,
        Processing(
          { position: index + 1, total: files.length },
          `${file} (${humanFileSize(stats.size)}) remaning (${humanFileSize(
            totalSize - processedSize
          )})`
        ),
      ].join('\n')
      try {
        fs.mkdirSync(dir.replace('./ts', './' + page))
      } catch (_) {}
      const startTime = Date.now()
      currentLine = prefix

      let progress = 0
      let ln = ''
      const interval = setInterval(() => {
        logUpdate(loading(`${currentLine}\n${ln}\n${progressBar(progress)}`))
      }, 150)
      await new Promise((res) =>
        new ffmpeg.FfmpegCommand(path)
          .inputOptions('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda')
          .addOptions('-cpu-used', '5')
          .audioCodec('aac')
          .videoCodec('h264_nvenc')
          .on('error', (error) => {
            clearInterval(interval)
            logUpdate(
              `${currentLine}\n${chalk.redBright('Error:')} ${chalk.whiteBright(
                error
              )}`
            )
            res(null)
          })
          .on(
            'progress',
            ({ currentFps, frames, targetSize, timemark, percent }) => {
              const eta = millisecondsToTime(
                calculateEta(startTime, clamp(percent, 0, 100))
              )
              const duration = millisecondsToTime(Date.now() - startTime)
              ln = `[ ] FPS: ${currentFps}\n[ ] Frames: ${frames}\n[ ] Target Size: ${humanFileSize(
                targetSize * 1024
              )}\n[ ] Timemark: ${timemark}\n[ ] Duration: ${duration}\n[ ] ETA: ${eta}`

              progress = percent
            }
          )
          .on('end', () => {
            clearInterval(interval)
            const line = Processed(
              { position: index + 1, total: files.length },
              `${file} (${humanFileSize(stats.size)}) remaning (${humanFileSize(
                totalSize - processedSize
              )})`
            )
            mainPrefix += `\n${line}`
            logUpdate(mainPrefix)
            fs.unlinkSync(path)
            videos.push(newPath)
            res(null)
          })
          .save(newPath)
      )
      clearInterval(interval)
    }

    const groupedVideos: {
      [key: string]: string[]
    } = {}
    for (let video of videos) {
      const date = video.split('/').pop()?.split('_')[0]
      if (!date) continue
      if (!groupedVideos[date]) groupedVideos[date] = []
      groupedVideos[date].push(video)
    }

    if (merge && videos.length > 1) {
      const total = Object.keys(groupedVideos).length
      for (let date in groupedVideos) {
        const position = Object.keys(groupedVideos).indexOf(date) + 1
        const videos = groupedVideos[date]

        if (videos.length === 1) continue
        const mergedPath = videos[0].replace('.mp4', '.merged.mp4')
        const prefix = [
          mainPrefix,
          Processing(
            { position, total },
            `Merging ${videos.length} videos => ${mergedPath}`
          ),
        ].join('\n')

        let totalSize = 0

        let progress = 0
        let ln = ''
        const startTime = Date.now()
        const interval = setInterval(() => {
          logUpdate(loading(`${prefix}\n${ln}\n${progressBar(progress)}`))
        }, 150)
        const ff = new ffmpeg.FfmpegCommand()
        for (let video of videos) {
          ff.input(video)
          totalSize += fs.statSync(video).size
        }
        await new Promise((res, rej) =>
          ff
            .on('error', (error) => {
              logUpdate(
                `${prefix}\n${chalk.redBright('Error:')} ${chalk.whiteBright(
                  error
                )}`
              )
              rej()
            })
            .on('progress', ({ currentFps, frames, targetSize, timemark }) => {
              const percent = (targetSize * 1024 * 100) / totalSize
              const eta = millisecondsToTime(
                calculateEta(startTime, clamp(percent, 0, 100))
              )
              const duration = millisecondsToTime(Date.now() - startTime)
              ln = `[ ] FPS: ${currentFps}\n[ ] Frames: ${frames}\n[ ] Size: ${humanFileSize(
                targetSize * 1024
              )}/${humanFileSize(
                totalSize
              )}\n[ ] Timemark: ${timemark}\n[ ] Duration: ${duration}\n[ ] ETA: ${eta}`

              progress = percent
            })
            .on('end', () => {
              clearInterval(interval)
              const line = Processed(
                { position, total },
                `Merging ${videos.length} videos => ${mergedPath}`
              )
              mainPrefix += `\n${line}`
              logUpdate(mainPrefix)
              for (let video of videos) fs.unlinkSync(video)
              res(null)
            })
            .concat(mergedPath)
        )
        clearInterval(interval)
      }
    }

    const newFolder = pathLib
      .join(process.cwd(), folder.replace('./ts', './' + page))
      .replace(':\\', ':')

    logUpdate(
      `${mainPrefix}\n${chalk.blueBright('Processing:')} ${chalk.whiteBright(
        'Scan and auto tag'
      )}`
    )

    await new Promise((res) => setTimeout(res, 2000))

    await scanFolder(newFolder).catch(() => null)
    await autoTag(newFolder).catch(() => null)

    await waitForJobs(mainPrefix).catch(() => null)

    logUpdate(
      `${mainPrefix}\n${chalk.greenBright('Done:')} ${chalk.whiteBright(
        'Scan and auto tag'
      )}`
    )

    const fileList: string[] = merge
      ? (Object.values(groupedVideos)
          .map((videos) => {
            if (videos.length === 1) return videos[0].split('/').pop()
            else
              return videos[0].split('/').pop()?.replace('.mp4', '.merged.mp4')
          })
          .filter((video) => video) as string[])
      : files.map(({ file }) => file)
    for (let file of fileList) {
      const sceneResponse = await searchVideo({ q: `${file} ${name}` }).catch(
        () => null
      )

      if (sceneResponse?.scenes?.length !== 1) {
        logUpdate(
          `${mainPrefix}\n${chalk.redBright('Error:')} ${chalk.whiteBright(
            'Scene not found'
          )}`
        )
        continue
      }

      const performerResponse = await searchPerformer(name).catch(() => null)
      const performer =
        performerResponse?.count === 1 ? performerResponse.performers[0] : null

      const date = file.split('_')[0]

      logUpdate(`${mainPrefix}\n${chalk.yellow(`Edit scene ${name}`)}`)
      const result = await editScene(sceneResponse.scenes[0].id, {
        title: `${formatDate(file)} - ${name}`,
        url: `https://${page}.com/${name}/`,
        date: date,
        studio_id: sceneResponse.scenes[0].studio?.id ?? '2',
        tag_ids: sceneResponse.scenes[0].tags?.map((tag) => tag.id) ?? ['2'],
        performer_ids: performer
          ? [performer?.id]
          : sceneResponse.scenes[0].performers.map((performer) => performer.id),
      }).catch(() => null)

      if (result) processedFiles.push(file)

      if (result)
        logUpdate(
          `${mainPrefix}\n${
            (chalk.greenBright('Done:'),
            chalk.whiteBright(`Edit scene ${name}`))
          }`
        )
      else
        logUpdate(
          `${mainPrefix}\n${
            (chalk.redBright('Error:'), chalk.whiteBright(`Edit scene ${name}`))
          }`
        )
    }

    if (getFiles(folder).length === 0) fs.rmdirSync(folder)

    prefixes.push(
      Processed(
        { position: index + 1, total: folders.length },
        `${name} => ${files.length} files (${humanFileSize(totalSize)})`
      )
    )
    logUpdate(prefixes.join('\n'))
  }

  console.log(
    chalk.greenBright('Done:'),
    chalk.whiteBright('All files processed')
  )

  return processedFiles
}

export default run
