// @ts-nocheck
import { buildAgentIndex } from '../lib/agent/indexer.ts'

buildAgentIndex()
  .then(result => {
    console.log(JSON.stringify(result, null, 2))
  })
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
