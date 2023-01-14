import csv from 'csvtojson'
import fs from 'fs'
// @ts-ignore
import jsonToMarkdownTable from 'json-to-markdown-table'
import { Parser as Json2csvParser } from 'json2csv'
import logUpdate from 'log-update'
import { searchVideo } from './graphqlFunctions.js'
import { humanFileSize, secondsToTime } from './utils.js'

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
      return diff < 1000 * 60 * 60 * 24 * 14
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

  console.table(json.slice(-10))
  logUpdate.done()
}

export default main
