import chalk from 'chalk'
import fs from 'fs'
import logUpdate from 'log-update'
import {
  addGalleryImages,
  createGallery,
  createMovie,
  createTag,
  editImage,
  editMovie,
  editScene,
  editTag,
  searchGalleries,
  searchImage,
  searchMovies,
  searchPerformer,
  searchTags,
  searchVideo
} from './graphqlFunctions.js'
import {
  dateToString,
  dateToTimeString,
  formatDate,
  getDirectories,
  getFiles,
  loading,
  millisecondsToTime,
  progressBar
} from './utils.js'

const getPostData = (
  name: string
): {
  date: string
  username: string
  postId: string
  index: number
  total: number
} => {
  const regex = /(\d{4}-\d{2}-\d{2})_([^\s]+) - ([^\s]+) (\d+)_of_(\d+)/
  const match = name.match(regex)
  if (!match)
    return {
      date: '1970-01-01',
      username: name.split(' - ')[0],
      postId: '',
      index: 0,
      total: 0,
    }
  return {
    date: match[1],
    username: match[2],
    postId: match[3],
    index: parseInt(match[4]),
    total: parseInt(match[5]),
  }
}

async function run(page: string, debug: boolean = false) {
  const log = (...message: any[]) => {
    if (debug)
      fs.appendFileSync(
        './debug.log',
        `[INSTAGRAM] [${dateToTimeString(
          new Date(),
          'hh:mm:ss.SSS'
        )}] ${message.join(' ')}\n`
      )
  }

  const stats = {
    startTime: Date.now(),
    total: 0,
    skipped: 0,
    added: 0,
    failed: 0,
  }

  const files =
    page === '*'
      ? getDirectories('./instagram')
          .map(({ folder }) => getFiles(folder))
          .reduce((a, b) => a.concat(b), [])
      : page
          .split(',')
          .map((user) => getFiles(`./instagram/${user}`))
          .reduce((a, b) => a.concat(b), [])

  let currentLine = (
    stats: {
      startTime: number
      total: number
      skipped: number
      added: number
      failed: number
    },
    status: string
  ) => ''
  for (const f of files) {
    const { file } = f
    const { date, username, postId, index, total } = getPostData(file)

    const title = `${username} - ${dateToString(
      formatDate(`${date}_00-00-00`)
    ).replace(/ \d{2}:\d{2}:\d{2}/, '')} ${index}/${total} - (${postId})`

    stats.total++

    const fileIndex = files.indexOf(f)

    currentLine = (stats, status) => {
      const millisecondsLeft = Math.round(
        (Date.now() - stats.startTime) *
          ((files.length - fileIndex) / (fileIndex + 1))
      )
      return [
        loading(progressBar((fileIndex + 1) / files.length)),
        `${chalk.greenBright(
          `[${fileIndex + 1}/${files.length}] ${stats.added} added`
        )}, ${chalk.yellowBright(
          `${stats.skipped} skipped`
        )}, ${chalk.redBright(`${stats.failed} failed`)}, ${chalk.cyanBright(
          `${millisecondsToTime(millisecondsLeft)} left`
        )}`,
        chalk.blackBright(`${title}`),
        status,
      ].join('\n')
    }

    const performerResponse = await searchPerformer(username, {}).catch(
      () => null
    )
    const performer =
      performerResponse?.count === 1 ? performerResponse.performers[0] : null

    log(`Performer response: ${JSON.stringify(performerResponse)}`)

    let tagId: string | null = null

    const SearchTagsResponse = await searchTags({
      q: `${username}_${postId}`,
    })

    log(`SearchTagsResponse: ${JSON.stringify(SearchTagsResponse)}`)

    if (SearchTagsResponse.count === 1) {
      tagId = SearchTagsResponse.tags[0].id
    } else if (SearchTagsResponse.count === 0) {
      const createTagResponse = await createTag({
        name: `${username}_${postId}`,
        description: `Instagram post ${postId} by ${username}`,
        parent_ids: ['2239'],
      })

      log(`createTagResponse: ${JSON.stringify(createTagResponse)}`)
      tagId = createTagResponse.id
    }

    if (!tagId)
      logUpdate(currentLine(stats, chalk.redBright(`No tag found for ${file}`)))
    else
      logUpdate(currentLine(stats, chalk.greenBright(`Tag found for ${file}`)))

    if (file.endsWith('.mp4')) {
      log(`Searching ${file.replace('.mp4', '').replace(/ -/g, '')}`)

      const sceneResult = await searchVideo({
        q: file.replace('.mp4', '').replace(/ -/g, ''),
      })

      if ((sceneResult?.count ?? 0) === 0) {
        logUpdate(
          currentLine(stats, chalk.redBright(`No scene found for ${file}`))
        )
        continue
      } else if ((sceneResult?.count ?? 0) > 1) {
        logUpdate(
          currentLine(
            stats,
            chalk.redBright(`Multiple scenes found for ${file}`)
          )
        )
        continue
      }

      const scene = sceneResult?.scenes[0]
      if (!scene || scene.organized) {
        if (scene) {
          logUpdate(
            currentLine(
              stats,
              chalk.yellowBright(
                `[${fileIndex + 1}/${
                  files.length
                }] Scene already organized for ${file}`
              )
            )
          )
          stats.skipped++
        } else {
          logUpdate(
            currentLine(
              stats,
              chalk.redBright(
                `[${fileIndex + 1}/${files.length}] No scene found for ${file}`
              )
            )
          )
          stats.failed++
        }

        continue
      }

      log(`Found scene for ${file} (${JSON.stringify(scene)})`)

      let movieId: string | null = null
      let movie = null
      if (total > 1) {
        const searchMoviesResponse = await searchMovies({
          q: `${username} - ${postId}`,
        })

        log(
          `SearchMoviesResponse for "${username} - ${postId}": ${JSON.stringify(
            searchMoviesResponse
          )}`
        )

        movie = searchMoviesResponse?.movies?.[0]
        movieId = movie?.id

        if (!movieId) {
          const createMovieResponse = await createMovie({
            name: `${username} - ${postId}`,
            date,
            url: `https://www.instagram.com/p/${postId}/`,
            studio_id: '104',
            duration: 0,
            front_image: scene.paths.screenshot,
          })

          log(`createMovieResponse: ${JSON.stringify(createMovieResponse)}`)
          movie = createMovieResponse
          movieId = movie?.id

          if (!movieId)
            logUpdate(
              currentLine(stats, chalk.redBright(`No movie found for ${file}`))
            )
          else
            logUpdate(
              currentLine(stats, chalk.greenBright(`Movie found for ${file}`))
            )
        }
      }

      if (tagId) {
        const editTagResponse = await editTag(tagId, {
          name: `${username}_${postId}`,
          description: `Instagram post ${postId} by ${username}`,
          parent_ids: ['2239'],
          image: scene.paths.screenshot,
        })

        log(`editTagResponse: ${JSON.stringify(editTagResponse)}`)
      }

      log(`Editing scene ${scene.id} ${title}`)

      const editResult = await editScene(scene.id, {
        date,
        title: title,
        url: `https://www.instagram.com/p/${postId}/`,
        studio_id: scene.studio?.id,
        performer_ids: performer ? [performer.id] : [],
        tag_ids: tagId ? [tagId, ...scene.tags.map((tag) => tag.id)] : [],
        organized: true,
        movies: movieId
          ? [
              { movie_id: movieId },
              ...(scene.movies?.map((movie) => ({ movie_id: movie.id })) ?? []),
            ]
          : [],
      })

      log(`Edit result: ${JSON.stringify(editResult)}`)

      if (movieId) {
        const editMovieResult = await editMovie(movieId, {
          name: `${username} - ${postId}`,
          date,
          url: `https://www.instagram.com/p/${postId}/`,
          studio_id: '104',
          duration:
            movie?.duration +
              scene?.files
                ?.map((file) => file.duration)
                .reduce((a, b) => a + b, 0) ?? 0,
        })

        log(`Edit movie result: ${JSON.stringify(editMovieResult)}`)
      }

      if (editResult && !(editResult as any).errors)
        logUpdate(
          currentLine(
            stats,
            chalk.greenBright(
              `[${fileIndex + 1}/${files.length}] Updated ${file}`
            )
          )
        )
      else
        logUpdate(
          currentLine(
            stats,
            chalk.redBright(
              `[${fileIndex + 1}/${files.length}] Failed to update ${file}`
            )
          )
        )

      stats.added++
    } else {
      let galleryId: string | undefined
      if (total > 1) {
        const gallerySearchResult = await searchGalleries({
          q: `${username} - ${postId}`,
        })

        log(
          `Gallery search result for "${username} - ${postId}": ${JSON.stringify(
            gallerySearchResult
          )}`
        )

        galleryId = gallerySearchResult?.galleries?.[0]?.id

        if (gallerySearchResult?.count === 0) {
          logUpdate(
            currentLine(stats, chalk.redBright(`No gallery found for ${file}`))
          )

          const result = await createGallery({
            title: `${username} - ${postId}`,
            url: `https://www.instagram.com/p/${postId}`,
            performer_ids: performer ? [performer.id] : [],
            tag_ids: tagId ? [tagId] : [],
            studio_id: '104',
            date: date,
          })

          log(`Create Gallery Result ${JSON.stringify(result)}`)

          if (result)
            logUpdate(
              currentLine(
                stats,
                chalk.greenBright(`Created gallery ${result?.id}`)
              )
            )
          else
            logUpdate(
              currentLine(
                stats,
                chalk.redBright(`Failed to create gallery for ${postId}`)
              )
            )

          galleryId = result?.id
        } else if ((gallerySearchResult?.count ?? 0) > 1) {
          logUpdate(
            currentLine(
              stats,
              chalk.redBright(`Multiple galleries found for ${file}`)
            )
          )
        }
      }

      log(`Searching ${file.replace('.jpb', '').replace(/ -/g, '')}`)

      const imageResult = await searchImage({
        q: file.replace('.jpg', '').replace(/ -/g, ''),
      })

      if ((imageResult?.count ?? 0) === 0) {
        logUpdate(
          currentLine(stats, chalk.redBright(`No image found for ${file}`))
        )
        stats.failed++
        continue
      } else if ((imageResult?.count ?? 0) > 1) {
        logUpdate(
          currentLine(
            stats,
            chalk.redBright(`Multiple images found for ${file}`)
          )
        )
        stats.skipped++
        continue
      }

      const image = imageResult?.images[0]

      log(`Found image for ${file} (${JSON.stringify(image)})`)

      if (!image || image.organized) {
        if (image) {
          logUpdate(
            currentLine(
              stats,
              chalk.yellowBright(
                `[${fileIndex + 1}/${
                  files.length
                }] Image already organized for ${file}`
              )
            )
          )
          stats.skipped++
        } else {
          logUpdate(
            currentLine(
              stats,
              chalk.redBright(
                `[${fileIndex + 1}/${files.length}] Image not found for ${file}`
              )
            )
          )
          stats.failed++
        }

        continue
      }

      if (tagId) {
        const editTagResponse = await editTag(tagId, {
          name: `${username}_${postId}`,
          description: `Instagram post ${postId} by ${username}`,
          parent_ids: ['2239'],
          image: image.paths.image,
        })

        log(`editTagResponse: ${JSON.stringify(editTagResponse)}`)
      }

      log(`Editing image ${image.id} ${title}`)

      const editResult = await editImage(image.id, {
        title: title,
        organized: true,
        performer_ids: performer ? [performer.id] : [],
        studio_id: image.studio?.id ?? '104',
        tag_ids: tagId ? [tagId, ...image.tags.map((tag) => tag.id)] : [],
      })

      log(`Edit result: ${JSON.stringify(editResult)}`)

      if (galleryId) {
        const addGalleryImagesResult = await addGalleryImages({
          galleryId,
          imageIds: [image.id],
        })

        if (addGalleryImagesResult)
          log(
            `[${fileIndex + 1}/${files.length}] Added image ${
              image.id
            } to gallery ${galleryId}`
          )
        else
          log(
            `[${fileIndex + 1}/${files.length}] Failed to add image ${
              image.id
            } to gallery ${galleryId}`
          )
      }

      if (editResult && !(editResult as any).errors)
        logUpdate(
          currentLine(
            stats,
            chalk.greenBright(
              `[${fileIndex + 1}/${files.length}] Updated ${file}`
            )
          )
        )
      else
        logUpdate(
          currentLine(
            stats,
            chalk.redBright(
              `[${fileIndex + 1}/${files.length}] Failed to update ${file}`
            )
          )
        )

      stats.added++
    }
  }

  logUpdate(
    [
      chalk.greenBright(`Added: ${stats.added}`),
      chalk.yellowBright(`Skipped: ${stats.skipped}`),
      chalk.redBright(`Failed: ${stats.failed}`),
    ].join('\n')
  )
  log(
    [
      `Added: ${stats.added}`,
      `Skipped: ${stats.skipped}`,
      `Failed: ${stats.failed}`,
    ].join(' | ')
  )
}

export default run
