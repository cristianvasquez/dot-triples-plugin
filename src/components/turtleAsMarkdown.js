import { getBasePath } from '../lib/utils.js'
import {
  termAsMarkdown,
} from './termAsMarkdown.js'
import {
  sortTriplesBySubject,
  sortTriplesByProperty,
} from './helpers/tripleSorter.js'
import { ns } from '../namespaces.js'

/**
 * Convert SPARQL CONSTRUCT results to grouped layout with subjects as headers
 * @param {Array} results - SPARQL CONSTRUCT results (array of triples)
 * @param {Object} app - Obsidian app instance
 * @param {string} title - Optional title for the output (empty string to skip title)
 * @returns {string} Markdown with subjects as headers and property-value tables
 */
export function resultsToMarkdownTurtle (
  results, app, title = 'Turtle Output') {
  if (!results || results.length === 0) {
    const titleSection = title ? `# ${title}\n\n` : ''
    return `${titleSection}(No triples found)`
  }

  const basePath = getBasePath(app)

  // Sort by subject priority: document:File -> Normal -> Blank nodes
  const sortedResults = sortTriplesBySubject(results)

  // Group triples by subject
  const subjectGroups = new Map()
  for (const result of sortedResults) {
    const subjectKey = result.subject.value
    if (!subjectGroups.has(subjectKey)) {
      subjectGroups.set(subjectKey, [])
    }
    subjectGroups.get(subjectKey).push(result)
  }

  const escape = (s) => s?.replace(/\|/g, '\\|') ?? ''
  const sections = []

  // Create sections for each subject
  for (const [subjectKey, triples] of subjectGroups) {
    const subjectMarkdown = termAsMarkdown(triples[0].subject, basePath)

    // Check if this is a document:File
    const isDocumentFile = triples.some(triple =>
      triple.predicate.value === ns.rdf.type.value &&
      triple.object.value === ns.document('File').value,
    )

    // Property-Value table
    const propertyHeader = '| Property | Value |'
    const propertyDivider = '| --- | --- |'

    // Sort properties with rdf:type first
    const sortedTriples = sortTriplesByProperty(triples)

    let lastPredicate = null
    const propertyRows = sortedTriples.map(result => {
      const predicateValue = result.predicate.value
      const predicate = predicateValue === lastPredicate ? '' : termAsMarkdown(
        result.predicate, basePath)
      const object = termAsMarkdown(result.object, basePath)
      lastPredicate = predicateValue
      return `| ${escape(predicate)} | ${escape(object)} |`
    })

    const tableContent = [
      propertyHeader,
      propertyDivider,
      ...propertyRows].join('\n')

    if (isDocumentFile) {
      // Wrap document:File sections in collapsible details
      sections.push(
        `<details>\n<summary>Document metadata</summary>\n\n${tableContent}\n\n</details>`)
    } else {
      // Regular section with header
      sections.push(`## ${escape(subjectMarkdown)}\n\n${tableContent}`)
    }
  }

  const titleSection = title ? `# ${title}\n\n` : ''
  return `${titleSection}${sections.join('\n\n')}`
}
