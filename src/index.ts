import chalk from 'chalk'
import ffmpeg from 'fluent-ffmpeg'
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
  dateToString,
  dateToTimeString,
  formatDate,
  getTimeInSeconds,
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

const Skipped = (
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
    `[${chalk.yellowBright('!')}] ` +
    chalk.yellowBright(
      `Skipped [${position}/${total}]:`,
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

async function run(
  merge: boolean = false,
  page: string,
  debug: boolean = false
): Promise<string[]> {
  const log = (...message: any[]) => {
    if (debug)
      fs.appendFileSync(
        './debug.log',
        `[PROCESS] [${dateToTimeString(
          new Date(),
          'hh:mm:ss.SSS'
        )}] ${message.join(' ')}\n`
      )
  }

  const processedFiles: string[] = []
  const folders = getDirectories('./ts')
  const prefixes: string[] = []
  for (let [index, { folder, name }] of folders.entries()) {
    const rawFiles = getFiles(folder)
    const files = rawFiles
      .filter((f) => f.file.endsWith('.ts') || f.file.endsWith('.mp4'))
      .map((f) => ({
        ...f,
        stats: fs.statSync(pathLib.join(f.dir, f.file)),
      }))

    if (rawFiles.filter((f) => f.file === '.skip').length > 0) {
      log(`Skipping ${name} because of .skip file`)
      prefixes.push(
        Skipped({ position: index + 1, total: folders.length }, name)
      )
      continue
    }

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
      log(`Processing ${path} => ${newPath}`)
      await new Promise((res) =>
        ffmpeg(path)
          .inputOptions('-hwaccel', 'cuda')
          .addOptions('-cpu-used', '5')
          .audioCodec('aac')
          .videoCodec('h264_nvenc')
          .on('error', (error) => {
            clearInterval(interval)
            mainPrefix += `${currentLine}\n${chalk.redBright(
              'Error:'
            )} ${chalk.whiteBright(error)}`
            logUpdate(mainPrefix)
            log(`Error: ${error}`)
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
            log(`Processed ${path} => ${newPath}`)
            res(null)
          })
          .save(newPath)
      )
      clearInterval(interval)
    }

    const groupedVideos: {
      [key: string]: string[]
    } = {}

    const mergeGroups: {
      [key: string]: {
        video: string
        duration: number
        created: Date
      }[]
    } = {}
    for (let video of videos) {
      const [date, rest] = video.split('/').pop()?.split('_') ?? []
      if (!date) continue
      if (!groupedVideos[date]) groupedVideos[date] = []
      groupedVideos[date].push(video)

      const duration = await new Promise<number>((res) => {
        ffmpeg.ffprobe(video, (err, metadata) => {
          if (err) return res(0)
          res(metadata.format.duration ?? 0)
        })
      })
      const created = formatDate(`${date}_${rest}`)
      log(
        `Duration: ${duration} Created: ${created.toISOString()} End: ${new Date(
          created.getTime() + duration * 1000
        ).toISOString()}`
      )
      log(
        duration * 1000,
        created.getTime(),
        duration * 1000 + created.getTime()
      )

      const [key, lastMergeGroup] = Object.entries(mergeGroups).pop() ?? []
      log(key, JSON.stringify(lastMergeGroup))
      if (
        key &&
        lastMergeGroup &&
        lastMergeGroup.length > 0 &&
        lastMergeGroup.reverse()[0].created.getTime() +
          (duration + 5 * 60) * 1000 >
          created.getTime()
      ) {
        mergeGroups[key].push({ video, duration, created })
        log(`Added ${video} to ${key}`)
      } else {
        const newKey = `${created.toISOString()}_${Math.random()
          .toString(36)
          .substring(2, 15)}`
        mergeGroups[newKey] = [{ video, duration, created }]
        log(`Created new group ${newKey} for ${video}`)
      }
    }

    if (merge && videos.length > 1) {
      const total = Object.keys(mergeGroups).filter(
        (g) => mergeGroups[g].length > 1
      ).length
      for (let group in mergeGroups) {
        const position = Object.keys(mergeGroups).indexOf(group) + 1
        const videos = mergeGroups[group]

        if (videos.length === 1) continue
        const mergedPath = videos[0].video.replace('.mp4', '.merged.mp4')
        const prefix = [
          mainPrefix,
          Processing(
            { position, total },
            `Merging ${videos.length} videos => ${mergedPath}`
          ),
        ].join('\n')

        let totalDuration = 0

        let progress = 0
        let ln = ''
        const startTime = Date.now()
        const interval = setInterval(() => {
          logUpdate(loading(`${prefix}\n${ln}\n${progressBar(progress)}`))
        }, 150)
        const ff = ffmpeg()
        for (let { video, duration } of videos) {
          ff.input(video)
          totalDuration += duration
        }
        log(`Merging ${videos.length} videos => ${mergedPath}`)
        await new Promise((res, rej) =>
          ff
            .on('error', (error) => {
              log(`Error: ${error}`)
              logUpdate(
                `${prefix}\n${chalk.redBright('Error:')} ${chalk.whiteBright(
                  error
                )}`
              )
              rej()
            })
            .on('progress', ({ currentFps, frames, targetSize, timemark }) => {
              const percent = (getTimeInSeconds(timemark) / totalDuration) * 100
              const eta = millisecondsToTime(
                calculateEta(startTime, clamp(percent, 0, 100))
              )
              const duration = millisecondsToTime(Date.now() - startTime)
              ln = `[ ] FPS: ${currentFps}\n[ ] Frames: ${frames}\n[ ] Size: ${humanFileSize(
                targetSize * 1024
              )}\n[ ] Timemark: ${timemark}\n[ ] Duration: ${duration}\n[ ] ETA: ${eta}`

              progress = percent
            })
            .on('end', () => {
              log(`Merged ${videos.length} videos => ${mergedPath}`)
              clearInterval(interval)
              const line = Processed(
                { position, total },
                `Merging ${videos.length} videos => ${mergedPath}`
              )
              mainPrefix += `\n${line}`
              logUpdate(mainPrefix)
              for (let video of videos) fs.unlinkSync(video.video)
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

      log(`Scene response: ${JSON.stringify(sceneResponse)}`)

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

      log(`Performer response: ${JSON.stringify(performerResponse)}`)

      const date = file.split('_')[0]

      logUpdate(`${mainPrefix}\n${chalk.yellow(`Edit scene ${name}`)}`)
      const result = await editScene(sceneResponse.scenes[0].id, {
        title: `${dateToString(formatDate(file))} - ${name}`,
        url: `https://${page}.com/${name}/`,
        date: date,
        studio_id: sceneResponse.scenes[0].studio?.id ?? '2',
        tag_ids: sceneResponse.scenes[0].tags?.map((tag) => tag.id) ?? ['2'],
        performer_ids: performer
          ? [performer?.id]
          : sceneResponse.scenes[0].performers.map((performer) => performer.id),
      }).catch((error) => {
        log(`Edit Scene Error: ${error}`)
        return false
      })

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
