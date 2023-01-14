import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

const pkg: {
  id: string
  name: string
  version: string
  size: number
  unpackedSize: number
  shasum: string
  integrity: string
  filename: string
  files: {
    path: string
    size: number
    mode: number
  }[]
  entrycount: number
  bundled: any[]
}[] = JSON.parse(fs.readFileSync(path.join('bin', 'package.json'), 'utf8'))

const runCommand = async (command: string) => {
  const childProcess = exec(command)

  childProcess.stdout?.pipe(process.stdout)

  await new Promise((resolve, reject) => {
    childProcess.addListener('close', () => {
      resolve(null)
    })
    childProcess.addListener('error', (error) => {
      reject(error)
    })
  })
}

const main = async () => {
  for (const p of pkg) {
    const { name, filename } = p

    console.log(`Uninstalling old version of ${name}...`)
    await runCommand(`npm uninstall ${name} --global`).catch((error) => {
      console.error(error)
    })

    console.log(`Move ${name}...`)
    if (fs.existsSync(path.join('bin', `${name}.tgz`)))
      fs.unlinkSync(path.join('bin', `${name}.tgz`))
    fs.copyFileSync(path.join('bin', filename), path.join('bin', `${name}.tgz`))
    fs.unlinkSync(path.join('bin', filename))
  }

  fs.unlinkSync(path.join('bin', 'package.json'))
}

main()
