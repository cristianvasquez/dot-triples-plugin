import { MarkdownRenderer, Notice, setIcon } from 'obsidian'
import { Parser } from 'sparqljs'
import { generateMarkdownTable, generateMarkdownTableRaw } from '../components/BindingsTableAsMarkdown.js'
import { resultsToMarkdownTurtle } from '../components/turtleAsMarkdown.js'
import { renderError } from '../components/renderError.js'
import { prettyPrint } from '../lib/prettyPrint.js'
import { replaceAllTokens } from '../lib/templates.js'
import { ns } from '../namespaces.js'
import { styleEditorCode } from '../components/editorCode.js'
import { queueLatest } from '../lib/queueLatest.js'

const queryBlocks = new WeakMap()
const resultContent = new WeakMap()
const queryRenders = new WeakMap()

export async function refreshSparqlViews (container, context) {
  await Promise.all([...container.querySelectorAll('.dot-triples-query-block')].map(block => {
    const query = queryBlocks.get(block)
    if (query) return renderSparqlView(query.source, block, context, query.debug)
  }))
}

/**
 * Vanilla JS SparqlView function to replace Vue component
 * Processes osg code blocks and renders SPARQL query results
 */
export async function renderSparqlView (
  source, container, context, debug = false) {
  container.classList.add('dot-triples-query-block')
  queryBlocks.set(container, { source, debug })
  await queueLatest(queryRenders, container, () =>
    renderSparqlViewNow(source, container, context, debug))
}

async function renderSparqlViewNow (source, container, context, debug) {
  try {
    // Get active file
    const activeFile = context.app.workspace.getActiveFile()
    if (!activeFile) {
      // Show simple message instead of throwing error
      if (resultContent.get(container) !== 'no-active-file') {
        container.innerHTML = '<p>No active file</p>'
        resultContent.set(container, 'no-active-file')
      }
      return
    }

    // Get absolute path and repo path
    const absolutePath = context.app.vault.adapter.getFullPath(activeFile.path)
    const repoPath = context.app.vault.adapter.basePath

    // Replace template variables
    const replacedQuery = replaceAllTokens(source, absolutePath, activeFile,
      repoPath)

    // Parse query to determine type
    const parser = new Parser({ skipValidation: true, sparqlStar: true })
    const parsed = parser.parse(replacedQuery)

    // Execute query based on type
    let results
    if (parsed.queryType === 'SELECT') {
      results = await context.controller.select(replacedQuery)
      await renderSelectResults(results, container, context, debug,
        replacedQuery)
    } else if (parsed.queryType === 'CONSTRUCT') {
      results = await context.controller.construct(replacedQuery)
      await renderConstructQuery(results, container, context, debug,
        replacedQuery)
    } else {
      throw new Error(`Unsupported query type: ${parsed.queryType}`)
    }
  } catch (error) {
    console.error('SPARQL View error:', error)
    
    // Always render error inline in the same place as SPARQL results
    const signature = JSON.stringify(['error', error.message || String(error)])
    if (resultContent.get(container) === signature) return
    const replacement = document.createElement('div')
    await renderError(error, replacement, context)
    container.replaceChildren(...replacement.childNodes)
    resultContent.set(container, signature)
  }
}

/**
 * Render SELECT query results as markdown table (BindingsTable)
 */
async function renderSelectResults (results, container, context, debug, query) {
  let markdown = ''

  // Results section
  if (!results || results.length === 0) {
    markdown += 'No results found.\n'
  } else {
    // Convert results to table format - both controllers now return plain objects
    const header = [...new Set(results.flatMap(row => Object.keys(row)))]
    
    const rows = results.map(row => {
      return header.map(key => {
        const value = row[key]
        return value || null  
      })
    })
    
    // Use raw table for debug mode, rich table for normal mode
    const markdownTable = debug 
      ? generateMarkdownTableRaw(header, rows, context.app)
      : generateMarkdownTable(header, rows, context.app)
    markdown += markdownTable
  }

  await renderResults(container, context, query, markdown, markdown,
    debug ? 'Results · Raw' : 'Results', results?.length || 0)
}

/**
 * Render CONSTRUCT query results as turtle (MarkdownTurtle)
 */
async function renderConstructQuery (
  results, container, context, debug, query) {
  const count = results?.length || 0
  const turtle = count ? prettyPrint(results, ns) : ''
  const markdown = !count ? 'No results found.' : debug
    ? `\`\`\`turtle
${turtle}
\`\`\``
    : resultsToMarkdownTurtle(results, context.app, '')

  await renderResults(container, context, query, markdown, turtle,
    debug ? 'Results · Turtle' : 'Results', count)
}

async function renderResults (container, context, query, markdown, copyText, label, count) {
  container.classList.add('dot-triples-results')
  const sourcePath = context.app.workspace.getActiveFile()?.path || ''
  const signature = JSON.stringify([sourcePath, query, markdown, copyText, label, count])
  if (resultContent.get(container) === signature) return
  const replacement = document.createElement('div')
  const render = async (text, target) => {
    target.classList.add('markdown-rendered')
    await MarkdownRenderer.render(context.app, text, target, sourcePath, context.plugin)
    styleEditorCode(target)
  }

  const toolbar = document.createElement('div')
  toolbar.className = 'dot-triples-results-toolbar'
  const queryToggle = document.createElement('button')
  queryToggle.type = 'button'
  queryToggle.className = 'dot-triples-query-toggle'
  queryToggle.setAttribute('aria-expanded', 'false')
  const queryLabel = document.createElement('span')
  queryLabel.textContent = 'Query'
  queryToggle.appendChild(queryLabel)
  toolbar.appendChild(queryToggle)
  const queryContent = document.createElement('div')
  queryContent.className = 'dot-triples-query'
  queryContent.hidden = true
  queryToggle.addEventListener('click', () => {
    queryContent.hidden = !queryContent.hidden
    queryToggle.setAttribute('aria-expanded', String(!queryContent.hidden))
  })

  const title = document.createElement('span')
  title.textContent = `${label} (${count})`
  toolbar.appendChild(title)
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.className = 'clickable-icon dot-triples-copy'
  setIcon(copy, 'copy')
  copy.title = 'Copy query results'
  copy.setAttribute('aria-label', copy.title)
  copy.disabled = count === 0
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      new Notice('Query results copied')
    } catch (error) {
      new Notice(`Could not copy results: ${error.message}`)
    }
  })
  toolbar.appendChild(copy)
  replacement.appendChild(toolbar)
  replacement.appendChild(queryContent)
  await render(`\`\`\`sparql\n${query}\n\`\`\``, queryContent)
  const body = document.createElement('div')
  body.className = 'dot-triples-results-body'
  replacement.appendChild(body)
  await render(markdown, body)
  container.replaceChildren(...replacement.childNodes)
  resultContent.set(container, signature)
}
