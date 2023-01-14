import chalk from 'chalk'

const frameString = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
let frameIndex = 0
let lastFrame = Date.now()

export function dateToString(date: Date): string {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  const hours = date.getHours() > 9 ? date.getHours() : `0${date.getHours()}`
  const minutes =
    date.getMinutes() > 9 ? date.getMinutes() : `0${date.getMinutes()}`
  const seconds =
    date.getSeconds() > 9 ? date.getSeconds() : `0${date.getSeconds()}`

  return `${date.getDate()} ${
    monthNames[date.getMonth()]
  } ${date.getFullYear()} ${hours}:${minutes}:${seconds}`
}

export function formatDate(string: string): string {
  const [date, time] = string.replace(/(\.mp4|\.merged\.mp4)/g, '').split('_')

  const [year, month, day] = date.split('-')
  const [hour, minute, second] = time.split('-')
  return dateToString(
    new Date(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  )
}

export function calculateEta(startTime: number, percentage: number): number {
  const now = Date.now()
  const timeElapsed = now - startTime
  const timeLeft = (timeElapsed / percentage) * (100 - percentage)
  return timeLeft
}

export function millisecondsToTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  return `${hours}h ${minutes % 60}m ${seconds % 60}s`
}

export function secondsToTime(seconds: number): string {
  const days = Math.floor(seconds / (3600 * 24))
  const hours = Math.floor(seconds / 3600) % 24
  const minutes = Math.floor(seconds / 60) % 60
  const secondsLeft = Math.floor(seconds % 60)

  return `${days}d ${hours}h ${minutes}m ${secondsLeft}s`
}

export function humanFileSize(size: number): string {
  var i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024))
  return (
    (size / Math.pow(1024, i)).toFixed(2) +
    ' ' +
    ['B', 'kB', 'MB', 'GB', 'TB'][i]
  )
}

export function floorWithPrecision(num: number, precision: number): number {
  return Math.floor(num * Math.pow(10, precision)) / Math.pow(10, precision)
}

export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max)
}

export function progressBar(percent: number): string {
  const clampedPercent = clamp(percent, 0, 100)
  const barLength =
    process.stdout.columns -
    7 -
    Math.max(`${floorWithPrecision(clampedPercent, 1)}%`.length, 5)
  const filledLength = Math.floor((barLength * clampedPercent) / 100)
  const bar =
    chalk.greenBright('='.repeat(filledLength)) +
    ' '.repeat(barLength - filledLength)
  return `[ ] [${bar}] ${floorWithPrecision(clampedPercent, 1)}%`
}

export function loading(line: string, index?: number): string {
  if (frameIndex >= frameString.length) frameIndex = 0
  const fIndex =
    lastFrame + 100 < Date.now() ? index ?? frameIndex++ : index ?? frameIndex
  if (lastFrame + 100 < Date.now()) lastFrame = Date.now()
  return line.replace(/\[ \]/g, `[${chalk.yellow(frameString[fIndex])}]`)
}
