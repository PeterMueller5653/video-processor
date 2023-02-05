import chalk from 'chalk'
import fs from 'fs'
import logUpdate from 'log-update'
import fetch from 'node-fetch'
import process from 'process'
import {
  FullGallery,
  FullTag,
  Job,
  JobQueueResponse,
  Movie,
  SearchGalleryResponse,
  SearchImageResponse,
  SearchMoviesResponse,
  SearchTagsResponse,
  SearchVideoResponse
} from './types.js'
import { dateToTimeString, loading } from './utils.js'

const log = (...message: any[]) => {
  fs.appendFileSync(
    './debug.log',
    `[GRAPHQL] [${dateToTimeString(new Date(), 'hh:mm:ss.SSS')}] ${message.join(
      ' '
    )}\n`
  )
}

export async function searchVideo(
  filter: {
    q?: string
    page?: number
    per_page?: number
    sort?: string
    direction?: string
  } = {},
  sceneFilter = {}
): Promise<SearchVideoResponse | null> {
  const parsedFilter = {
    q: '',
    page: 1,
    per_page: 25,
    sort: 'created_at',
    direction: 'DESC',
    ...filter,
  }
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'FindScenes',
      variables: {
        filter: parsedFilter,
        scene_filter: sceneFilter,
      },
      query: `query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType, $scene_ids: [Int!]) {
                findScenes(filter: $filter, scene_filter: $scene_filter, scene_ids: $scene_ids) {
                  count
                  filesize
                  duration
                  scenes {
                    ...SlimSceneData
                    __typename
                  }
                  __typename
                }
              }
              
              fragment SlimSceneData on Scene {
                id
                title
                details
                url
                date
                rating
                o_counter
                organized
                interactive
                interactive_speed
                files {
                  ...VideoFileData
                  __typename
                }
                paths {
                  screenshot
                  preview
                  stream
                  webp
                  vtt
                  chapters_vtt
                  sprite
                  funscript
                  interactive_heatmap
                  caption
                  __typename
                }
                scene_markers {
                  id
                  title
                  seconds
                  primary_tag {
                    id
                    name
                    __typename
                  }
                  __typename
                }
                galleries {
                  id
                  files {
                    path
                    __typename
                  }
                  title
                  __typename
                }
                studio {
                  id
                  name
                  image_path
                  __typename
                }
                movies {
                  movie {
                    id
                    name
                    front_image_path
                    __typename
                  }
                  scene_index
                  __typename
                }
                tags {
                  id
                  name
                  __typename
                }
                performers {
                  id
                  name
                  gender
                  favorite
                  image_path
                  __typename
                }
                stash_ids {
                  endpoint
                  stash_id
                  __typename
                }
                __typename
              }
              
              fragment VideoFileData on VideoFile {
                id
                path
                size
                duration
                video_codec
                audio_codec
                width
                height
                frame_rate
                bit_rate
                fingerprints {
                  type
                  value
                  __typename
                }
                __typename
              }
              `,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.findScenes
    })
    .catch((err) => {
      console.log(err)
      return null
    })
}

export async function searchImage(
  filter: {
    q?: string
    page?: number
    per_page?: number
    sort?: string
    direction?: string
  } = {},
  imageFilter = {}
): Promise<SearchImageResponse | null> {
  const parsedFilter = {
    q: '',
    page: 1,
    per_page: 40,
    sort: 'created_at',
    direction: 'DESC',
    ...filter,
  }
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'FindImages',
      variables: {
        filter: parsedFilter,
        image_filter: imageFilter,
      },
      query: `query FindImages($filter: FindFilterType, $image_filter: ImageFilterType, $image_ids: [Int!]) {
            findImages(filter: $filter, image_filter: $image_filter, image_ids: $image_ids) {
              count
              megapixels
              filesize
              images {
                ...SlimImageData
                __typename
            }
            __typename
        }
      }
        
        fragment SlimImageData on Image {
            id
            title
            rating
            organized
            o_counter
            files {
              ...ImageFileData
              __typename
          }
          paths {
              thumbnail
              image
              __typename
          }
          galleries {
              id
              title
              files {
                path
                __typename
            }
            folder {
                path
                __typename
            }
            __typename
        }
          studio {
              id
              name
              image_path
              __typename
          }
          tags {
              id
              name
              __typename
          }
          performers {
              id
              name
              gender
              favorite
              image_path
              __typename
          }
          __typename
      }
        
        fragment ImageFileData on ImageFile {
            id
            path
            size
            width
            height
            fingerprints {
              type
              value
              __typename
          }
          __typename
      }`,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.findImages
    })
    .catch((err) => {
      console.log(err)
      return null
    })
}

export async function searchPerformer(
  name: string,
  performerFilter: {
    tags?: {
      modifier?: string
      depth?: number
      value?: string[]
    }
  } = {
    tags: {
      modifier: 'INCLUDES',
      depth: 0,
      value: ['2'],
    },
  }
) {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'FindPerformers',
      variables: {
        filter: {
          q: name,
          page: 1,
          per_page: 40,
          sort: 'name',
          direction: 'ASC',
        },
        performer_filter: performerFilter,
      },
      query: `query FindPerformers($filter: FindFilterType, $performer_filter: PerformerFilterType) {
        findPerformers(filter: $filter, performer_filter: $performer_filter) {
          count
          performers {
            ...PerformerData
            __typename
          }
          __typename
        }
      }
      
      fragment PerformerData on Performer {
        id
        checksum
        name
        url
        gender
        twitter
        instagram
        birthdate
        ethnicity
        country
        eye_color
        height
        measurements
        fake_tits
        career_length
        tattoos
        piercings
        aliases
        favorite
        ignore_auto_tag
        image_path
        scene_count
        image_count
        gallery_count
        movie_count
        tags {
          ...SlimTagData
          __typename
        }
        stash_ids {
          stash_id
          endpoint
          __typename
        }
        rating
        details
        death_date
        hair_color
        weight
        __typename
      }
      
      fragment SlimTagData on Tag {
        id
        name
        aliases
        image_path
        __typename
      }
      `,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.findPerformers
    })
    .catch((err) => {
      console.log(err)
      return null
    })
}

export async function editScene(
  id: string,
  {
    date,
    details,
    studio_id,
    performer_ids,
    tag_ids,
    organized,
    movies,
    title,
    url,
  }: {
    date?: string
    details?: string
    studio_id?: string
    performer_ids?: string[]
    tag_ids?: string[]
    organized?: boolean
    movies?: {
      movie_id: string
    }[]
    title?: string
    url?: string
  }
) {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'SceneUpdate',
      variables: {
        id: id,
        input: {
          date: date ?? '',
          details: details ?? '',
          id: id,
          studio_id: studio_id,
          performer_ids: performer_ids ?? [],
          tag_ids: tag_ids ?? [],
          organized: organized,
          movies: movies ?? [],
          title: title ?? '',
          url: url ?? '',
        },
      },
      query: `mutation SceneUpdate($input: SceneUpdateInput!) {
                sceneUpdate(input: $input) {
                  ...SceneData
                  __typename
                }
              }
              
              fragment SceneData on Scene {
                id
                title
                details
                url
                date
                rating
                o_counter
                organized
                interactive
                interactive_speed
                captions {
                  language_code
                  caption_type
                  __typename
                }
                created_at
                updated_at
                files {
                  ...VideoFileData
                  __typename
                }
                paths {
                  screenshot
                  preview
                  stream
                  webp
                  vtt
                  chapters_vtt
                  sprite
                  funscript
                  interactive_heatmap
                  caption
                  __typename
                }
                scene_markers {
                  ...SceneMarkerData
                  __typename
                }
                galleries {
                  ...SlimGalleryData
                  __typename
                }
                studio {
                  ...SlimStudioData
                  __typename
                }
                movies {
                  movie {
                    ...MovieData
                    __typename
                  }
                  scene_index
                  __typename
                }
                tags {
                  ...SlimTagData
                  __typename
                }
                performers {
                  ...PerformerData
                  __typename
                }
                stash_ids {
                  endpoint
                  stash_id
                  __typename
                }
                sceneStreams {
                  url
                  mime_type
                  label
                  __typename
                }
                __typename
              }
              
              fragment VideoFileData on VideoFile {
                id
                path
                size
                duration
                video_codec
                audio_codec
                width
                height
                frame_rate
                bit_rate
                fingerprints {
                  type
                  value
                  __typename
                }
                __typename
              }
              
              fragment SceneMarkerData on SceneMarker {
                id
                title
                seconds
                stream
                preview
                screenshot
                scene {
                  id
                  __typename
                }
                primary_tag {
                  id
                  name
                  aliases
                  __typename
                }
                tags {
                  id
                  name
                  aliases
                  __typename
                }
                __typename
              }
              
              fragment SlimGalleryData on Gallery {
                id
                title
                date
                url
                details
                rating
                organized
                files {
                  ...GalleryFileData
                  __typename
                }
                folder {
                  ...FolderData
                  __typename
                }
                image_count
                cover {
                  files {
                    ...ImageFileData
                    __typename
                  }
                  paths {
                    thumbnail
                    __typename
                  }
                  __typename
                }
                studio {
                  id
                  name
                  image_path
                  __typename
                }
                tags {
                  id
                  name
                  __typename
                }
                performers {
                  id
                  name
                  gender
                  favorite
                  image_path
                  __typename
                }
                scenes {
                  ...SlimSceneData
                  __typename
                }
                __typename
              }
              
              fragment GalleryFileData on GalleryFile {
                id
                path
                size
                fingerprints {
                  type
                  value
                  __typename
                }
                __typename
              }
              
              fragment FolderData on Folder {
                id
                path
                __typename
              }
              
              fragment ImageFileData on ImageFile {
                id
                path
                size
                width
                height
                fingerprints {
                  type
                  value
                  __typename
                }
                __typename
              }
              
              fragment SlimSceneData on Scene {
                id
                title
                details
                url
                date
                rating
                o_counter
                organized
                interactive
                interactive_speed
                files {
                  ...VideoFileData
                  __typename
                }
                paths {
                  screenshot
                  preview
                  stream
                  webp
                  vtt
                  chapters_vtt
                  sprite
                  funscript
                  interactive_heatmap
                  caption
                  __typename
                }
                scene_markers {
                  id
                  title
                  seconds
                  primary_tag {
                    id
                    name
                    __typename
                  }
                  __typename
                }
                galleries {
                  id
                  files {
                    path
                    __typename
                  }
                  title
                  __typename
                }
                studio {
                  id
                  name
                  image_path
                  __typename
                }
                movies {
                  movie {
                    id
                    name
                    front_image_path
                    __typename
                  }
                  scene_index
                  __typename
                }
                tags {
                  id
                  name
                  __typename
                }
                performers {
                  id
                  name
                  gender
                  favorite
                  image_path
                  __typename
                }
                stash_ids {
                  endpoint
                  stash_id
                  __typename
                }
                __typename
              }
              
              fragment SlimStudioData on Studio {
                id
                name
                image_path
                stash_ids {
                  endpoint
                  stash_id
                  __typename
                }
                parent_studio {
                  id
                  __typename
                }
                details
                rating
                aliases
                __typename
              }
              
              fragment MovieData on Movie {
                id
                checksum
                name
                aliases
                duration
                date
                rating
                director
                studio {
                  ...SlimStudioData
                  __typename
                }
                synopsis
                url
                front_image_path
                back_image_path
                scene_count
                scenes {
                  id
                  title
                  path
                  __typename
                }
                __typename
              }
              
              fragment SlimTagData on Tag {
                id
                name
                aliases
                image_path
                __typename
              }
              
              fragment PerformerData on Performer {
                id
                checksum
                name
                url
                gender
                twitter
                instagram
                birthdate
                ethnicity
                country
                eye_color
                height
                measurements
                fake_tits
                career_length
                tattoos
                piercings
                aliases
                favorite
                ignore_auto_tag
                image_path
                scene_count
                image_count
                gallery_count
                movie_count
                tags {
                  ...SlimTagData
                  __typename
                }
                stash_ids {
                  stash_id
                  endpoint
                  __typename
                }
                rating
                details
                death_date
                hair_color
                weight
                __typename
              }
              `,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json) => {
      return json
    })
    .catch((err) => {
      console.log(err)
      return false
    })
}

export async function editImage(
  id: string,
  {
    studio_id,
    performer_ids,
    tag_ids,
    organized,
    rating,
    title,
  }: {
    studio_id?: string
    performer_ids?: string[]
    tag_ids?: string[]
    organized?: boolean
    rating?: number
    title?: string
  }
) {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'ImageUpdate',
      variables: {
        input: {
          id: id,
          title: title ?? '',
          rating: rating,
          studio_id: studio_id,
          organized: organized,
          performer_ids: performer_ids ?? [],
          tag_ids: tag_ids ?? [],
        },
      },
      query: `mutation ImageUpdate($input: ImageUpdateInput!) {
            imageUpdate(input: $input) {
              ...SlimImageData
              __typename
          }
      }
        
        fragment SlimImageData on Image {
            id
            title
            rating
            organized
            o_counter
            files {
              ...ImageFileData
              __typename
          }
          paths {
              thumbnail
              image
              __typename
          }
          galleries {
              id
              title
              files {
                path
                __typename
            }
            folder {
                path
                __typename
            }
            __typename
        }
          studio {
              id
              name
              image_path
              __typename
          }
          tags {
              id
              name
              __typename
          }
          performers {
              id
              name
              gender
              favorite
              image_path
              __typename
          }
          __typename
      }
        
        fragment ImageFileData on ImageFile {
            id
            path
            size
            width
            height
            fingerprints {
              type
              value
              __typename
          }
          __typename
      }`,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json) => {
      return json
    })
    .catch((err) => {
      console.log(err)
      return false
    })
}

export async function scanFolder(folder: string) {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'MetadataScan',
      variables: {
        input: {
          useFileMetadata: false,
          stripFileExtension: false,
          scanGeneratePreviews: true,
          scanGenerateImagePreviews: true,
          scanGenerateSprites: true,
          scanGeneratePhashes: false,
          scanGenerateThumbnails: true,
          paths: [folder],
        },
      },
      query:
        'mutation MetadataScan($input: ScanMetadataInput!) { metadataScan(input: $input) } ',
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json) => {
      return json
    })
    .catch((err) => {
      console.log(err)
      return false
    })
}

export async function autoTag(folder: string) {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'MetadataAutoTag',
      variables: {
        input: {
          performers: ['*'],
          studios: ['*'],
          tags: ['*'],
          paths: [folder],
        },
      },
      query:
        'mutation MetadataAutoTag($input: AutoTagMetadataInput!) { metadataAutoTag(input: $input) } ',
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json) => {
      return json
    })
    .catch((err) => {
      console.log(err)
      return false
    })
}

export async function jobQueue(): Promise<JobQueueResponse | null> {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'JobQueue',
      variables: {},
      query: `query JobQueue {
                jobQueue {
                  ...JobData
                  __typename
                }
              }
              
              fragment JobData on Job {
                id
                status
                subTasks
                description
                progress
                startTime
                endTime
                addTime
                __typename
              }
            `,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.jobQueue ?? []
    })
    .catch((err) => {
      log(err)
      return null
    })
}

export async function waitForJobs(prefix: string = '') {
  let jobs = await jobQueue().catch((err) => {
    log(err)
    return null
  })
  let runningJobs = jobs?.length ?? 1

  const frameString = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  let frameIndex = 0

  const buildProgressLines = (jobs: Job[]): string => {
    const lines: string[] = []
    jobs.forEach((job) => {
      const isRunning = job.status === 'RUNNING'
      const color = isRunning
        ? chalk.yellow
        : job.status === 'READY'
        ? chalk.blue
        : chalk.green
      if (frameIndex >= frameString.length) frameIndex = 0
      const frame = isRunning
        ? color(frameString[frameIndex++])
        : job.status === 'READY'
        ? color('-')
        : color('✓')
      const percent = `${Math.round((job.progress ?? 0) * 100)}%`
      const suffix = `${job.description}`
      const width =
        process.stdout.columns -
        Math.max(suffix.length + percent.length, 24) -
        8
      const progress = Math.round((job.progress ?? 0) * width)
      const bar = `[${color('='.repeat(progress))}${' '.repeat(
        width - progress
      )}]`
      lines.push(
        `[${frame}] ${bar} ${color(percent)}${' '.repeat(
          24 - (suffix.length + percent.length)
        )} ${color(suffix)}`
      )
    })
    return lines.join('\n')
  }

  const currentStatus = (jobs: Job[]): string => {
    const subTasks = jobs.find((job) => job.status === 'RUNNING')?.subTasks
    const width = process.stdout.columns - 2
    const subTasksClamped = subTasks
      ?.map((line) => line.slice(0, width))
      ?.join('\n')
    return subTasks ? chalk.grey(`${subTasksClamped}`) : ''
  }

  const Processing = (message: string): string => {
    return '[ ] ' + chalk.blueBright(`Processing:`, chalk.whiteBright(message))
  }

  while (runningJobs > 0) {
    for (let i = 0; i < 7; i++) {
      if (jobs)
        logUpdate(
          `${loading(
            `${prefix}\n${Processing('Scanning and tagging new scenes.')}`,
            frameIndex
          )}\n${buildProgressLines(jobs)}${currentStatus(jobs)}`
        )
      await new Promise((res) => setTimeout(res, 150))
    }

    await jobQueue()
      .then((res) => {
        jobs = res
      })
      .catch(log)
    runningJobs = jobs?.length ?? 1
  }

  logUpdate(`${prefix}\n${chalk.greenBright('All jobs finished')}`)
}

export async function searchGalleries(
  filter: {
    q?: string
    page?: number
    per_page?: number
    sort?: string
    direction?: string
  } = {},
  galleryFilter = {}
): Promise<SearchGalleryResponse | null> {
  const parsedFilter = {
    q: '',
    page: 1,
    per_page: 40,
    sort: 'path',
    direction: 'ASC',
    ...filter,
  }
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'FindGalleries',
      variables: {
        filter: parsedFilter,
        gallery_filter: galleryFilter,
      },
      query: `query FindGalleries($filter: FindFilterType, $gallery_filter: GalleryFilterType) {
          findGalleries(gallery_filter: $gallery_filter, filter: $filter) {
            count
            galleries {
              ...SlimGalleryData
              __typename
          }
          __typename
      }
    }
      
      fragment SlimGalleryData on Gallery {
          id
          title
          date
          url
          details
          rating
          organized
          files {
            ...GalleryFileData
            __typename
        }
        folder {
            ...FolderData
            __typename
        }
        image_count
        cover {
            files {
              ...ImageFileData
              __typename
          }
          paths {
              thumbnail
              __typename
          }
          __typename
      }
        studio {
            id
            name
            image_path
            __typename
        }
        tags {
            id
            name
            __typename
        }
        performers {
            id
            name
            gender
            favorite
            image_path
            __typename
        }
        scenes {
            ...SlimSceneData
            __typename
        }
        __typename
    }
      
      fragment GalleryFileData on GalleryFile {
          id
          path
          size
          fingerprints {
            type
            value
            __typename
        }
        __typename
    }
      
      fragment FolderData on Folder {
          id
          path
          __typename
      }
      
      fragment ImageFileData on ImageFile {
          id
          path
          size
          width
          height
          fingerprints {
            type
            value
            __typename
        }
        __typename
    }
      
      fragment SlimSceneData on Scene {
          id
          title
          details
          url
          date
          rating
          o_counter
          organized
          interactive
          interactive_speed
          files {
            ...VideoFileData
            __typename
        }
        paths {
            screenshot
            preview
            stream
            webp
            vtt
            chapters_vtt
            sprite
            funscript
            interactive_heatmap
            caption
            __typename
        }
        scene_markers {
            id
            title
            seconds
            primary_tag {
              id
              name
              __typename
          }
          __typename
      }
        galleries {
            id
            files {
              path
              __typename
          }
          title
          __typename
      }
        studio {
            id
            name
            image_path
            __typename
        }
        movies {
            movie {
              id
              name
              front_image_path
              __typename
          }
          scene_index
          __typename
      }
        tags {
            id
            name
            __typename
        }
        performers {
            id
            name
            gender
            favorite
            image_path
            __typename
        }
        stash_ids {
            endpoint
            stash_id
            __typename
        }
        __typename
    }
      
      fragment VideoFileData on VideoFile {
          id
          path
          size
          duration
          video_codec
          audio_codec
          width
          height
          frame_rate
          bit_rate
          fingerprints {
            type
            value
            __typename
        }
        __typename
    }
      `,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.findGalleries
    })
    .catch((err) => {
      console.log(err)
      return null
    })
}

export async function createGallery({
  title,
  details,
  url,
  date,
  rating,
  studio_id,
  performer_ids,
  tag_ids,
  scene_ids,
}: {
  title?: string
  details?: string
  url?: string
  date?: string
  rating?: number
  studio_id?: string
  performer_ids?: string[]
  tag_ids?: string[]
  scene_ids?: string[]
}): Promise<FullGallery | any | null> {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'GalleryCreate',
      variables: {
        input: {
          title: title ?? '',
          details: details ?? '',
          url: url ?? '',
          date: date ?? '',
          rating: rating,
          studio_id: studio_id ?? '',
          performer_ids: performer_ids ?? [],
          tag_ids: tag_ids ?? [],
          scene_ids: scene_ids ?? [],
        },
      },
      query: `mutation GalleryCreate($input: GalleryCreateInput!) {
            galleryCreate(input: $input) {
              ...GalleryData
              __typename
          }
      }
        
        fragment GalleryData on Gallery {
            id
            created_at
            updated_at
            title
            date
            url
            details
            rating
            organized
            files {
              ...GalleryFileData
              __typename
          }
          folder {
              ...FolderData
              __typename
          }
          images {
              ...SlimImageData
              __typename
          }
          cover {
              ...SlimImageData
              __typename
          }
          studio {
              ...SlimStudioData
              __typename
          }
          tags {
              ...SlimTagData
              __typename
          }
          performers {
              ...PerformerData
              __typename
          }
          scenes {
              ...SlimSceneData
              __typename
          }
          __typename
      }
        
        fragment GalleryFileData on GalleryFile {
            id
            path
            size
            fingerprints {
              type
              value
              __typename
          }
          __typename
      }
        
        fragment FolderData on Folder {
            id
            path
            __typename
        }
        
        fragment SlimImageData on Image {
            id
            title
            rating
            organized
            o_counter
            files {
              ...ImageFileData
              __typename
          }
          paths {
              thumbnail
              image
              __typename
          }
          galleries {
              id
              title
              files {
                path
                __typename
            }
            folder {
                path
                __typename
            }
            __typename
        }
          studio {
              id
              name
              image_path
              __typename
          }
          tags {
              id
              name
              __typename
          }
          performers {
              id
              name
              gender
              favorite
              image_path
              __typename
          }
          __typename
      }
        
        fragment ImageFileData on ImageFile {
            id
            path
            size
            width
            height
            fingerprints {
              type
              value
              __typename
          }
          __typename
      }
        
        fragment SlimStudioData on Studio {
            id
            name
            image_path
            stash_ids {
              endpoint
              stash_id
              __typename
          }
          parent_studio {
              id
              __typename
          }
          details
          rating
          aliases
          __typename
      }
        
        fragment SlimTagData on Tag {
            id
            name
            aliases
            image_path
            __typename
        }
        
        fragment PerformerData on Performer {
            id
            checksum
            name
            url
            gender
            twitter
            instagram
            birthdate
            ethnicity
            country
            eye_color
            height
            measurements
            fake_tits
            career_length
            tattoos
            piercings
            aliases
            favorite
            ignore_auto_tag
            image_path
            scene_count
            image_count
            gallery_count
            movie_count
            tags {
              ...SlimTagData
              __typename
          }
          stash_ids {
              stash_id
              endpoint
              __typename
          }
          rating
          details
          death_date
          hair_color
          weight
          __typename
      }
        
        fragment SlimSceneData on Scene {
            id
            title
            details
            url
            date
            rating
            o_counter
            organized
            interactive
            interactive_speed
            files {
              ...VideoFileData
              __typename
          }
          paths {
              screenshot
              preview
              stream
              webp
              vtt
              chapters_vtt
              sprite
              funscript
              interactive_heatmap
              caption
              __typename
          }
          scene_markers {
              id
              title
              seconds
              primary_tag {
                id
                name
                __typename
            }
            __typename
        }
          galleries {
              id
              files {
                path
                __typename
            }
            title
            __typename
        }
          studio {
              id
              name
              image_path
              __typename
          }
          movies {
              movie {
                id
                name
                front_image_path
                __typename
            }
            scene_index
            __typename
        }
          tags {
              id
              name
              __typename
          }
          performers {
              id
              name
              gender
              favorite
              image_path
              __typename
          }
          stash_ids {
              endpoint
              stash_id
              __typename
          }
          __typename
      }
        
        fragment VideoFileData on VideoFile {
            id
            path
            size
            duration
            video_codec
            audio_codec
            width
            height
            frame_rate
            bit_rate
            fingerprints {
              type
              value
              __typename
          }
          __typename
      }`,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.galleryCreate ?? json?.errors
    })
    .catch((err) => {
      console.log(err)
      return err
    })
}

export async function addGalleryImages({
  galleryId,
  imageIds,
}: {
  galleryId: string
  imageIds: string[]
}): Promise<boolean> {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'AddGalleryImages',
      variables: {
        gallery_id: galleryId,
        image_ids: imageIds,
      },
      query: `mutation AddGalleryImages($gallery_id: ID!, $image_ids: [ID!]!) {
            addGalleryImages(input: {gallery_id: $gallery_id, image_ids: $image_ids})
      }`,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.addGalleryImages ?? false
    })
    .catch((err) => {
      console.log(err)
      return false
    })
}

export async function searchTags(
  filter: {
    q?: string
    page?: number
    per_page?: number
    sort?: string
    direction?: string
  } = {},
  tagFilter = {}
): Promise<SearchTagsResponse | any | null> {
  const parsedFilter = {
    page: 1,
    per_page: 40,
    sort: 'name',
    direction: 'ASC',
    ...filter,
  }

  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'FindTags',
      variables: {
        filter: parsedFilter,
        tag_filter: tagFilter,
      },
      query: `query FindTags($filter: FindFilterType, $tag_filter: TagFilterType) {
            findTags(filter: $filter, tag_filter: $tag_filter) {
              count
              tags {
                ...TagData
                __typename
            }
            __typename
        }
      }
        
        fragment TagData on Tag {
            id
            name
            description
            aliases
            ignore_auto_tag
            image_path
            scene_count
            scene_marker_count
            image_count
            gallery_count
            performer_count
            parents {
              ...SlimTagData
              __typename
          }
          children {
              ...SlimTagData
              __typename
          }
          __typename
      }
        
        fragment SlimTagData on Tag {
            id
            name
            aliases
            image_path
            __typename
        }`,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.findTags ?? json?.errors
    })
    .catch((err) => {
      console.log(err)
      return err
    })
}

export async function createTag({
  name,
  parent_ids,
  description,
  child_ids,
  ignore_auto_tag,
}: {
  name: string
  description?: string
  parent_ids?: string[]
  child_ids?: string[]
  ignore_auto_tag?: boolean
}): Promise<FullTag | any | null> {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'TagCreate',
      variables: {
        input: {
          name: name,
          description: description,
          parent_ids: parent_ids ?? [],
          child_ids: child_ids ?? [],
          ignore_auto_tag: ignore_auto_tag ?? false,
        },
      },
      query: `mutation TagCreate($input: TagCreateInput!) {
            tagCreate(input: $input) {
              ...TagData
              __typename
          }
      }
        
        fragment TagData on Tag {
            id
            name
            description
            aliases
            ignore_auto_tag
            image_path
            scene_count
            scene_marker_count
            image_count
            gallery_count
            performer_count
            parents {
              ...SlimTagData
              __typename
          }
          children {
              ...SlimTagData
              __typename
          }
          __typename
      }
        
        fragment SlimTagData on Tag {
            id
            name
            aliases
            image_path
            __typename
        }`,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.tagCreate ?? json?.errors
    })
    .catch((err) => {
      console.log(err)
      return err
    })
}

export async function editTag(
  id: string,
  {
    aliases,
    child_ids,
    description,
    ignore_auto_tag,
    image,
    name,
    parent_ids,
  }: {
    name?: string
    description?: string
    aliases?: string[]
    parent_ids?: string[]
    child_ids?: string[]
    ignore_auto_tag?: boolean
    image?: string
  }
): Promise<FullTag | any | null> {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'TagUpdate',
      variables: {
        input: {
          name: name,
          description: description,
          aliases: aliases ?? [],
          parent_ids: parent_ids ?? [],
          child_ids: child_ids ?? [],
          ignore_auto_tag: ignore_auto_tag ?? false,
          id: id,
          image: image ?? '',
        },
      },
      query: `mutation TagUpdate($input: TagUpdateInput!) {
            tagUpdate(input: $input) {
              ...TagData
              __typename
          }
      }
        
        fragment TagData on Tag {
            id
            name
            description
            aliases
            ignore_auto_tag
            image_path
            scene_count
            scene_marker_count
            image_count
            gallery_count
            performer_count
            parents {
              ...SlimTagData
              __typename
          }
          children {
              ...SlimTagData
              __typename
          }
          __typename
      }
        
        fragment SlimTagData on Tag {
            id
            name
            aliases
            image_path
            __typename
        }`,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.tagUpdate ?? json?.errors
    })
    .catch((err) => {
      console.log(err)
      return err
    })
}

export async function searchMovies(
  filter: {
    q?: string
    page?: number
    per_page?: number
    sort?: string
    direction?: string
  },
  movieFilter = {}
): Promise<SearchMoviesResponse | any | null> {
  const parsedFilter = {
    q: '',
    page: 1,
    per_page: 40,
    sort: 'name',
    direction: 'ASC',
    ...filter,
  }
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'FindMovies',
      variables: {
        filter: parsedFilter,
        movie_filter: movieFilter,
      },
      query: `query FindMovies($filter: FindFilterType, $movie_filter: MovieFilterType) {
            findMovies(filter: $filter, movie_filter: $movie_filter) {
              count
              movies {
                ...MovieData
                __typename
            }
            __typename
        }
      }
        
        fragment MovieData on Movie {
            id
            checksum
            name
            aliases
            duration
            date
            rating
            director
            studio {
              ...SlimStudioData
              __typename
          }
          synopsis
          url
          front_image_path
          back_image_path
          scene_count
          scenes {
              id
              title
              path
              __typename
          }
          __typename
      }
        
        fragment SlimStudioData on Studio {
            id
            name
            image_path
            stash_ids {
              endpoint
              stash_id
              __typename
          }
          parent_studio {
              id
              __typename
          }
          details
          rating
          aliases
          __typename
      }`,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.findMovies ?? json?.errors
    })
    .catch((err) => {
      console.log(err)
      return err
    })
}

export async function createMovie({
  name,
  duration,
  date,
  rating,
  studio_id,
  front_image,
  url,
}: {
  name: string
  duration?: number
  date?: string
  rating?: number
  studio_id?: string
  front_image?: string
  url?: string
}): Promise<Movie | any | null> {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'MovieCreate',
      variables: {
        name: name,
        duration: duration ?? 0,
        date: date ?? '',
        rating: rating,
        studio_id: studio_id,
        front_image: front_image,
        url: url ?? '',
      },
      query: `mutation MovieCreate($name: String!, $aliases: String, $duration: Int, $date: String, $rating: Int, $studio_id: ID, $director: String, $synopsis: String, $url: String, $front_image: String, $back_image: String) {
            movieCreate(
              input: {name: $name, aliases: $aliases, duration: $duration, date: $date, rating: $rating, studio_id: $studio_id, director: $director, synopsis: $synopsis, url: $url, front_image: $front_image, back_image: $back_image}
            ) {
              ...MovieData
              __typename
          }
      }
        
        fragment MovieData on Movie {
            id
            checksum
            name
            aliases
            duration
            date
            rating
            director
            studio {
              ...SlimStudioData
              __typename
          }
          synopsis
          url
          front_image_path
          back_image_path
          scene_count
          scenes {
              id
              title
              path
              __typename
          }
          __typename
      }
        
        fragment SlimStudioData on Studio {
            id
            name
            image_path
            stash_ids {
              endpoint
              stash_id
              __typename
          }
          parent_studio {
              id
              __typename
          }
          details
          rating
          aliases
          __typename
      }`,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.movieCreate ?? json?.errors
    })
    .catch((err) => {
      console.log(err)
      return err
    })
}

export async function editMovie(
  id: string,
  {
    name,
    duration,
    date,
    rating,
    studio_id,
    url,
  }: {
    name?: string
    duration?: number
    date?: string
    rating?: number
    studio_id?: string
    url?: string
  }
): Promise<Movie | any | null> {
  return await fetch('http://localhost:9999/graphql', {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'MovieCreate',
      variables: {
        id: id,
        name: name ?? '',
        duration: duration ?? 0,
        date: date ?? '',
        rating: rating,
        studio_id: studio_id,
        url: url ?? '',
      },
      query: `mutation MovieUpdate($input: MovieUpdateInput!) {
        movieUpdate(input: $input) {
          ...MovieData
          __typename
        }
      }
      
      fragment MovieData on Movie {
        id
        checksum
        name
        aliases
        duration
        date
        rating
        director
        studio {
          ...SlimStudioData
          __typename
        }
        synopsis
        url
        front_image_path
        back_image_path
        scene_count
        scenes {
          id
          title
          path
          __typename
        }
        __typename
      }
      
      fragment SlimStudioData on Studio {
        id
        name
        image_path
        stash_ids {
          endpoint
          stash_id
          __typename
        }
        parent_studio {
          id
          __typename
        }
        details
        rating
        aliases
        __typename
      }
      `,
    }),
    method: 'POST',
  })
    .then((res) => res.json())
    .then((json: any) => {
      return json?.data?.movieCreate ?? json?.errors
    })
    .catch((err) => {
      console.log(err)
      return err
    })
}
