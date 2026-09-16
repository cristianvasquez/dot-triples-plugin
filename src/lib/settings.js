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
PREFIX schema: <https://schema.org/>
PREFIX resource: <osg://vocab/resource#>
PREFIX oa: <http://www.w3.org/ns/oa#>

SELECT ?document ?title ?content WHERE {
    GRAPH ?g {
        ?document schema:keywords "panel/query" ;
                  schema:about? ?panel .
        ?panel schema:hasPart ?part .
        ?part a schema:SoftwareSourceCode ;
              schema:programmingLanguage "dot-sparql" ;
              resource:selector ?selector .
        ?selector a oa:TextQuoteSelector ; oa:exact ?query .
        OPTIONAL { ?document rdfs:label ?documentTitle }
        OPTIONAL { ?panel rdfs:label ?panelTitle }
        OPTIONAL { ?document <urn:token:order> ?order }
        BIND(COALESCE(?panelTitle, ?documentTitle, STR(?document)) AS ?title)
        BIND(CONCAT("\`\`\`dot-sparql\\n", STR(?query), "\\n\`\`\`") AS ?content)
    }
} ORDER BY ?order`,
}

const PREVIOUS_PANEL_QUERY = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?document ?title ?content WHERE {
    GRAPH ?g {
        ?document <urn:token:tags> "panel/query" ;
                  <urn:token:about> ?panel .
        ?panel <urn:code-block:dot-sparql> ?query .
        OPTIONAL { ?document <urn:token:title> ?documentTitle }
        OPTIONAL { ?panel rdfs:label ?panelTitle }
        OPTIONAL { ?document <urn:token:order> ?order }
        BIND(COALESCE(?panelTitle, ?documentTitle) AS ?title)
        BIND(CONCAT("\`\`\`dot-sparql\\n", STR(?query), "\\n\`\`\`") AS ?content)
    }
} ORDER BY ?order`

export function migrateSettings (settings) {
  const panelQuery = settings.panelQuery || ''
  const usesLegacyPanelModel = panelQuery.includes('dot:MarkdownDocument') &&
    panelQuery.includes('dot:raw')

  const usesPreviousDefault = panelQuery.replace(/\s+/g, ' ').trim() ===
    PREVIOUS_PANEL_QUERY.replace(/\s+/g, ' ').trim()

  return usesLegacyPanelModel || usesPreviousDefault
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
    containerEl.createEl('h2', { text: 'Dot Triples' })

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

  addTriplificationTriggers(container) {
    new Setting(container)
    .setName('Index on save')
    .setDesc('Re-index a note when it is saved.')
    .addToggle(toggle => toggle
      .setValue(this.plugin.settings.indexOnSave)
      .onChange(async (value) => {
        this.plugin.settings.indexOnSave = value
        await this.plugin.saveSettings()
      }))

    new Setting(container)
    .setName('Index on open')
    .setDesc('Re-index a note when it is opened.')
    .addToggle(toggle => toggle
      .setValue(this.plugin.settings.indexOnOpen)
      .onChange(async (value) => {
        this.plugin.settings.indexOnOpen = value
        await this.plugin.saveSettings()
      }))

    new Setting(container)
    .setName('Rebuild on startup')
    .setDesc('Re-index the whole vault when Obsidian starts.')
    .addToggle(toggle => toggle
      .setValue(this.plugin.settings.rebuildOnStartup)
      .onChange(async (value) => {
        this.plugin.settings.rebuildOnStartup = value
        await this.plugin.saveSettings()
      }))
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
    examplesDiv.innerHTML = '💡 <strong>Examples:</strong> See <a href="https://github.com/cristianvasquez/dot-triples-plugin/tree/main/example-panels" target="_blank">example-panels/</a> for ready-to-use SPARQL query panels.'

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
      text: 'Markdown is converted with the canonical dot-triples document model. Files carry frontmatter; notes and headings carry fields and references. Body fields use urn:token: IRIs; tags, links, and code blocks use the document vocabulary.',
      cls: 'setting-item-description'
    })
  }

}
