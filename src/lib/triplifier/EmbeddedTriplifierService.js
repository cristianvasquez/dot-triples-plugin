import { pathToFileURL } from 'canonical-md'
import rdf from 'rdf-ext'
import { canProcess, triplifyToQuads } from 'triplifier-md'

import { TriplifierService } from './TriplifierService.js'

/**
 * Triplifier service that uses dot-triples' triplifier-md package.
 */
export class EmbeddedTriplifierService extends TriplifierService {
  constructor (app, settings) {
    super(app, settings)
  }

  async triplify (absolutePath, content) {
    if (!canProcess(absolutePath)) {
      return null
    }

    const dataset = rdf.dataset(triplifyToQuads(content, {
      file: absolutePath,
    }))
    const graphUri = pathToFileURL(absolutePath)

    return {
      dataset,
      graphUri,
    }
  }

  canProcess (absolutePath) {
    return canProcess(absolutePath)
  }
}
