import { pathToFileURL } from 'canonical-md'
import { DropdownComponent, MarkdownRenderer, Notice, setIcon } from 'obsidian'
import { QUERY_TEMPLATES } from '../queries.js'
import { replaceAllTokens, removeFrontmatter } from '../lib/templates.js'

// Store selected template and mode globally to persist across file changes
let selectedTemplateKey = 'current-file'
let isRichMode = true // true = 'dot-sparql' (rich), false = 'dot-sparql-debug' (raw)
let availablePanels = {} // Cache for dynamically loaded panels
let panelSources = {}
let currentSourceButton = null
let panelsLoaded = false // Track if panels have been loaded
let currentDropdownSelect = null // Reference to current dropdown for refresh

/**
 * Load available query templates using Obsidian metadata (tag-based filtering)
 */
export async function loadQueriesViaObsidian (context, sources = {}) {
  const queries = {}

  try {
    const searchQuery = context.plugin.settings.panelTag ||
      'panel/query'
    const tag = searchQuery.replace(/^tag:/, '').trim() // e.g., "#panel/query"

    const files = context.app.vault.getMarkdownFiles()

    for (const file of files) {
      const cache = context.app.metadataCache.getFileCache(file)
      const frontmatter = (cache && cache.frontmatter) || {}
      const tags = extractTagsFromCache(cache)

      if (!tags.includes(tag)) continue

      try {
        const content = await context.app.vault.read(file)
        let title = typeof frontmatter.title === 'string'
          ? frontmatter.title.replace(/^"+|"+$/g, '')
          : file.basename

        let order = 999
        if (typeof frontmatter.order === 'string') {
          order = parseInt(frontmatter.order.replace(/"/g, ''), 10) || 999
        } else if (typeof frontmatter.order === 'number') {
          order = frontmatter.order
        }

        const key = title.toLowerCase().replace(/\s+/g, '-')
        queries[key] = { content, title, order }
        sources[key] = file.path
      } catch (err) {
        console.warn(`⚠️ Failed to read file "${file.path}":`, err)
      }
    }

    const sorted = Object.entries(queries).
      sort(([, a], [, b]) => a.order - b.order).
      reduce((acc, [key, data]) => {
        acc[key] = data.content
        return acc
      }, {})

    return sorted

  } catch (error) {
    console.error('❌ Failed to load queries via Obsidian search:', error)
    return {}
  }
}

/**
 * Extract tags from metadata cache (frontmatter and inline)
 */
function extractTagsFromCache (cache) {
  const tags = []

  const frontmatterTags = cache?.frontmatter?.tags
  if (Array.isArray(frontmatterTags)) {
    tags.push(...frontmatterTags)
  } else if (typeof frontmatterTags === 'string') {
    tags.push(...frontmatterTags.split(/\s+/))
  }

  if (Array.isArray(cache?.tags)) {
    for (const tagObj of cache.tags) {
      tags.push(tagObj.tag)
    }
  }

  return [...new Set(tags)]
}

/**
 * True when the file carries the configured panel tag (i.e. it defines a panel).
 * Used to decide when the side panel must reload its panel definitions.
 */
export function fileHasPanelTag (context, file) {
  if (!file) return false
  const searchQuery = context.plugin.settings.panelTag || 'panel/query'
  const tag = searchQuery.replace(/^tag:/, '').trim()
  const cache = context.app.metadataCache.getFileCache(file)
  return extractTagsFromCache(cache).includes(tag)
}

/**
 * Load available query templates using SPARQL
 */
async function loadQueriesViaSPARQL (context, sources) {
  // Use configurable query from settings
  const discoveryQuery = context.plugin.settings.panelQuery


  try {
    const results = await context.controller.select(discoveryQuery)
    const queries = {}

    const filesByUri = new Map(context.app.vault.getMarkdownFiles().map(file => [
      pathToFileURL(context.app.vault.adapter.getFullPath(file.path)).value,
      file.path,
    ]))

    // Add discovered queries
    results.forEach(result => {
      const title = result.title?.value || 'Untitled Query'
      const content = result.content?.value || ''
      const key = title.toLowerCase().replace(/\s+/g, '-')
      queries[key] = content
      sources[key] = filesByUri.get(result.document?.value) || null
    })

    return queries
  } catch (error) {
    console.error('Failed to load queries via SPARQL:', error)
    console.error('Query used:', discoveryQuery)
    return {}
  }
}

/**
 * Load available panels from both SPARQL and Obsidian sources
 */
async function loadAvailablePanels (context) {
  let panels = {}
  const sources = {}

  // Load from both sources and merge (SPARQL takes precedence for duplicates)
  try {
    const obsidianPanels = await loadQueriesViaObsidian(context, sources)
    Object.assign(panels, obsidianPanels)
  } catch (error) {
    console.warn('Failed to load panels from Obsidian:', error)
  }

  try {
    const sparqlPanels = await loadQueriesViaSPARQL(context, sources)
    Object.assign(panels, sparqlPanels) // SPARQL takes precedence
  } catch (error) {
    console.warn('Failed to load panels from SPARQL:', error)
  }

  // Only use hardcoded fallback if no panels were discovered from either source
  if (Object.keys(panels).length === 0) {
    Object.assign(panels, QUERY_TEMPLATES)
  }

  panelSources = sources
  availablePanels = panels
  return panels
}

/**
 * Populate dropdown with available queries
 */
function populateDropdown (select, queries) {
  // Clear existing options
  select.innerHTML = ''

  // Add options for each query
  Object.keys(queries).forEach(key => {
    const option = document.createElement('option')
    option.value = key
    option.textContent = key.replace(/-/g, ' ').
      replace(/\b\w/g, l => l.toUpperCase())
    select.appendChild(option)
  })
}

/**
 * Create template selector dropdown with mode radio button
 */
function createControls (context, onTemplateChange, onModeChange) {
  const container = document.createElement('div')
  container.className = 'dot-triples-controls'

  // Template selector
  const templateGroup = document.createElement('div')
  templateGroup.className = 'dot-triples-template'
  templateGroup.style.display = 'flex'
  templateGroup.style.alignItems = 'center'

  const label = document.createElement('label')
  label.textContent = 'Template: '
  label.style.marginRight = '8px'
  label.style.fontSize = '12px'
  templateGroup.appendChild(label)

  // Use Obsidian's own DropdownComponent (class="dropdown") so the popup
  // renders through Obsidian's theming instead of the OS-native <select>
  // popup, which ignored the app theme and showed the view content through it.
  const dropdownComponent = new DropdownComponent(templateGroup)
  const select = dropdownComponent.selectEl
  select.style.fontSize = '12px'

  // Dropdown will be populated later after queries are loaded

  // Add change handler
  select.addEventListener('change', () => {
    selectedTemplateKey = select.value // Persist selection
    if (onTemplateChange) {
      onTemplateChange(select.value)
    }
  })

  // Rich mode checkbox
  const modeGroup = document.createElement('div')
  modeGroup.style.display = 'flex'
  modeGroup.style.alignItems = 'center'
  modeGroup.style.gap = '4px'

  const richCheckbox = document.createElement('input')
  richCheckbox.type = 'checkbox'
  richCheckbox.checked = isRichMode
  richCheckbox.style.marginRight = '4px'

  const richLabel = document.createElement('label')
  richLabel.textContent = 'Rich'
  richLabel.prepend(richCheckbox)
  richLabel.style.fontSize = '12px'

  // Add change handler for checkbox
  richCheckbox.addEventListener('change', () => {
    isRichMode = richCheckbox.checked
    if (onModeChange) {
      onModeChange(isRichMode)
    }
  })

  modeGroup.appendChild(richLabel)

  const sourceButton = document.createElement('button')
  sourceButton.type = 'button'
  sourceButton.className = 'clickable-icon dot-triples-source'
  setIcon(sourceButton, 'file-input')
  sourceButton.addEventListener('click', async () => {
    const path = panelSources[selectedTemplateKey]
    if (!path) return
    try {
      await context.app.workspace.openLinkText(path, '', false)
    } catch (error) {
      new Notice(`Could not open panel source: ${error.message}`)
    }
  })

  container.appendChild(templateGroup)
  container.appendChild(modeGroup)
  container.appendChild(sourceButton)

  return { container, select, sourceButton }
}

function updateSourceButton () {
  if (!currentSourceButton) return
  const path = panelSources[selectedTemplateKey]
  currentSourceButton.disabled = !path
  currentSourceButton.title = path ? `Open panel source: ${path}` : 'No source note for this panel'
  currentSourceButton.setAttribute('aria-label', currentSourceButton.title)
}

/**
 * Render query with selected template
 */
async function renderQuery (container, templateKey, context) {
  updateSourceButton()
  const activeFile = context.app.workspace.getActiveFile()
  const absolutePath = activeFile ? context.app.vault.adapter.getFullPath(
    activeFile.path) : ''

  // Get the raw markdown template
  const markdownTemplate = availablePanels[templateKey]
  if (!markdownTemplate) {
    console.error(`Template '${templateKey}' not found`)
    return
  }

  // Remove frontmatter
  const cleanedMarkdown = removeFrontmatter(markdownTemplate)

  // Apply unified token replacement to the entire markdown content
  const processedMarkdown = replaceAllTokens(cleanedMarkdown, absolutePath,
    activeFile, context.app.vault.adapter.basePath)

  // Update the code block type based on rich mode
  const finalMarkdown = processedMarkdown.replace(
    /```dot-sparql\n/g,
    `\`\`\`${isRichMode ? 'dot-sparql' : 'dot-sparql-debug'}\n`,
  )

  await renderMarkdown(container, finalMarkdown, context)
}

/**
 * Helper to render markdown
 */
async function renderMarkdown (container, markdown, context) {
  const activeFile = context.app.workspace.getActiveFile()
  const sourcePath = activeFile ? activeFile.path : ''

  // Clear only the query content, not the selector
  const queryContainer = container.querySelector('.query-content') || (() => {
    const div = document.createElement('div')
    div.className = 'query-content'
    container.appendChild(div)
    return div
  })()

  queryContainer.innerHTML = ''

  await MarkdownRenderer.render(
    context.app,
    markdown,
    queryContainer,
    sourcePath,
    context.plugin,
  )
}

/**
 * Refresh available panels from all sources
 */
export async function refreshPanelQueries (context) {
  // Force reload panels from all sources
  panelsLoaded = false
  await loadAvailablePanels(context)

  // Update dropdown if it exists
  if (currentDropdownSelect) {
    populateDropdown(currentDropdownSelect, availablePanels)

    // Ensure selectedTemplateKey exists in available panels
    if (!availablePanels[selectedTemplateKey]) {
      // First try to use 'current-file' as default
      if (availablePanels['current-file']) {
        selectedTemplateKey = 'current-file'
      } else {
        // Otherwise use the first available panel
        const firstKey = Object.keys(availablePanels)[0]
        if (firstKey) {
          selectedTemplateKey = firstKey
        }
      }
    }

    // Set the dropdown value after populating
    currentDropdownSelect.value = selectedTemplateKey
  }
  updateSourceButton()
}

/**
 * Initialize the debug panel (only called once when panel is first opened)
 */
async function initializeDebugPanel (container, context) {
  container.innerHTML = ''

  // Load available panels from all sources only once
  if (!panelsLoaded) {
    await loadAvailablePanels(context)
    panelsLoaded = true
  }

  // Create controls with change handlers
  const { container: controlsContainer, select, sourceButton } = createControls(
    context,
    (templateKey) => {
      renderQuery(container, templateKey, context)
    },
    (richMode) => {
      renderQuery(container, selectedTemplateKey, context)
    },
  )

  currentSourceButton = sourceButton

  container.appendChild(controlsContainer)

  // Store reference to dropdown for refresh functionality
  currentDropdownSelect = select

  // Update dropdown with loaded panels
  populateDropdown(select, availablePanels)

  // Ensure selectedTemplateKey exists in available panels
  if (!availablePanels[selectedTemplateKey]) {
    // First try to use 'current-file' as default
    if (availablePanels['current-file']) {
      selectedTemplateKey = 'current-file'
    } else {
      // Otherwise use the first available panel
      const firstKey = Object.keys(availablePanels)[0]
      if (firstKey) {
        selectedTemplateKey = firstKey
      }
    }
  }

  // Set the dropdown value after populating
  select.value = selectedTemplateKey

  // Initial render with persisted selected template and mode
  await renderQuery(container, selectedTemplateKey, context)

  // Manual event delegation for both wiki links and file:// links in side panel
  container.addEventListener('click', (event) => {
    const linkEl = event.target.closest('a')
    if (linkEl) {
      const href = linkEl.getAttribute('data-href') ||
        linkEl.getAttribute('href')

      if (href) {
        // Handle internal wiki links
        if (linkEl.classList.contains('internal-link')) {
          event.preventDefault()
          const activeFile = context.app.workspace.getActiveFile()
          const sourcePath = activeFile ? activeFile.path : ''
          context.app.workspace.openLinkText(href, sourcePath)
        }
        // Handle file:// links
        else if (href.startsWith('file://')) {
          event.preventDefault()
          try {
            // Convert file:// URL to path and open in Obsidian
            const filePath = decodeURIComponent(href.replace('file://', ''))
            const relativePath = context.app.vault.adapter.path.relative(
              context.app.vault.adapter.basePath,
              filePath,
            )

            // Try to open the file if it exists in the vault
            const file = context.app.vault.getAbstractFileByPath(relativePath)
            if (file) {
              context.app.workspace.openLinkText(relativePath, '')
            } else {
              // Fallback: try to open with system default
              require('electron').shell.openPath(filePath)
            }
          } catch (error) {
            console.error('Failed to open file:', error)
            // Last resort: try electron shell
            try {
              require('electron').shell.openExternal(href)
            } catch (e) {
              console.error('Failed to open with shell:', e)
            }
          }
        }
      }
    }
  })
}

/**
 * Update only the query content for file changes (lightweight)
 */
async function updateQueryContent (container, context) {
  // Only update the query content, not the entire panel
  await renderQuery(container, selectedTemplateKey, context)
}

/**
 * Main entry point - decides whether to initialize or just update content
 */
export async function renderPanel (container, context, forceInit = false) {
  container.classList.add('dot-triples-panel')
  // If container is empty or force init, do full initialization
  if (container.innerHTML === '' || forceInit) {
    await initializeDebugPanel(container, context)
  } else {
    // Otherwise just update the query content
    await updateQueryContent(container, context)
  }
}
