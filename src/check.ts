import chalk from 'chalk'
import logUpdate from 'log-update'
import Client from 'ssh2-sftp-client'
import { humanFileSize } from './utils.js'

const mainPath = '/media/pi/rec/rec'

const sftp = new Client()

const main = async () => {
  logUpdate(chalk.blue('Connecting to pi.hole...'))
  await sftp.connect({
    host: 'pi.hole',
    port: 22,
    username: 'pi',
    password: 'raspberry',
  })

  logUpdate(chalk.blue('Loading folders...'))

  const folders = await sftp.list(mainPath)

  for (const folder of folders.filter((folder) => folder.type === 'd')) {
    logUpdate(chalk.blue(`Loading files in ${chalk.yellow(folder.name)}`))

    const files = await sftp.list(`${mainPath}/${folder.name}`)
    let fileCount = 0

    for (const file of files.filter(
      (file) =>
        file.type !== 'd' && file.modifyTime < Date.now() - 1000 * 60 * 5
    )) {
      logUpdate.done()
      logUpdate(
        chalk.blue(
          `${chalk.yellow(
            `${file.name} (${humanFileSize(file.size)})`
          )} ready to be pulled`
        )
      )
      fileCount++
    }

    if (
      files.filter(
        (file) =>
          file.type !== 'd' && file.modifyTime > Date.now() - 1000 * 60 * 5
      ).length !== 0
    ) {
      logUpdate.done()
      logUpdate(
        chalk.blue(
          `There are still files in ${chalk.yellow(
            folder.name
          )} that are being recorded`
        )
      )
    }

    if (fileCount !== 0) logUpdate.done()
  }

  logUpdate(chalk.greenBright('Finished checking files'))
  sftp.end()
}

export default main
