import { pathToFileURL } from 'canonical-md'
import rdf from 'rdf-ext'
import * as markdown from 'triplifier-md'
import * as canvas from 'triplifier-canvas'

import { TriplifierService } from './TriplifierService.js'

/**
 * Triplifier service for Markdown and JSON Canvas files.
 */
export class EmbeddedTriplifierService extends TriplifierService {
  constructor (app, settings) {
    super(app, settings)
  }

  async triplify (absolutePath, content) {
    const triplifier = [markdown, canvas].find(service => service.canProcess(absolutePath))
    if (!triplifier) {
      return null
    }

    const dataset = rdf.dataset(triplifier.triplifyToQuads(content, {
      file: absolutePath,
    }))
    const graphUri = pathToFileURL(absolutePath)

    return {
      dataset,
      graphUri,
    }
  }

  canProcess (absolutePath) {
    return markdown.canProcess(absolutePath) || canvas.canProcess(absolutePath)
  }
}
