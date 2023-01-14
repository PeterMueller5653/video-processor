declare module 'json-to-markdown-table' {
  export default function jsonToMarkdownTable(
    json: { [key: string]: any }[],
    fields: string[]
  ): string
}
