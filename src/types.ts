export type Fingerprint = {
  type: string
  value: string
}

export type File = {
  audio_codec: string
  bit_rate: number
  duration: number
  fingerprints: Fingerprint[]
  frame_rate: number
  height: number
  id: string
  path: string
  size: number
  video_codec: string
  width: number
}

export type Performer = {
  favorite: boolean
  gender: string
  id: string
  image_path: string
  name: string
}

export type SceneMarker = {
  id: string
  primary_tag: Tag
  seconds: number
  title: string
}

export type Studio = {
  id: string
  image_path: string
  name: string
}

export type Tag = {
  id: string
  name: string
}

export type Scene = {
  id: string
  date?: string
  files: File[]
  galleries: any[]
  interactive: boolean
  interactive_speed?: number
  movies: any[]
  o_counter: number
  organized: boolean
  paths: {
    caption: string
    chapters_vtt: string
    funscript: string
    interactive_heatmap: string
    preview: string
    screenshot: string
    sprite: string
    stream: string
    vtt: string
    webp: string
  }
  performers: Performer[]
  rating?: number
  scene_markers: SceneMarker[]
  stash_ids: string[]
  studio?: Studio
  tags: Tag[]
  title: string
  url: string
}

export type SearchVideoResponse = {
  count: number
  duration: number
  filesize: number
  scenes: Scene[]
}

export type Gallerie = {
  files: File[]
  id: string
  folder: {
    path: string
  }
  title: string
}

export type Image = {
  files: File[]
  galleries: Gallerie[]
  id: string
  o_counter: number
  organized: boolean
  paths: {
    image: string
    thumbnail: string
  }
  performers: Performer[]
  rating?: number
  studio?: Studio
  tags: Tag[]
  title: string
}

export type SearchImageResponse = {
  count: number
  duration: number
  filesize: number
  images: Image[]
}

export type Job = {
  id: string
  status: string
  subTasks: string[]
  description: string
  progress?: number
  startTime: string
  endTime?: string
  addTime: string
}

export type JobQueueResponse = Job[]
