// @ts-nocheck
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const Helper = {
  __filename (pathURL = import.meta.url, rmPrefix = process.platform !== 'win32') {
    return rmPrefix ? (/file:\/\//.test(String(pathURL)) ? fileURLToPath(pathURL) : String(pathURL)) : pathToFileURL(String(pathURL)).toString()
  },
  __dirname (pathURL = import.meta.url) {
    return path.dirname(this.__filename(pathURL, true))
  }
}

export default Helper
