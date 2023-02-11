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
  getDirectories,
  getFiles,
  getMemoryUsageHumanForProcess,
  getMemoryUsageInPercentForProcess,
  getTimeInSeconds,
  humanFileSize,
  loading,
  millisecondsToTime,
  progressBar
} from './utils.js'

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
      logUpdate(prefixes.join('\n'))
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
      let memoryPercent = '0.0000%'
      let memoryHuman = '0.00 B'
      const interval = setInterval(() => {
        logUpdate(loading(`${currentLine}\n${ln}\n${progressBar(progress)}`))
        getMemoryUsageInPercentForProcess('ffmpeg').then((mem) => {
          memoryPercent = mem
        })
        getMemoryUsageHumanForProcess('ffmpeg').then((mem) => {
          memoryHuman = mem
        })
      }, 150)
      log(`Processing ${path} => ${newPath}`)
      await new Promise((res) =>
        ffmpeg(path)
          .inputOptions('-hwaccel', 'cuda')
          .addOptions('-cpu-used', '5')
          .audioCodec('aac')
          .videoCodec('h264_nvenc')
          .on('start', (commandLine) => {
            log(`Started: ${commandLine}`)
          })
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
            async ({ currentFps, frames, targetSize, timemark, percent }) => {
              const eta = millisecondsToTime(
                calculateEta(startTime, clamp(percent, 0, 100))
              )
              const duration = millisecondsToTime(Date.now() - startTime)
              ln = `[ ] FPS: ${currentFps}\n[ ] Frames: ${frames}\n[ ] Target Size: ${humanFileSize(
                targetSize * 1024
              )}\n[ ] Timemark: ${timemark}\n[ ] Duration: ${duration}\n[ ] ETA: ${eta}\n[ ] Memory: ${memoryHuman} (${memoryPercent})`

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

    const mergeGroups: {
      [key: string]: {
        video: string
        duration: number
        created: Date
      }[]
    } = {}
    for (let video of [...videos].sort(
      (a, b) =>
        formatDate(a.split('/').pop() ?? '').getTime() -
        formatDate(b.split('/').pop() ?? '').getTime()
    )) {
      const [date, rest] = video.split('/').pop()?.split('_') ?? []
      if (!date) continue

      const duration = await new Promise<number>((res) => {
        ffmpeg.ffprobe(video, (err, metadata) => {
          if (err) return res(0)
          res(metadata.format.duration ?? 0)
        })
      })
      const created = formatDate(`${date}_${rest}`)
      log(
        date,
        `Duration: ${duration} Created: ${created.toISOString()} End: ${new Date(
          created.getTime() + duration * 1000
        ).toISOString()} End + 25: ${new Date(
          created.getTime() + (duration + 25 * 60) * 1000
        ).toISOString()}`
      )
      log(
        date,
        'Raw Times Current:',
        duration * 1000,
        created.getTime(),
        duration * 1000 + created.getTime()
      )

      const [key, lastMergeGroup] = Object.entries(mergeGroups).pop() ?? []
      const lastEndTime25 = new Date(
        ([...(lastMergeGroup ?? [])].pop()?.created.getTime() ?? 0) +
          (duration + 25 * 60) * 1000
      )
      log(date, key, JSON.stringify(lastMergeGroup))
      log(
        date,
        'End Last (+25) -> Start Current:',
        lastEndTime25.toISOString(),
        created.toISOString()
      )
      if (
        key &&
        lastMergeGroup &&
        lastMergeGroup.length > 0 &&
        lastEndTime25.getTime() > created.getTime()
      ) {
        mergeGroups[key].push({ video, duration, created })
        log(date, `Added ${video} to ${key}`)
      } else {
        const newKey = `${created.toISOString()}_${Math.random()
          .toString(36)
          .substring(2, 15)}`
        mergeGroups[newKey] = [{ video, duration, created }]
        log(date, `Created new group ${newKey} for ${video}`)
      }
    }

    if (merge && videos.length > 1) {
      const total = Object.keys(mergeGroups).filter(
        (g) => mergeGroups[g].length > 1
      ).length
      for (let group in mergeGroups) {
        const position =
          Object.keys(mergeGroups)
            .filter((g) => mergeGroups[g].length > 1)
            .indexOf(group) + 1
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
        let memoryPercent = '0.000%'
        let memoryHuman = '0.00 B'
        const startTime = Date.now()
        const interval = setInterval(() => {
          logUpdate(loading(`${prefix}\n${ln}\n${progressBar(progress)}`))
          getMemoryUsageHumanForProcess('ffmpeg').then((memory) => {
            memoryHuman = memory
          })
          getMemoryUsageInPercentForProcess('ffmpeg').then((percent) => {
            memoryPercent = percent
          })
        }, 150)
        const mergeTxt = mergedPath.replace('.mp4', '.txt')
        await new Promise((res) => fs.writeFile(mergeTxt, '', res))
        for (let { video, duration } of [...videos].sort(
          (a, b) => a.created.getTime() - b.created.getTime()
        )) {
          totalDuration += duration
          await new Promise((res) =>
            fs.appendFile(mergeTxt, `file '${video.split('/').pop()}'\n`, res)
          )
        }
        log(`Merging ${videos.length} videos => ${mergedPath}`)
        await new Promise((res, rej) =>
          ffmpeg(mergeTxt)
            .addInputOptions('-f', 'concat', '-safe', '0')
            .addOptions('-c', 'copy')
            .on('start', (commandLine) => {
              log(`Spawned Ffmpeg with command: ${commandLine}`)
              log(
                `Merge.txt content: ${fs
                  .readFileSync(mergeTxt, 'utf-8')
                  .toString()}`
              )
            })
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
              )}\n[ ] Timemark: ${timemark}\n[ ] Duration: ${duration}\n[ ] ETA: ${eta}\n[ ] Memory: ${memoryHuman} (${memoryPercent})`

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
            .output(mergedPath)
            .run()
        )
        await new Promise((res) => fs.unlink(mergeTxt, res))
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

    log(`Start scan and auto tag in ${newFolder}`)

    await new Promise((res) => setTimeout(res, 2000))

    await scanFolder(newFolder).catch(() => null)
    await autoTag(newFolder).catch(() => null)

    await waitForJobs(mainPrefix).catch(() => null)

    log(`Done scan and auto tag in ${newFolder}`)

    logUpdate(
      `${mainPrefix}\n${chalk.greenBright('Done:')} ${chalk.whiteBright(
        'Scan and auto tag'
      )}`
    )

    const fileList: string[] = merge
      ? (Object.values(mergeGroups)
          .map((videos) => {
            if (videos.length === 1) return videos[0].video.split('/').pop()
            else
              return videos[0].video
                .split('/')
                .pop()
                ?.replace('.mp4', '.merged.mp4')
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

  logUpdate.done()

  return processedFiles
}

export default run
