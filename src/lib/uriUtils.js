import { tokenFromURI } from 'canonical-md'

/**
 * Get the display name from a file path
 * @param {string} filePath - The file path
 * @returns {string} The name without .md extension
 */
export function getNameFromPath (filePath) {
  if (!filePath) return ''
  const fileName = filePath.split('/').pop() || ''
  return fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName
}

/**
 * Check if a term is a file URI
 * @param {Object} term - RDF term
 * @returns {boolean}
 */
export function isFileUri (term) {
  return term?.termType === 'NamedNode' &&
    term.value?.startsWith('file://')
}

/**
 * Check if a term is a property URI
 * @param {Object} term - RDF term
 * @returns {boolean}
 */
export function isTokenUri (term) {
  return term?.termType === 'NamedNode' &&
    term.value !== 'urn:token:_' &&
    tokenFromURI(term) !== null
}
