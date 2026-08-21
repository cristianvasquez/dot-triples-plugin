const currentFileMarkdown = `> __FILENAME__ - Current File Triples -- __DATE__

\`\`\`dot-sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX dot: <http://pending.org/dot/>

CONSTRUCT { ?s ?p ?o } WHERE {
    GRAPH __DOC__ {
      ?s ?p ?o
    }
    FILTER (?p!=dot:raw)
    FILTER (?p!=dot:content)

  }
\`\`\`

(Default query - No additional queries were found) 
`
const QUERY_TEMPLATES = {
  'current-file': currentFileMarkdown,
}

export { QUERY_TEMPLATES }
