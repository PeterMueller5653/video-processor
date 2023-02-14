import chalk from 'chalk'
import childProcess from 'child_process'
import fs from 'fs'
import os from 'os'
import pathLib from 'path'
import process from 'process'
import { promisify } from 'util'

const exec = promisify(childProcess.exec)

let cpuUsage = process.cpuUsage()

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
    monthNames[date.getMonth() - 1]
  } ${date.getFullYear()} ${hours}:${minutes}:${seconds}`
}

export function dateToTimeString(date: Date, format?: string): string {
  const hours =
    date.getHours() > 9 ? date.getHours().toString() : `0${date.getHours()}`
  const minutes =
    date.getMinutes() > 9
      ? date.getMinutes().toString()
      : `0${date.getMinutes()}`
  const seconds =
    date.getSeconds() > 9
      ? date.getSeconds().toString()
      : `0${date.getSeconds()}`
  const milliseconds =
    date.getMilliseconds() > 99
      ? date.getMilliseconds().toString()
      : date.getMilliseconds() > 9
      ? `0${date.getMilliseconds()}`
      : `00${date.getMilliseconds()}`
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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

  const timeFormat = format || 'hh:mm:ss'

  const dayOfWeek = new Date(year, month - 1, day).getDay()

  return timeFormat
    .replace(/hh/g, hours)
    .replace(/mm/g, minutes)
    .replace(/ss/g, seconds)
    .replace(/SSS/g, milliseconds)
    .replace(/MMM/g, monthNames[month - 1])
    .replace(/MM/g, month.toString().padStart(2, '0'))
    .replace(/M/g, month.toString())
    .replace(/ddd/g, dayNames[dayOfWeek])
    .replace(/dd/g, day.toString().padStart(2, '0'))
    .replace(/ d/g, ` ${day}`)
    .replace(/yyyy/g, year.toString())
}

export function formatDate(string: string): Date {
  const [date, time] = string.replace(/(\.mp4|\.merged\.mp4)/g, '').split('_')

  const [year, month, day] = date.split('-')
  const [hour, minute, second] = time.split('-')
  return new Date(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
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

export function secondsToTime(seconds: number, fixed: boolean = false): string {
  const days = Math.floor(seconds / (3600 * 24))
  const hours = Math.floor(seconds / 3600) % 24
  const minutes = Math.floor(seconds / 60) % 60
  const secondsLeft = Math.floor(seconds % 60)

  if (fixed)
    return `${(hours + days * 24).toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secondsLeft.toString().padStart(2, '0')}`

  return `${days}d ${hours}h ${minutes}m ${secondsLeft}s`
}

export function getWeekNumber(date: Date): number {
  const d = new Date(+date)
  d.setHours(0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  return Math.ceil(
    ((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 8.64e7 + 1) / 7
  )
}

export function getWeekStartDate(date: Date): Date {
  const d = new Date(+date)
  d.setHours(0, 0, 0)
  d.setDate(d.getDate() + 7 - (d.getDay() || 7))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6)
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

export function getTimeInSeconds(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

export function getCpuUsageInPercent(): string {
  const newCpuUsage = process.cpuUsage()
  const cpuUsageDelta = {
    user: newCpuUsage.user - cpuUsage.user,
    system: newCpuUsage.system - cpuUsage.system,
  }
  cpuUsage = newCpuUsage
  return (
    (
      ((cpuUsageDelta.user + cpuUsageDelta.system) /
        (os.cpus().length * 1000000)) *
      100
    ).toFixed(4) + '%'
  )
}

export function getMemoryUsageHuman(): string {
  return humanFileSize(process.memoryUsage().rss)
}

export function getMemoryUsageInPercent(): string {
  return ((process.memoryUsage().rss / os.totalmem()) * 100).toFixed(4) + '%'
}

let lastMemoryCheck = 0
let lastMemory = 0
export async function getMemoryUsageHumanForProcess(
  process: string
): Promise<string> {
  if (lastMemoryCheck + 1000 > Date.now()) return humanFileSize(lastMemory)
  lastMemoryCheck = Date.now()
  const { stdout } = await exec(
    `tasklist /fi "imagename eq ${process}.exe" /fo csv /nh`
  )

  let totalMemory = 0

  stdout.split('\n').forEach((line) => {
    if (line.includes(process)) {
      const memory = line.split(',')[4].replace(/"/g, '')
      totalMemory += parseInt(memory)
    }
  })
  lastMemory = totalMemory * 1000 * 1024
  return humanFileSize(totalMemory * 1000 * 1024)
}

export async function getMemoryUsageInPercentForProcess(
  process: string
): Promise<string> {
  if (lastMemoryCheck + 1000 > Date.now())
    return ((lastMemory / os.totalmem()) * 100).toFixed(4) + '%'
  lastMemoryCheck = Date.now()
  const { stdout } = await exec(
    `tasklist /fi "imagename eq ${process}.exe" /fo csv /nh`
  )

  let totalMemory = 0

  stdout.split('\n').forEach((line) => {
    if (line.includes(process)) {
      const memory = line.split(',')[4].replace(/"/g, '')
      totalMemory += parseInt(memory)
    }
  })
  lastMemory = totalMemory * 1000 * 1024
  return (((totalMemory * 1000 * 1024) / os.totalmem()) * 100).toFixed(4) + '%'
}

export function getDirectories(source: string): {
  folder: string
  name: string
}[] {
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => ({
      folder: `${source}/${dirent.name}`,
      name: dirent.name,
    }))
}

export function getFiles(source: string): {
  dir: string
  file: string
  stats: fs.Stats
}[] {
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter((file) => file.isFile())
    .map((file) => ({
      dir: source,
      file: file.name,
      stats: fs.statSync(pathLib.join(source, file.name)),
    }))
}
