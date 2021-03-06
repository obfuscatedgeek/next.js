import { join } from 'path'
import promisify from '../lib/promisify'
import fs from 'fs'
import webpack from 'webpack'
import getConfig from '../config'
import { PHASE_PRODUCTION_BUILD } from '../../lib/constants'
import getBaseWebpackConfig from './webpack'

const access = promisify(fs.access)
const writeFile = promisify(fs.writeFile)

export default async function build (dir, conf = null) {
  const config = getConfig(PHASE_PRODUCTION_BUILD, dir, conf)
  const buildId = await config.generateBuildId() // defaults to a uuid

  try {
    await access(dir, (fs.constants || fs).W_OK)
  } catch (err) {
    console.error(`> Failed, build directory is not writeable. https://err.sh/zeit/next.js/build-dir-not-writeable`)
    throw err
  }

  try {
    const configs = await Promise.all([
      getBaseWebpackConfig(dir, { buildId, isServer: false, config }),
      getBaseWebpackConfig(dir, { buildId, isServer: true, config })
    ])

    await runCompiler(configs)

    await writeBuildId(dir, buildId, config)
  } catch (err) {
    console.error(`> Failed to build`)
    throw err
  }
}

function runCompiler (compiler) {
  return new Promise(async (resolve, reject) => {
    const webpackCompiler = await webpack(await compiler)
    webpackCompiler.run((err, stats) => {
      if (err) return reject(err)

      const jsonStats = stats.toJson()

      if (jsonStats.errors.length > 0) {
        const error = new Error(jsonStats.errors[0])
        error.errors = jsonStats.errors
        error.warnings = jsonStats.warnings
        return reject(error)
      }

      resolve(jsonStats)
    })
  })
}

async function writeBuildId (dir, buildId, config) {
  const buildIdPath = join(dir, config.distDir, 'BUILD_ID')
  await writeFile(buildIdPath, buildId, 'utf8')
}
