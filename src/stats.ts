import * as asciichart from 'asciichart'
import csv from 'csvtojson'
import fs from 'fs'
// @ts-ignore
import jsonToMarkdownTable from 'json-to-markdown-table'
import { Parser as Json2csvParser } from 'json2csv'
import logUpdate from 'log-update'
import { searchVideo } from './graphqlFunctions.js'
import {
  dateToTimeString,
  getWeekStartDate,
  humanFileSize,
  secondsToTime
} from './utils.js'

const filePath = './stats/stats.csv'

const fields = [
  'date',
  'averageSize',
  'averageDuration',
  'averageCount',
  'totalSize',
  'totalDuration',
  'totalCount',
]

const parseDate = (dateString: string): Date => {
  const date = new Date()
  const [year, month, day] = dateString.split('-')
  date.setFullYear(Number(year))
  date.setMonth(Number(month) - 1)
  date.setDate(Number(day))
  return date
}

const appendDataToCSVFile = async (data: {
  [key: string]: any
}): Promise<{ [key: string]: any }[]> => {
  const csvFilePath = filePath
  const csvData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value.toString()])
  )
  const parser = new Json2csvParser({ fields })

  if (!fs.existsSync(csvFilePath)) {
    fs.mkdirSync('./stats', { recursive: true })
    fs.writeFileSync(csvFilePath, '')
  }

  const jsonObj = await csv().fromFile(csvFilePath)

  const index = jsonObj.findIndex((obj) => obj.date === csvData.date)
  if (index !== -1) jsonObj[index] = csvData
  else jsonObj.push(csvData)

  const markdown = jsonToMarkdownTable(jsonObj, fields)

  fs.writeFileSync(csvFilePath, parser.parse(jsonObj))
  fs.writeFileSync(
    csvFilePath.replace('.csv', '.md'),
    `# Stats\n\n## 14 Day span\n\n${markdown}`
  )

  return jsonObj
}

const main = async () => {
  const dateGroups: {
    [key: string]: {
      size: number
      files: { size: number; [key: string]: any }[]
      duration: number
      count: number
      parsedSize?: string
      parsedDuration?: string
    }
  } = {}

  const sceneResult = await searchVideo({
    sort: 'date',
    direction: 'DESC',
    per_page: 1000,
  })

  if (!sceneResult) return

  const latestDate = parseDate(sceneResult.scenes[0].date ?? '2020-01-01')

  sceneResult.scenes
    .filter((scene) => {
      if (!scene.date) return false
      const sceneDate = parseDate(scene.date)
      const diff = Math.abs(Number(latestDate) - Number(sceneDate))
      return diff < 1000 * 60 * 60 * 24 * 27
    })
    .forEach((scene) => {
      const date = scene.date as string
      if (!dateGroups[date]) {
        dateGroups[date] = {
          size: 0,
          files: [],
          duration: 0,
          count: 0,
        }
      }
      dateGroups[date].size += scene.files[0].size
      dateGroups[date].files.push(...scene.files)
      dateGroups[date].duration += scene.files[0].duration
      dateGroups[date].count++
    })

  Object.keys(dateGroups).forEach((date) => {
    dateGroups[date].parsedSize = humanFileSize(dateGroups[date].size)
    dateGroups[date].parsedDuration = secondsToTime(dateGroups[date].duration)
  })

  const average: {
    size: number
    duration: number
    count: number
    parsedSize?: string
    parsedDuration?: string
  } = {
    size: 0,
    duration: 0,
    count: 0,
  }

  const total: {
    size: number
    duration: number
    count: number
    parsedSize?: string
    parsedDuration?: string
  } = {
    size: 0,
    duration: 0,
    count: 0,
  }

  Object.keys(dateGroups).forEach((date) => {
    average.size += dateGroups[date].size
    average.duration += dateGroups[date].duration
    average.count += dateGroups[date].count

    total.size += dateGroups[date].size
    total.duration += dateGroups[date].duration
    total.count += dateGroups[date].count
  })

  average.size /= Object.keys(dateGroups).length
  average.duration /= Object.keys(dateGroups).length
  average.count /= Object.keys(dateGroups).length

  average.parsedSize = humanFileSize(average.size)
  average.parsedDuration = secondsToTime(average.duration)

  total.parsedSize = humanFileSize(total.size)
  total.parsedDuration = secondsToTime(total.duration)

  const csvData = {
    date: Object.keys(dateGroups)[0],
    averageSize: average.parsedSize,
    averageDuration: average.parsedDuration,
    averageCount: Math.round(average.count * 100) / 100,
    totalSize: total.parsedSize,
    totalDuration: total.parsedDuration,
    totalCount: total.count,
  }

  const json = await appendDataToCSVFile(csvData)

  await buildGraph(dateGroups)
  console.table(json.slice(-10))
  logUpdate.done()
}

const buildGraph = async (data: { [key: string]: { duration: number } }) => {
  const terminalWidth = process.stdout.columns

  const weeks: { [key: string]: { duration: number } }[] = []
  Object.keys(data).forEach((date, index) => {
    const weekIndex = Math.floor(index / 7)
    if (!weeks[weekIndex]) weeks[weekIndex] = {}
    weeks[weekIndex][date] = data[date]
  })
  const series = weeks.map((week) =>
    Object.values(week)
      .map((x) => [x.duration, x.duration, x.duration, x.duration, x.duration])
      .flat()
  )
  const series2 = Object.values(data)
    .map((obj) => [
      obj.duration,
      obj.duration,
      obj.duration,
      obj.duration,
      obj.duration,
    ])
    .flat()
  const maxLenTime = Math.max(
    ...series.map((x) =>
      Math.max(...x.map((x) => secondsToTime(x, true).length))
    )
  )
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const daysStr = `${' '.repeat(maxLenTime + 5)}${days
    .map((x) => x.padEnd(5))
    .join('')}`

  const daysStr2 = `${' '.repeat(maxLenTime + 5)}${Array(weeks.length)
    .fill(days)
    .flat()
    .map((x) => x.padEnd(5))
    .join('')}`

  const useFull = daysStr2.length <= terminalWidth
  const graph = asciichart.plot(useFull ? series2 : [...series].reverse(), {
    height: 6,
    colors: [
      asciichart.blue,
      asciichart.green,
      asciichart.yellow,
      asciichart.red,
    ],
    format: (x: number) => {
      const time = secondsToTime(x, true)
      return ' '.repeat(maxLenTime - time.length) + time
    },
  })
  let description = ''
  if (!useFull) {
    const colors = [
      asciichart.blue,
      asciichart.green,
      asciichart.yellow,
      asciichart.red,
    ]
    const descriptors: string[] = []
    weeks.forEach((week, index) => {
      const dateString = Object.keys(week)[0]
      const date = parseDate(dateString)
      const startDate = dateToTimeString(
        getWeekStartDate(date),
        'ddd dd MMM yyyy'
      )
      descriptors.push(`${colors[index]}${startDate}${asciichart.reset}`)
    })
    description = descriptors.join(':sep:')
    if (
      description.replace(/\[[0-9]{0,}m/g, '').replace(/:sep:/g, ' '.repeat(3))
        .length > terminalWidth
    )
      description = description.replace(/:sep:/g, '\n')
    else description = description.replace(/:sep:/g, ' '.repeat(3))
  }
  const graphStr = `${graph}\n${
    useFull ? daysStr2 : daysStr
  }\n\n${description}\n`
  logUpdate(graphStr)
  logUpdate.done()
}

export default main
