import chalk from 'chalk'
import fs from 'fs'
import logUpdate from 'log-update'
import Client from 'ssh2-sftp-client'
import {
  dateToTimeString,
  getCpuUsageInPercent,
  getMemoryUsageHuman,
  getMemoryUsageInPercent,
  humanFileSize,
  loading,
  progressBar,
  secondsToTime
} from './utils.js'

const mainPath = '/media/pi/rec/rec'

const sftp = new Client()

const main = async (debug: boolean = false) => {
  const log = (message: string) => {
    if (debug)
      fs.appendFileSync(
        './debug.log',
        `[PULL] [${dateToTimeString(new Date(), 'hh:mm:ss.SSS')}] ${message}\n`
      )
  }

  logUpdate(chalk.blue('Connecting to pi.hole...'))
  await sftp
    .connect({
      host: 'pi.hole',
      port: 22,
      username: 'pi',
      password: 'raspberry',
    })
    .catch((err) => {
      log(`Error connecting to pi.hole: ${err}`)
      logUpdate(chalk.red('Error connecting to pi.hole'))
      logUpdate.done()
      return
    })

  logUpdate(chalk.blue('Loading folders...'))

  const folders = await sftp.list(mainPath)

  let totalFileSize = 0
  let downloaded = 0
  const filesToPull: string[] = []
  let skipping = 0

  for (const folder of folders.filter((folder) => folder.type === 'd')) {
    logUpdate(chalk.blue(`Loading files in ${chalk.yellow(folder.name)}`))

    const files = await sftp.list(`${mainPath}/${folder.name}`)

    const filtered = files.filter(
      (file) =>
        file.type !== 'd' && file.modifyTime < Date.now() - 1000 * 60 * 5
    )

    if (fs.existsSync(`./ts/${folder.name}/.skip`))
      fs.unlinkSync(`./ts/${folder.name}/.skip`)

    if (files.length !== filtered.length) {
      logUpdate(
        chalk.blue(
          `Mark ${chalk.yellow(
            folder.name
          )} to be skipped processing because it still has files being recorded`
        )
      )
      logUpdate.done()
      fs.mkdirSync(`./ts/${folder.name}`, { recursive: true })
      fs.writeFileSync(`./ts/${folder.name}/.skip`, '')
      log(
        `Marked ${folder.name} to be skipped processing because it still has files being recorded`
      )
      skipping++
    }

    for (const file of filtered) {
      logUpdate(chalk.blue(`Adding ${chalk.yellow(file.name)} to pull list`))
      filesToPull.push(`${mainPath}/${folder.name}/${file.name}`)
      totalFileSize += file.size
      log(`Added ${file.name} to pull list`)
    }

    logUpdate(
      chalk.blue(`Added ${chalk.yellow(filesToPull.length)} files to pull list`)
    )
  }

  const totalStart = Date.now()

  for (const file of filesToPull) {
    const index = filesToPull.indexOf(file) + 1
    const fileCount = filesToPull.length

    const fileName = file.split('/').reverse()[0]
    const fileFolder = file.split('/').reverse()[1]

    const fileStats = await sftp.stat(file)

    logUpdate(chalk.blue(`Pulling ${file}`))

    if (
      !fs.existsSync(file.replace(mainPath, './ts').replace(/\/[^\/]*$/, ''))
    ) {
      logUpdate(chalk.blue(`Creating ${chalk.yellow(fileFolder)}`))
      log(`Creating ${fileFolder}`)
      fs.mkdirSync(file.replace(mainPath, './ts').replace(/\/[^\/]*$/, ''), {
        recursive: true,
      })
    }

    const start = Date.now()
    let lastFrame = 0

    const step = (totalTransferred: number, _: number, total: number) => {
      if (Date.now() - lastFrame > 20) {
        lastFrame = Date.now()
        const size = `[ ] Current: ${humanFileSize(
          totalTransferred
        )} / ${humanFileSize(total)}`
        const speed = `[ ] Speed: ${humanFileSize(
          totalTransferred === 0
            ? 0
            : (totalTransferred / (Date.now() - start)) * 1000
        )}/s`
        const duration = `[ ] Duration: ${secondsToTime(
          (Date.now() - start) / 1000
        )}`
        const eta = `[ ] ETA: ${
          totalTransferred === 0
            ? secondsToTime(0)
            : `${secondsToTime(
                (((total - totalTransferred) / totalTransferred) *
                  (Date.now() - start)) /
                  1000
              )}`
        }`
        const progress = progressBar((totalTransferred / total) * 100)

        const cpuUsage = `[ ] CPU Usage: ${getCpuUsageInPercent()}`
        const memoryUsage = `[ ] Memory Usage: ${getMemoryUsageHuman()} (${getMemoryUsageInPercent()})`
        const totalSize = `[ ] Total: ${humanFileSize(
          downloaded + totalTransferred
        )} / ${humanFileSize(totalFileSize)}`
        const totalDuration = `[ ] Total Duration: ${secondsToTime(
          (Date.now() - totalStart) / 1000
        )}`
        const totalEta = `[ ] Total ETA: ${secondsToTime(
          (((totalFileSize - downloaded - totalTransferred) /
            totalTransferred) *
            (Date.now() - start)) /
            1000
        )}`
        const totalProgress = progressBar(
          ((downloaded + totalTransferred) / totalFileSize) * 100
        )

        logUpdate(
          loading(
            `[ ] ${chalk.blue(
              `Downloading [${index}/${fileCount}] ${chalk.yellow(
                `${fileFolder}/${fileName}`
              )}`
            )}\n${size}\n${speed}\n${duration}\n${eta}\n${progress}\n${cpuUsage}\n${memoryUsage}\n${totalSize}\n${totalDuration}\n${totalEta}\n${totalProgress}`
          )
        )
      }
    }

    const path = file.replace(mainPath, './ts').replace('.mp4', '.mp4.part')
    await sftp
      .fastGet(file, path, {
        concurrency: Math.floor(
          12 / (skipping > 0 ? (skipping > 1 ? (skipping > 2 ? 8 : 4) : 2) : 1)
        ),
        chunkSize: 1024 * 1024,
        step,
      })
      .then(async () => {
        logUpdate(chalk.blue(`Renaming ${chalk.yellow(file)}`))
        fs.renameSync(path, path.replace('.part', ''))
        logUpdate(chalk.blue(`Deleting ${chalk.yellow(file)}`))
        downloaded += fileStats.size
        await sftp.delete(file)
        log(`Pulled and deleted ${file}`)
        logUpdate(
          `[${chalk.greenBright('✓')}] ${chalk.green(
            `Downloaded [${index}/${fileCount}] ${chalk.yellow(
              `${fileFolder}/${fileName}`
            )}`
          )}`
        )
        logUpdate.done()
      })
      .catch((error) => {
        log(`Failed to pull ${file} because ${error}`)
        logUpdate(
          `[${chalk.redBright('✗')}] ${chalk.red(
            `Donwload failed [${index}/${fileCount}] ${chalk.yellow(
              `${fileFolder}/${fileName}`
            )}`
          )}`
        )
        logUpdate.done()
      })
  }

  logUpdate(chalk.greenBright('Finished pulling files'))

  await sftp.end()
}

export default main
