import chalk from 'chalk'
import { copy } from 'copy-paste'
import fs from 'fs'
import logUpdate from 'log-update'
import { dateToTimeString } from './utils.js'

const run = async ({
  username,
  count,
  output,
  debug = false,
}: {
  username: string
  count: number
  output?: string | null
  debug?: boolean
}) => {
  const log = (...message: any[]) => {
    if (debug)
      fs.appendFileSync(
        './debug.log',
        `[FAPELLO] [${dateToTimeString(
          new Date(),
          'hh:mm:ss.SSS'
        )}] ${message.join(' ')}\n`
      )
  }

  const links = []
  for (let i = 1; i <= count; i++) {
    const number = `${'0'.repeat(4 - i.toString().length)}${i}`
    const num = i >= 1000 ? 2 : 1

    const imageLink = `https://fapello.com/content/${username[0]}/${username[1]}/${username}/${num}000/${username}_${number}.jpg`

    log(`Image link: ${imageLink}`)

    logUpdate(chalk.greenBright(`Getting image ${i}/${count}`))
    logUpdate.done()

    links.push(imageLink)
    links.push(
      `https://cdn.fapello.com/content/${username[0]}/${username[1]}/${username}/${num}000/${username}_${number}.mp4`
    )
  }

  if (output) fs.writeFileSync(output, links.join('\n'))
  else copy(links.join('\n'))
}

export default run
