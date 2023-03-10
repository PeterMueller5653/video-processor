#!/usr/bin/env node
import chalk from 'chalk'
import fs from 'fs'
import logUpdate from 'log-update'
import process from 'process'
import check from './check.js'
import getFapello from './fapello.js'
import processVideos from './index.js'
import parseInstagram from './instagram.js'
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
      chalk.yellow('  -fs,  --full-stats'),
      chalk.whiteBright('  Generate full stats')
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
      chalk.yellow('  -v,   --version'),
      chalk.whiteBright('  Show version')
    )
    console.log(
      chalk.yellow('  -pg,  --page'),
      chalk.whiteBright('    Page name used for url and folder name')
    )
    console.log(
      chalk.yellow('  -i,   --instagram'),
      chalk.whiteBright('  Parse instagram posts')
    )
    console.log(
      chalk.yellow('  -fa,   --fapello'),
      chalk.whiteBright('     Get fapello links')
    )
    console.log(
      chalk.yellow('  -co,   --count'),
      chalk.whiteBright('     Number of posts to parse')
    )
    console.log(
      chalk.yellow('  -o,   --output'),
      chalk.whiteBright('    Output folder')
    )
    console.log(
      chalk.yellow('  -d,   --debug'),
      chalk.whiteBright('    Save debug logs to file')
    )
    console.log(
      chalk.yellow('  -h,   --help'),
      chalk.whiteBright('     Show this help')
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
  const fullStats = args.includes('--full-stats') || args.includes('-fs')
  const doStats =
    fullStats ||
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
  const doInstagram = args.includes('--instagram') || args.includes('-i')
  const doFapello = args.includes('--fapello') || args.includes('-fa')
  const doDebug = args.includes('--debug') || args.includes('-d')

  const page = args.includes('--page')
    ? args[args.indexOf('--page') + 1]
    : args.includes('-pg')
    ? args[args.indexOf('-pg') + 1]
    : null

  const count = args.includes('--count')
    ? args[args.indexOf('--count') + 1]
    : args.includes('-co')
    ? args[args.indexOf('-co') + 1]
    : null

  const output = args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : args.includes('-o')
    ? args[args.indexOf('-o') + 1]
    : null

  logUpdate.done()

  if (doDebug) {
    console.log(chalk.whiteBright('Debug: '), chalk.yellowBright('true\n\n'))
    logUpdate.done()
    fs.writeFileSync('debug.log', '')
  }

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
    await pull(doDebug)
    logUpdate(chalk.greenBright('Finished pulling files'))
    logUpdate.done()
  }

  if (doProcess) {
    if (!page) throw new Error('Page name is required for processing videos')
    logUpdate('Processing videos')
    await processVideos(true, page, doDebug)
    logUpdate(chalk.greenBright('Finished processing videos'))
    logUpdate.done()
  }

  if (doInstagram) {
    if (!page)
      throw new Error('Page name is required for parsing instagram posts')
    logUpdate('Parsing instagram posts')
    await parseInstagram(page, doDebug)
    logUpdate(chalk.greenBright('Finished parsing instagram posts'))
    logUpdate.done()
  }

  if (doFapello) {
    if (!page) throw new Error('Page name is required for fapello links')
    logUpdate('Getting fapello links')
    await getFapello({
      username: page,
      count: Number(count) ?? 1,
      output: output,
      debug: doDebug,
    })
    logUpdate(chalk.greenBright('Finished getting fapello links'))
    logUpdate.done()
  }

  if (doStats) {
    logUpdate('Generating stats')
    await stats(fullStats)
    logUpdate(chalk.greenBright('Finished generating stats'))
    logUpdate.done()
  }
}

main()
