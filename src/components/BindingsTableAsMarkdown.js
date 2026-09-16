import { getBasePath } from '../lib/utils.js'
import { termAsMarkdown } from './termAsMarkdown.js'
import { safe } from './termAsMarkdown.js'
import toNT from '@rdfjs/to-ntriples'

/**
 * Generate raw markdown table from SELECT query results using raw string representation
 * @param {Array} header - Table header array
 * @param {Array} rows - Table rows array
 * @param {Object} app - Obsidian app instance
 * @returns {string} Markdown table string
 */
export function generateMarkdownTableRaw (header, rows, app) {
  const headerRow = `| ${header.map(safe).join(' | ')} |`
  const dividerRow = `| ${header.map(() => '---').join(' | ')} |`
  const dataRows = rows.map(row =>
    `| ${row.map(term => {
      if (!term) return ''
      try {
        return safe(toNT(term))
      } catch (error) {
        console.warn('Error converting term to N-Triples:', error, term)
        return safe(String(term.value || term || ''))
      }
    }).join(' | ')} |`,
  )

  return [headerRow, dividerRow, ...dataRows].join('\n')
}

/**
 * Generate rich markdown table preserving every SELECT result binding
 * Replaces SimpleTable.vue functionality
 * @param {Array} header - Table header array
 * @param {Array} rows - Table rows array
 * @param {Object} app - Obsidian app instance
 * @returns {string} Markdown table string
 */
export function generateMarkdownTable (header, rows, app) {
  const basePath = getBasePath(app)

  const escape = (s) => s?.replace(/\|/g, '\\|') ?? ''
  const headerRow = `| ${header.map(escape).join(' | ')} |`
  const dividerRow = `| ${header.map(() => '---').join(' | ')} |`

  const dataRows = rows.map(row => {
    const cells = row.map(term => term ? termAsMarkdown(term, basePath) : '')
    return `| ${cells.join(' | ')} |`
  })

  return [headerRow, dividerRow, ...dataRows].join('\n')
}
