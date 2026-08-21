import { PluginSettingTab, Setting, Notice } from 'obsidian'

export const DEFAULT_SETTINGS = {
  mode: 'embedded', // 'embedded' or 'external' - triplestore mode
  triplifierMode: 'embedded', // 'embedded' or 'external' - triplifier mode
  clientSettings: {
    endpointUrl: 'http://localhost:7878/query?union-default-graph',
    updateUrl: 'http://localhost:7878/update?union-default-graph',
    user: '',
    password: '',
  },
  allowUpdate: false,
  osgPath: '/home/cvasquez/.local/share/pnpm/osg',
  embeddedSettings: {
    triplifierOptions: {},
  },
  rebuildOnStartup: false,
  indexOnSave: true,
  indexOnOpen: true,
  panelTag: 'panel/query',
  panelQuery: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?document ?title ?content WHERE {
    GRAPH ?g {
        ?document <urn:token:tags> "panel/query" ;
                  <urn:token:about> ?panel .
        ?panel <urn:code-block:osg> ?query .
        OPTIONAL { ?document <urn:token:title> ?documentTitle }
        OPTIONAL { ?panel rdfs:label ?panelTitle }
        OPTIONAL { ?document <urn:token:order> ?order }
        BIND(COALESCE(?panelTitle, ?documentTitle) AS ?title)
        BIND(CONCAT("\`\`\`osg\\n", STR(?query), "\\n\`\`\`") AS ?content)
    }
} ORDER BY ?order`,
}

export function migrateSettings (settings) {
  const panelQuery = settings.panelQuery || ''
  const usesLegacyPanelModel = panelQuery.includes('dot:MarkdownDocument') &&
    panelQuery.includes('dot:raw')

  return usesLegacyPanelModel
    ? { ...settings, panelQuery: DEFAULT_SETTINGS.panelQuery }
    : settings
}


export class SparqlSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display() {
    const { containerEl } = this
    containerEl.empty()
    containerEl.addClass('sparql-settings') // Add scoped CSS class
    containerEl.createEl('h2', { text: 'Settings for obsidian SPARQL' })

    // Main sections
    this.createTriplestoreSection(containerEl)
    this.createTriplifierSection(containerEl)
    this.createPanelDiscoverySection(containerEl)
  }

  createTriplestoreSection(containerEl) {
    const section = containerEl.createEl('div', { cls: 'setting-section' })
    section.createEl('h3', { text: '🗄️ Triplestore Configuration' })
    section.createEl('p', {
      text: 'Choose how and where to store RDF triples from your notes.',
      cls: 'setting-section-desc'
    })

    // Mode selection
    new Setting(section)
    .setName('Triplestore Mode')
    .setDesc('Embedded: Local database in your vault. External: Remote SPARQL endpoint.')
    .addDropdown(dropdown => {
      dropdown
      .addOption('embedded', 'Embedded Database (oxygraph-js)')
      .addOption('external', 'External Triplestore')
      .setValue(this.plugin.settings.mode)
      .onChange(async (value) => {
        const oldMode = this.plugin.settings.mode
        this.plugin.settings.mode = value

        // Ensure valid triplifier mode for embedded triplestore
        if (value === 'embedded' && this.plugin.settings.triplifierMode === 'external') {
          this.plugin.settings.triplifierMode = 'embedded'
          new Notice('Switched to embedded triplifier (external triplifier not compatible with embedded triplestore)')
        }

        await this.plugin.saveSettings()

        if (oldMode !== value) {
          this.plugin.reinitializeController()
        }

        this.display()
      })
    })

    // Show relevant settings based on mode
    if (this.plugin.settings.mode === 'external') {
      this.addExternalTriplestoreSettings(section)
    } else {
      this.addEmbeddedTriplestoreSettings(section)
    }
  }

  createTriplifierSection(containerEl) {
    const section = containerEl.createEl('div', { cls: 'setting-section' })
    section.createEl('h3', { text: '⚙️ Triplifier Configuration' })
    section.createEl('p', {
      text: 'Choose how to convert your markdown notes into RDF triples.',
      cls: 'setting-section-desc'
    })

    // Triggers first
    this.addTriplificationTriggers(section)

    // Mode selection with constraints
    const modeSettings = new Setting(section)
    .setName('Triplifier Mode')
    .setDesc('Embedded: Built-in dot-triples. External: OSG command-line tool.')

    if (this.plugin.settings.mode === 'embedded') {
      // Embedded triplestore only works with embedded triplifier
      modeSettings.addDropdown(dropdown => {
        dropdown
        .addOption('embedded', 'Embedded (dot-triples)')
        .setValue('embedded')
        .setDisabled(true)
      })

      const note = section.createEl('div', {
        cls: 'setting-item-description',
        text: '⚠️ Embedded triplestore requires embedded triplifier'
      })
      note.style.color = 'var(--text-accent)'
      note.style.marginTop = '-10px'
      note.style.marginBottom = '20px'
    } else {
      // External triplestore can use either triplifier
      modeSettings.addDropdown(dropdown => {
        dropdown
        .addOption('embedded', 'Embedded (dot-triples)')
        .addOption('external', 'External (OSG triplifier)')
        .setValue(this.plugin.settings.triplifierMode)
        .onChange(async (value) => {
          const oldMode = this.plugin.settings.triplifierMode
          this.plugin.settings.triplifierMode = value
          await this.plugin.saveSettings()

          if (oldMode !== value) {
            this.plugin.reinitializeController()
          }

          this.display()
        })
      })
    }

    // Show relevant settings
    if (this.plugin.settings.triplifierMode === 'external') {
      this.addExternalTriplifierSettings(section)
    } else {
      this.addEmbeddedTriplifierSettings(section)
    }
  }

  createPanelDiscoverySection(containerEl) {
    const section = containerEl.createEl('div', { cls: 'setting-section' })
    section.createEl('h3', { text: '🔍 Panel Discovery' })
    section.createEl('p', {
      text: 'Configure how to discover SPARQL query panels in your vault.',
      cls: 'setting-section-desc'
    })

    // Examples link
    const examplesDiv = section.createEl('div', { cls: 'setting-item-description' })
    examplesDiv.innerHTML = '💡 <strong>Examples:</strong> See <a href="https://github.com/cristianvasquez/obsidian-sparql/tree/main/example-panels" target="_blank">example-panels/</a> for ready-to-use SPARQL query panels.'

    // Panel tag
    new Setting(section)
    .setName('Panel Tag Search')
    .setDesc('Tag to search for in Obsidian vault files to discover panels.')
    .addText(text => {
      text
      .setValue(this.plugin.settings.panelTag)
      .setPlaceholder('panel/query')
      .onChange(async (value) => {
        this.plugin.settings.panelTag = value
        await this.plugin.saveSettings()
      })
      text.inputEl.style.width = '100%'
      text.inputEl.style.fontFamily = 'var(--font-monospace)'
    })

    // Panel SPARQL query
    new Setting(section)
    .setName('Panel SPARQL Query')
    .setDesc('SPARQL query to discover panels from triplestore. Must return ?document, ?title, and ?content.')
    .addTextArea(text => {
      text
      .setValue(this.plugin.settings.panelQuery)
      .setPlaceholder('SPARQL query...')
      .onChange(async (value) => {
        this.plugin.settings.panelQuery = value
        await this.plugin.saveSettings()
      })
      text.inputEl.style.width = '100%'
      text.inputEl.style.height = '300px'
      text.inputEl.style.fontFamily = 'var(--font-monospace)'
      text.inputEl.style.fontSize = '13px'
    })
  }

  addExternalTriplestoreSettings(container) {
    container.createEl('h4', { text: 'External Triplestore Connection' })

    const client = this.plugin.settings.clientSettings

    new Setting(container)
    .setName('Query Endpoint URL')
    .setDesc('SPARQL query endpoint (e.g., http://localhost:7878/query)')
    .addText(text => {
      text
      .setValue(client.endpointUrl)
      .setPlaceholder('http://localhost:7878/query')
      .onChange(async (value) => {
        client.endpointUrl = value
        await this.plugin.saveSettings()
      })
      text.inputEl.style.width = '100%'
      text.inputEl.style.fontFamily = 'var(--font-monospace)'
    })

    new Setting(container)
    .setName('Update Endpoint URL')
    .setDesc('SPARQL update endpoint (e.g., http://localhost:7878/update)')
    .addText(text => {
      text
      .setValue(client.updateUrl)
      .setPlaceholder('http://localhost:7878/update')
      .onChange(async (value) => {
        client.updateUrl = value
        await this.plugin.saveSettings()
      })
      text.inputEl.style.width = '100%'
      text.inputEl.style.fontFamily = 'var(--font-monospace)'
    })

    // Authentication (optional)
    const authDetails = container.createEl('details')
    authDetails.createEl('summary', { text: '🔐 Authentication (if required)' })

    new Setting(authDetails)
    .setName('Username')
    .addText(text => {
      text
      .setValue(client.user)
      .onChange(async (value) => {
        client.user = value
        await this.plugin.saveSettings()
      })
    })

    new Setting(authDetails)
    .setName('Password')
    .addText(text => {
      text
      .setValue(client.password)
      .onChange(async (value) => {
        client.password = value
        await this.plugin.saveSettings()
      })
      text.inputEl.type = 'password'
    })
  }

  addEmbeddedTriplestoreSettings(container) {
    container.createEl('h4', { text: 'Embedded Database Options' })
    container.createEl('p', {
      text: 'The embedded database stores triples locally using oxigraph-js.',
      cls: 'setting-item-description'
    })
  }

  addExternalTriplifierSettings(container) {
    container.createEl('h4', { text: 'OSG External Triplifier' })

    new Setting(container)
    .setName('OSG Executable Path')
    .setDesc('Full path to the OSG command-line tool')
    .addText(text => {
      text
      .setValue(this.plugin.settings.osgPath)
      .setPlaceholder('/usr/local/bin/osg')
      .onChange(async (value) => {
        this.plugin.settings.osgPath = value
        await this.plugin.saveSettings()
      })
      text.inputEl.style.width = '100%'
      text.inputEl.style.fontFamily = 'var(--font-monospace)'
    })
  }

  addEmbeddedTriplifierSettings(container) {
    container.createEl('h4', { text: 'dot-triples' })
    container.createEl('p', {
      text: 'Markdown is converted with the canonical dot-triples document model. Predicates use urn:token: IRIs; semantic mappings are applied downstream with SPARQL CONSTRUCT queries.',
      cls: 'setting-item-description'
    })
  }

  addPrefixManager(container, options) {
    const prefixSection = container.createEl('div', { cls: 'prefix-manager' })
    prefixSection.createEl('h5', { text: 'RDF Prefixes' })

    // Display existing prefixes
    const prefixList = prefixSection.createEl('div', { cls: 'prefix-list' })
    this.renderPrefixes(prefixList, options)

    // Add new prefix
    const addPrefixDiv = prefixSection.createEl('div', { cls: 'add-prefix' })

    new Setting(addPrefixDiv)
    .setName('Add Prefix')
    .setDesc('Add a new RDF prefix')
    .addButton(button => {
      button
      .setButtonText('Add Prefix')
      .onClick(() => {
        this.showAddPrefixModal(options)
      })
    })
  }

  renderPrefixes(container, options) {
    container.empty()

    if (!options.prefix || Object.keys(options.prefix).length === 0) {
      container.createEl('p', {
        text: 'No prefixes defined',
        cls: 'setting-item-description'
      })
      return
    }

    Object.entries(options.prefix).forEach(([prefix, uri]) => {
      const prefixItem = container.createEl('div', { cls: 'prefix-item' })

      new Setting(prefixItem)
      .setName(`${prefix}:`)
      .setDesc(uri)
      .addButton(button => {
        button
        .setIcon('trash')
        .setTooltip('Remove prefix')
        .onClick(async () => {
          delete options.prefix[prefix]
          await this.saveTriplifierOptions()
          this.renderPrefixes(container, options)
        })
      })
    })
  }

  addMappingsManager(container, options) {
    const mappingSection = container.createEl('div', { cls: 'mapping-manager' })
    mappingSection.createEl('h5', { text: 'Property Mappings' })
    mappingSection.createEl('p', {
      text: 'Map natural language phrases to RDF properties',
      cls: 'setting-item-description'
    })

    // Display existing mappings
    const mappingList = mappingSection.createEl('div', { cls: 'mapping-list' })
    this.renderMappings(mappingList, options)

    // Add new mapping
    new Setting(mappingSection)
    .setName('Add Mapping')
    .addButton(button => {
      button
      .setButtonText('Add Mapping')
      .onClick(() => {
        this.showAddMappingModal(options)
      })
    })
  }

  renderMappings(container, options) {
    container.empty()

    if (!options.mappings || Object.keys(options.mappings).length === 0) {
      container.createEl('p', {
        text: 'No mappings defined',
        cls: 'setting-item-description'
      })
      return
    }

    Object.entries(options.mappings).forEach(([phrase, property]) => {
      const mappingItem = container.createEl('div', { cls: 'mapping-item' })

      new Setting(mappingItem)
      .setName(phrase)
      .setDesc(`→ ${property}`)
      .addButton(button => {
        button
        .setIcon('trash')
        .setTooltip('Remove mapping')
        .onClick(async () => {
          delete options.mappings[phrase]
          await this.saveTriplifierOptions()
          this.renderMappings(container, options)
        })
      })
    })
  }

  addCodeBlockParsingSettings(container, options) {
    const codeBlockSection = container.createEl('div', { cls: 'codeblock-section' })
    codeBlockSection.createEl('h5', { text: 'Code Block Processing' })

    new Setting(codeBlockSection)
    .setName('Parse Turtle in Code Blocks')
    .setDesc('Language tags that trigger Turtle parsing (comma-separated)')
    .addText(text => {
      const currentValue = options.parseCodeBlockTurtleIn?.join(', ') || 'turtle;triplify'
      text
      .setValue(currentValue)
      .setPlaceholder('turtle;triplify, rdf')
      .onChange(async (value) => {
        options.parseCodeBlockTurtleIn = value.split(',').map(s => s.trim()).filter(s => s)
        await this.saveTriplifierOptions()
      })
      text.inputEl.style.width = '100%'
    })
  }

  addConfigActions(container) {
    const actionsDiv = container.createEl('div', { cls: 'config-actions' })
    actionsDiv.style.marginTop = '20px'
    actionsDiv.style.display = 'flex'
    actionsDiv.style.gap = '10px'

    new Setting(actionsDiv)
    .addButton(button => {
      button
      .setButtonText('Export Config')
      .onClick(() => {
        this.exportConfig()
      })
    })
    .addButton(button => {
      button
      .setButtonText('Import Config')
      .onClick(() => {
        this.importConfig()
      })
    })
    .addButton(button => {
      button
      .setButtonText('Reset to Defaults')
      .setWarning()
      .onClick(() => {
        this.resetToDefaults()
      })
    })
  }

  addTriplificationTriggers(container) {
    container.createEl('h5', { text: 'Triplification Triggers' })

    new Setting(container)
    .setName('Rebuild Index on Startup')
    .setDesc('Completely rebuild the RDF index when the plugin starts')
    .addToggle(toggle => {
      toggle
      .setValue(this.plugin.settings.rebuildOnStartup || false)
      .onChange(async (value) => {
        this.plugin.settings.rebuildOnStartup = value
        await this.plugin.saveSettings()
      })
    })

    new Setting(container)
    .setName('Index on Save')
    .setDesc('Automatically convert files to RDF when they are saved')
    .addToggle(toggle => {
      toggle
      .setValue(this.plugin.settings.indexOnSave)
      .onChange(async (value) => {
        this.plugin.settings.indexOnSave = value
        await this.plugin.saveSettings()
      })
    })

    new Setting(container)
    .setName('Index on Open')
    .setDesc('Automatically convert files to RDF when opened for the first time')
    .addToggle(toggle => {
      toggle
      .setValue(this.plugin.settings.indexOnOpen)
      .onChange(async (value) => {
        this.plugin.settings.indexOnOpen = value
        await this.plugin.saveSettings()
      })
    })
  }

  // Helper methods for modals
  showAddPrefixModal(options) {
    const modal = new AddPrefixModal(this.app, async (prefix, uri) => {
      if (!options.prefix) options.prefix = {}
      options.prefix[prefix] = uri
      await this.saveTriplifierOptions()
      this.display()
    })
    modal.open()
  }

  showAddMappingModal(options) {
    const modal = new AddMappingModal(this.app, async (phrase, property) => {
      if (!options.mappings) options.mappings = {}
      options.mappings[phrase] = property
      await this.saveTriplifierOptions()
      this.display()
    })
    modal.open()
  }

  async saveTriplifierOptions() {
    await this.plugin.saveSettings()
  }

  exportConfig() {
    const config = JSON.stringify(
      this.plugin.settings.embeddedSettings.triplifierOptions,
      null,
      2
    )
    navigator.clipboard.writeText(config)
    new Notice('Configuration copied to clipboard!')
  }

  importConfig() {
    const modal = new ImportConfigModal(this.app, async (config) => {
      try {
        const parsed = JSON.parse(config)
        this.plugin.settings.embeddedSettings.triplifierOptions = parsed
        await this.plugin.saveSettings()
        this.display()
        new Notice('Configuration imported successfully!')
      } catch (e) {
        new Notice('Invalid configuration: ' + e.message)
      }
    })
    modal.open()
  }

  resetToDefaults() {
    const modal = new ConfirmModal(
      this.app,
      'Reset to Defaults',
      'Are you sure you want to reset all triplifier options to defaults? This cannot be undone.',
      async () => {
        this.plugin.settings.embeddedSettings.triplifierOptions =
          JSON.parse(JSON.stringify(DEFAULT_SETTINGS.embeddedSettings.triplifierOptions))
        await this.plugin.saveSettings()
        this.display()
        new Notice('Reset to default configuration')
      }
    )
    modal.open()
  }
}

// Modal classes
import { Modal } from 'obsidian'

class AddPrefixModal extends Modal {
  constructor(app, onSubmit) {
    super(app)
    this.onSubmit = onSubmit
    this.prefix = ''
    this.uri = ''
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h2', { text: 'Add Prefix' })

    new Setting(contentEl)
    .setName('Prefix')
    .setDesc('Short prefix name (e.g., "foaf")')
    .addText(text => {
      text
      .setPlaceholder('foaf')
      .onChange(value => {
        this.prefix = value
      })

      // Keyboard shortcut support
      text.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          this.submit()
        }
      })
    })

    new Setting(contentEl)
    .setName('URI')
    .setDesc('Full namespace URI')
    .addText(text => {
      text
      .setPlaceholder('http://xmlns.com/foaf/0.1/')
      .onChange(value => {
        this.uri = value

        // URL validation with visual feedback
        try {
          new URL(value)
          text.inputEl.classList.remove('error')
        } catch {
          if (value) text.inputEl.classList.add('error')
        }
      })
      text.inputEl.style.width = '100%'

      // Keyboard shortcut support
      text.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          this.submit()
        }
      })
    })

    new Setting(contentEl)
    .addButton(button => {
      button
      .setButtonText('Cancel')
      .onClick(() => {
        this.close()
      })
    })
    .addButton(button => {
      button
      .setButtonText('Add')
      .setCta()
      .onClick(() => {
        this.submit()
      })
    })
  }

  submit() {
    if (this.prefix && this.uri) {
      try {
        new URL(this.uri) // Validate URL
        this.onSubmit(this.prefix, this.uri)
        this.close()
        new Notice(`Added prefix: ${this.prefix}`)
      } catch {
        new Notice('Please enter a valid URI')
      }
    } else {
      new Notice('Please fill in both fields')
    }
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}


class AddMappingModal extends Modal {
  constructor(app, onSubmit) {
    super(app)
    this.onSubmit = onSubmit
    this.phrase = ''
    this.property = ''
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h2', { text: 'Add Mapping' })

    new Setting(contentEl)
    .setName('Phrase')
    .setDesc('Natural language phrase (e.g., "is a")')
    .addText(text => {
      text
      .setPlaceholder('is a')
      .onChange(value => {
        this.phrase = value
      })

      // Keyboard shortcut support
      text.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          this.submit()
        }
      })
    })

    new Setting(contentEl)
    .setName('RDF Property')
    .setDesc('RDF property using prefix (e.g., "rdf:type")')
    .addText(text => {
      text
      .setPlaceholder('rdf:type')
      .onChange(value => {
        this.property = value
      })

      // Keyboard shortcut support
      text.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          this.submit()
        }
      })
    })

    new Setting(contentEl)
    .addButton(button => {
      button
      .setButtonText('Cancel')
      .onClick(() => {
        this.close()
      })
    })
    .addButton(button => {
      button
      .setButtonText('Add')
      .setCta()
      .onClick(() => {
        this.submit()
      })
    })
  }

  submit() {
    if (this.phrase && this.property) {
      this.onSubmit(this.phrase, this.property)
      this.close()
      new Notice(`Added mapping: "${this.phrase}" → ${this.property}`)
    } else {
      new Notice('Please fill in both fields')
    }
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}

class ImportConfigModal extends Modal {
  constructor(app, onSubmit) {
    super(app)
    this.onSubmit = onSubmit
    this.config = ''
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h2', { text: 'Import Configuration' })

    let textAreaComponent
    new Setting(contentEl)
    .setName('Configuration JSON')
    .setDesc('Paste your triplifier configuration JSON here')
    .addTextArea(text => {
      textAreaComponent = text
      text
      .setPlaceholder('{\n  "includeSelectors": true,\n  ...\n}')
      .onChange(value => {
        this.config = value

        // JSON validation with visual feedback
        try {
          if (value.trim()) {
            JSON.parse(value)
            text.inputEl.classList.remove('error')
          }
        } catch {
          if (value.trim()) text.inputEl.classList.add('error')
        }
      })
      text.inputEl.style.width = '100%'
      text.inputEl.style.height = '300px'
      text.inputEl.style.fontFamily = 'var(--font-monospace)'
      text.inputEl.style.fontSize = '13px'

      // Keyboard shortcut support
      text.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          this.submit()
        }
      })
    })

    new Setting(contentEl)
    .addButton(button => {
      button
      .setButtonText('Cancel')
      .onClick(() => {
        this.close()
      })
    })
    .addButton(button => {
      button
      .setButtonText('Import')
      .setCta()
      .onClick(() => {
        this.submit()
      })
    })
  }

  submit() {
    if (this.config) {
      try {
        JSON.parse(this.config) // Validate JSON
        this.onSubmit(this.config)
        this.close()
      } catch {
        new Notice('Invalid JSON format')
      }
    } else {
      new Notice('Please paste a configuration')
    }
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}

class ConfirmModal extends Modal {
  constructor(app, title, message, onConfirm) {
    super(app)
    this.title = title
    this.message = message
    this.onConfirm = onConfirm
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h2', { text: this.title })
    contentEl.createEl('p', { text: this.message })

    new Setting(contentEl)
    .addButton(button => {
      button
      .setButtonText('Cancel')
      .onClick(() => {
        this.close()
      })
    })
    .addButton(button => {
      button
      .setButtonText('Confirm')
      .setWarning()
      .onClick(() => {
        this.onConfirm()
        this.close()
      })
    })
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}
