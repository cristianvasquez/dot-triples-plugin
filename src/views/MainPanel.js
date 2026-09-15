import { DropdownComponent, MarkdownRenderer } from 'obsidian'
import { QUERY_TEMPLATES } from '../queries.js'
import { replaceAllTokens, removeFrontmatter } from '../lib/templates.js'

// Store selected template and mode globally to persist across file changes
let selectedTemplateKey = 'current-file'
let isRichMode = true // true = 'dot-sparql' (rich), false = 'dot-sparql-debug' (raw)
let availablePanels = {} // Cache for dynamically loaded panels
let panelsLoaded = false // Track if panels have been loaded
let currentDropdownSelect = null // Reference to current dropdown for refresh

/**
 * Load available query templates using Obsidian metadata (tag-based filtering)
 */
export async function loadQueriesViaObsidian (context) {
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
 * Load available query templates using SPARQL
 */
async function loadQueriesViaSPARQL (context) {
  // Use configurable query from settings
  const discoveryQuery = context.plugin.settings.panelQuery


  try {
    const results = await context.controller.select(discoveryQuery)
    const queries = {}

    // Add discovered queries
    results.forEach(result => {
      const title = result.title?.value || 'Untitled Query'
      const content = result.content?.value || ''
      const key = title.toLowerCase().replace(/\s+/g, '-')
      queries[key] = content
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

  // Load from both sources and merge (SPARQL takes precedence for duplicates)
  try {
    const obsidianPanels = await loadQueriesViaObsidian(context)
    Object.assign(panels, obsidianPanels)
  } catch (error) {
    console.warn('Failed to load panels from Obsidian:', error)
  }

  try {
    const sparqlPanels = await loadQueriesViaSPARQL(context)
    Object.assign(panels, sparqlPanels) // SPARQL takes precedence
  } catch (error) {
    console.warn('Failed to load panels from SPARQL:', error)
  }

  // Only use hardcoded fallback if no panels were discovered from either source
  if (Object.keys(panels).length === 0) {
    Object.assign(panels, QUERY_TEMPLATES)
  }

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
  container.style.marginBottom = '10px'
  container.style.padding = '5px'
  container.style.borderBottom = '1px solid var(--background-modifier-border)'
  container.style.display = 'flex'
  container.style.alignItems = 'center'
  container.style.gap = '15px'

  // Template selector
  const templateGroup = document.createElement('div')
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
  richLabel.style.fontSize = '12px'

  // Add change handler for checkbox
  richCheckbox.addEventListener('change', () => {
    isRichMode = richCheckbox.checked
    if (onModeChange) {
      onModeChange(isRichMode)
    }
  })

  modeGroup.appendChild(richCheckbox)
  modeGroup.appendChild(richLabel)

  // Refresh button
  const refreshButton = document.createElement('button')
  refreshButton.textContent = '🔄'
  refreshButton.title = 'Refresh panels'
  refreshButton.style.padding = '2px 6px'
  refreshButton.style.fontSize = '12px'
  refreshButton.style.background = 'var(--background-primary)'
  refreshButton.style.border = '1px solid var(--background-modifier-border)'
  refreshButton.style.borderRadius = '3px'
  refreshButton.style.cursor = 'pointer'
  refreshButton.style.opacity = '0.7'
  refreshButton.addEventListener('mouseenter', () => refreshButton.style.opacity = '1')
  refreshButton.addEventListener('mouseleave', () => refreshButton.style.opacity = '0.7')

  container.appendChild(templateGroup)
  container.appendChild(modeGroup)
  container.appendChild(refreshButton)

  return { container, select, refreshButton }
}

/**
 * Render query with selected template
 */
async function renderQuery (container, templateKey, context) {
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
    activeFile)

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
  const { container: controlsContainer, select, refreshButton } = createControls(
    context,
    (templateKey) => {
      renderQuery(container, templateKey, context)
    },
    (richMode) => {
      renderQuery(container, selectedTemplateKey, context)
    },
  )

  // Add refresh button click handler
  refreshButton.addEventListener('click', async () => {
    refreshButton.textContent = '⏳'
    refreshButton.disabled = true
    try {
      await refreshPanelQueries(context)
      // Re-render current query with updated panels
      await renderQuery(container, selectedTemplateKey, context)
    } catch (error) {
      console.error('Failed to refresh panels:', error)
    } finally {
      refreshButton.textContent = '🔄'
      refreshButton.disabled = false
    }
  })

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
  // If container is empty or force init, do full initialization
  if (container.innerHTML === '' || forceInit) {
    await initializeDebugPanel(container, context)
  } else {
    // Otherwise just update the query content
    await updateQueryContent(container, context)
  }
}
