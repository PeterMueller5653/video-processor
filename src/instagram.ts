import chalk from 'chalk'
import logUpdate from 'log-update'
import { editScene, searchVideo } from './graphqlFunctions.js'
import { dateToString, getFiles } from './utils.js'

const getPostData = (
  name: string
): {
  date: string
  username: string
  postId: string
} => {
  const regex = /(\d{4}-\d{2}-\d{2})_(\w+) - (\d+)/
  const match = name.match(regex)
  if (!match) return { date: '', username: '', postId: '' }
  return {
    date: match[1],
    username: match[2],
    postId: match[3],
  }
}

async function run(
  merge: boolean = false,
  page: string,
  debug: boolean = false
) {
  const files = getFiles('./instagram/' + page).filter((file) =>
    file.file.endsWith('.mp4')
  )

  for (const { file } of files) {
    const sceneResult = await searchVideo({
      q: file.replace('.mp4', '').replace(/ -/g, ''),
    })

    if ((sceneResult?.count ?? 0) === 0) {
      logUpdate(chalk.redBright(`No scene found for ${file}`))
      continue
    } else if ((sceneResult?.count ?? 0) > 1) {
      logUpdate(chalk.redBright(`Multiple scenes found for ${file}`))
      continue
    }

    const scene = sceneResult?.scenes[0]
    if (!scene) continue

    const { date, username, postId } = getPostData(file)

    const editResult = await editScene(scene.id, {
      date,
      title: `${username} - ${dateToString(new Date(date))} - (${postId})`,
      url: `https://www.instagram.com/p/${postId}/`,
    })

    if (editResult) logUpdate(chalk.greenBright(`Updated ${file}`))

    logUpdate.done()
  }
}

export default run
