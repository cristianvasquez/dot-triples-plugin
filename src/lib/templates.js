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
  let processed = String(text)

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

is a :: osg:Query

osg:description :: DESCRIPTION to the agent

osg:instruction :: INSTRUCTION after query

\`\`\`osg
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX dot: <http://pending.org/dot/>
PREFIX oa: <http://www.w3.org/ns/oa#>
PREFIX schema: <http://schema.org/>
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
\`\`\`osg
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX dot: <http://pending.org/dot/>
PREFIX oa: <http://www.w3.org/ns/oa#>
PREFIX schema: <http://schema.org/>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT * WHERE {  
    GRAPH ?g {
      __THIS__ ?p ?o
    }
    FILTER (?p!=dot:raw)
    FILTER (?p!=dot:contents)
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
