#!/usr/bin/env node
import chalk from 'chalk'
import logUpdate from 'log-update'
import process from 'process'
import check from './check.js'
import processVideos from './index.js'
import pull from './pull.js'
import stats from './stats.js'

const main = async () => {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(chalk.whiteBright('Usage: [options]'))
    console.log(chalk.whiteBright('Options:'))
    console.log(
      chalk.yellow('  -p,   --pull'),
      chalk.whiteBright('     Pull files from pi.hole')
    )
    console.log(
      chalk.yellow('  -pr,  --process'),
      chalk.whiteBright('  Process videos')
    )
    console.log(
      chalk.yellow('  -s,   --stats'),
      chalk.whiteBright('    Generate stats')
    )
    console.log(
      chalk.yellow('  -c,   --check'),
      chalk.whiteBright('    Check for files to pull')
    )
    console.log(
      chalk.yellow('  -f,   --full'),
      chalk.whiteBright('     Pull files, process videos, and generate stats')
    )
    console.log(
      chalk.yellow('  -h,   --help'),
      chalk.whiteBright('     Show this help')
    )
    console.log(
      chalk.yellow('  -v,   --version'),
      chalk.whiteBright('  Show version')
    )
    console.log(
      chalk.yellow('  -pg,  --page'),
      chalk.whiteBright('    Page name used for url and folder name')
    )
    process.exit(0)
  }

  const doPull =
    args.includes('--pull') ||
    args.includes('-p') ||
    args.includes('--full') ||
    args.includes('-f')
  const doProcess =
    args.includes('--process') ||
    args.includes('-pr') ||
    args.includes('--full') ||
    args.includes('-f')
  const doStats =
    args.includes('--stats') ||
    args.includes('-s') ||
    args.includes('--full') ||
    args.includes('-f')
  const doCheck =
    args.includes('--check') ||
    args.includes('-c') ||
    args.includes('--full') ||
    args.includes('-f')
  const doVersion =
    args.includes('--version') ||
    args.includes('-v') ||
    args.includes('--full') ||
    args.includes('-f')

  const page =
    args.includes('--page') || args.includes('-pg')
      ? args[args.indexOf('--page') + 1]
      : ''

  logUpdate.done()

  if (doVersion) {
    console.log(chalk.whiteBright('Version: '), chalk.yellowBright('1.0.0\n\n'))
    logUpdate.done()
  }

  if (doCheck && !doPull) {
    logUpdate('Checking for files to pull')
    await check()
    logUpdate(chalk.greenBright('Finished checking for files to pull'))
    logUpdate.done()
  }

  if (doPull) {
    logUpdate('Pulling files')
    await pull()
    logUpdate(chalk.greenBright('Finished pulling files'))
    logUpdate.done()
  }

  if (doProcess) {
    logUpdate('Processing videos')
    await processVideos(true, page)
    logUpdate(chalk.greenBright('Finished processing videos'))
    logUpdate.done()
  }

  if (doStats) {
    logUpdate('Generating stats')
    await stats()
    logUpdate(chalk.greenBright('Finished generating stats'))
    logUpdate.done()
  }
}

main()
