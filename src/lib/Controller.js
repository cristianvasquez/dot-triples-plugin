import { pathToFileURL } from 'canonical-md'
import { NotificationService } from './NotificationService.js'
import { getVaultBaseUri } from './utils.js'

// Triplestore services
import { EmbeddedTriplestoreService } from './triplestore/EmbeddedTriplestoreService.js'
import { RemoteTriplestoreService } from './triplestore/RemoteTriplestoreService.js'

// Triplifier services
import { EmbeddedTriplifierService } from './triplifier/EmbeddedTriplifierService.js'
import { ExternalTriplifierService } from './triplifier/ExternalTriplifierService.js'

/**
 * Controller that orchestrates both triplestore and triplifier services
 */
export class Controller {
  constructor(app, settings) {
    this.app = app
    this.settings = settings
    this.notifications = new NotificationService()

    // Initialize services based on settings
    this.initializeTriplestoreService()
    this.initializeTriplifierService()
  }

  initializeTriplestoreService() {
    switch (this.settings.mode) {
      case 'embedded':
        this.triplestoreService = new EmbeddedTriplestoreService(this.app, this.settings)
        break
      case 'external':
        if (!this.settings.clientSettings) {
          throw new Error('[Controller] External triplestore mode requires clientSettings to be configured')
        }
        this.triplestoreService = new RemoteTriplestoreService(this.app, this.settings)
        break
      default:
        // Default to embedded for backward compatibility
        this.triplestoreService = new EmbeddedTriplestoreService(this.app, this.settings)
    }
  }

  initializeTriplifierService() {
    switch (this.settings.triplifierMode) {
      case 'embedded':
        this.triplifierService = new EmbeddedTriplifierService(this.app, this.settings)
        break
      case 'external':
        this.triplifierService = new ExternalTriplifierService(this.app, this.settings)
        break
      default:
        // Default based on triplestore mode for backward compatibility
        if (this.settings.mode === 'embedded') {
          this.triplifierService = new EmbeddedTriplifierService(this.app, this.settings)
        } else {
          this.triplifierService = new ExternalTriplifierService(this.app, this.settings)
        }
    }
  }

  async select(sparqlQuery) {
    return await this.triplestoreService.select(sparqlQuery)
  }

  async construct(sparqlQuery) {
    return await this.triplestoreService.construct(sparqlQuery)
  }

  async syncFile(file, content, showNotifications = false) {
    if (showNotifications) {
      this.notifications.info(`Syncing ${file.basename}...`)
    }

    // Get absolute path for triplification
    const absolutePath = this.app.vault.adapter.getFullPath(file.path)

    // Check if this file type can be processed by the triplifier service
    if (!this.triplifierService.canProcess(absolutePath)) {
      if (showNotifications) {
        this.notifications.info(`${file.basename} skipped (unsupported file type)`)
      }
      return true
    }

    // Handle different combinations of triplestore and triplifier
    await this.handleSyncFile(file, content, absolutePath, showNotifications)
    return true
  }

  async handleSyncFile(file, content, absolutePath, showNotifications) {
    const triplifierMode = this.settings.triplifierMode

    if (triplifierMode === 'external') {
      // External triplifier handles both triplification and storage
      await this.handleExternalTriplifier(absolutePath, showNotifications, file.basename)
    } else if (triplifierMode === 'embedded') {
      // Embedded triplifier converts, then we store based on triplestore mode
      await this.handleEmbeddedTriplifier(file, content, absolutePath, showNotifications)
    } else {
      throw new Error(`Unknown triplifier mode: ${triplifierMode}`)
    }
  }

  async handleExternalTriplifier(absolutePath, showNotifications, basename) {
    // Use external triplifier (OSG) which handles both conversion and storage
    await this.triplifierService.syncFile(absolutePath)

    if (showNotifications) {
      this.notifications.success(`${basename} synced externally`)
    }
  }

  async handleEmbeddedTriplifier(file, content, absolutePath, showNotifications) {
    // Use embedded triplifier to convert content to RDF
    const result = await this.triplifierService.triplify(absolutePath, content)

    if (!result) {
      if (showNotifications) {
        this.notifications.info(`${file.basename} skipped (no triplification result)`)
      }
      return
    }

    const { dataset, graphUri } = result

    // First, clear any existing triples for this file
    await this.triplestoreService.clearGraph(graphUri)

    // Add new triples to the triplestore
    await this.triplestoreService.addTriples(dataset, graphUri)

    if (showNotifications) {
      this.notifications.success(`${file.basename} synced (${dataset.size} triples)`)
    }
  }

  async rebuildIndex() {
    this.notifications.info('Rebuilding index...')

    // Get vault base URI for scoped clearing
    const vaultBaseUri = getVaultBaseUri(this.app)

    // Clear all data from this vault in the triplestore
    await this.triplestoreService.clearAll(vaultBaseUri)

    // Process all markdown files in the vault
    const markdownFiles = this.app.vault.getMarkdownFiles()
    let processedFiles = 0

    for (const file of markdownFiles) {
      try {
        const content = await this.app.vault.read(file)

        // Process with controller - if no error is thrown, it succeeded
        await this.syncFile(file, content, false)
        processedFiles++
      } catch (error) {
        console.error('Error processing file', file.path, ':', error)
        this.notifications.error(`Failed to process ${file.path}: ${error.message}`)
        // Continue processing other files even if one fails
      }
    }

    let totalTriples = 'unknown'
    if (this.triplestoreService instanceof EmbeddedTriplestoreService) {
      totalTriples = this.triplestoreService.size
    }

    this.notifications.success(`Index rebuilt: ${processedFiles} files, ${totalTriples} triples`)
  }

  async deleteNamedGraph(path, showNotifications = false) {
    if (showNotifications) {
      this.notifications.info(`Removing ${path}...`)
    }

    const absolutePath = this.app.vault.adapter.getFullPath(path)
    const graphUri = pathToFileURL(absolutePath)

    if (this.settings.triplifierMode === 'external') {
      // Use external triplifier to remove
      await this.triplifierService.removeFile(absolutePath)
      if (showNotifications) {
        this.notifications.success(`${path} removed externally`)
      }
    } else {
      // Use triplestore service to clear the graph
      await this.triplestoreService.clearGraph(graphUri)
      if (showNotifications) {
        this.notifications.success(`${path} removed from triplestore`)
      }
    }
  }
}
