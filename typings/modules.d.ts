declare module 'json-to-markdown-table' {
  export default function jsonToMarkdownTable(
    json: { [key: string]: any }[],
    fields: string[]
  ): string
}

declare module 'gpu-info' {
  export default function gpuInfo(): Promise<{ [key: string]: any }>
}
