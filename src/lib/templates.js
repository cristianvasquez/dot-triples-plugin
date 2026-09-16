import { pathToFileURL } from 'canonical-md'
import {
  replaceInternalLinks,
  replacePropertyPlaceholders,
  rewriteQuery,
} from 'sparql-md/rewrite'

const DATE = '__DATE__' // The current date

/**
 * Replace all template variables in text (both markdown and SPARQL)
 */
function replaceAllTokens (text, absolutePath, activeFile, repoPath) {
  return mapOutsideCodeSpans(String(text), part => expandTokens(part, absolutePath, repoPath))
}

// Fenced query blocks remain executable; only inline code is literal.
function mapOutsideCodeSpans (text, transform) {
  const lines = text.split(/(?<=\n)/)
  let output = ''
  let prose = ''
  let fence = null
  const flush = () => {
    let start = 0
    const runs = [...prose.matchAll(/`+/g)]
    for (let i = 0; i < runs.length; i++) {
      const opening = runs[i]
      const closingIndex = runs.findIndex((run, j) => j > i && run[0] === opening[0])
      if (closingIndex < 0) continue
      const closing = runs[closingIndex]
      output += transform(prose.slice(start, opening.index))
      start = closing.index + closing[0].length
      output += prose.slice(opening.index, start)
      i = closingIndex
    }
    output += transform(prose.slice(start))
    prose = ''
  }
  for (const line of lines) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/m)
    if (fence) {
      output += transform(line)
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) {
        fence = null
      }
    } else if (marker) {
      flush()
      fence = marker[1]
      output += line
    } else {
      prose += line
    }
  }
  flush()
  return output
}

function expandTokens (text, absolutePath, repoPath) {
  let processed = text

  // Replace __DATE__ with current timestamp
  if (processed.includes(DATE)) {
    const currentTime = new Date().toLocaleTimeString()
    processed = processed.replaceAll(DATE, currentTime)
  }

  return rewriteQuery(processed, {
    filePath: absolutePath,
    repoUri: repoPath ? pathToFileURL(repoPath).value : undefined,
  })
}

/**
 * Remove YAML frontmatter from markdown content
 */
function removeFrontmatter (content) {
  // Check if content starts with frontmatter
  if (content.trimStart().startsWith('---')) {
    const lines = content.split('\n')
    let frontmatterEnd = -1

    // Find the closing --- after the first line
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        frontmatterEnd = i
        break
      }
    }

    // If we found closing ---, remove frontmatter
    if (frontmatterEnd > 0) {
      return lines.slice(frontmatterEnd + 1).join('\n').trimStart()
    }
  }

  return content
}

function getOSGQueryTemplate () {
  return `

## Named Query

\`\`\`dot-sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX oa: <http://www.w3.org/ns/oa#>
PREFIX schema: <https://schema.org/>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT * WHERE {  
    GRAPH __DOC__ {
      ?s ?p ?o
    }
  }
\`\`\`
`
}

function getTemplate () {
  return `
\`\`\`dot-sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX oa: <http://www.w3.org/ns/oa#>
PREFIX schema: <https://schema.org/>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT * WHERE {  
    GRAPH ?g {
      __THIS__ ?p ?o
    }
  } LIMIT 10
\`\`\`
`
}

export {
  replaceInternalLinks,
  replacePropertyPlaceholders,
  replaceAllTokens,
  removeFrontmatter,
  getOSGQueryTemplate,
  getTemplate,
}
