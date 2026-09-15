---
uuid: 60bd1c36-c612-46a5-80a1-e2d3f4edf54b
tags:
  - panel/query
title: Similar tags
order: "6"
---

# Tags

- rdfs:comment :: Tags of this document, and other documents sharing a tag.

## Tags of this document

```dot-sparql
PREFIX dot: <http://pending.org/dot/>

SELECT DISTINCT ?tag 
WHERE {  
    GRAPH __DOC__ {
       ?current dot:tag ?tag
    }
}
```

## Documents sharing a tag

```dot-sparql
PREFIX dot: <http://pending.org/dot/>
PREFIX oa: <http://www.w3.org/ns/oa#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT  ?tag ?file ?repo ?obdidian_url 
WHERE {
  BIND(__DOC__ AS ?document)

  VALUES ?type { dot:NamedConcept oa:Annotation }

  # Get typed resources with labels in the current document
  GRAPH ?document {
    ?c1 dot:tag ?tag .
  }

  # Find matching resources with labels in other graphs
  GRAPH ?file {
    ?c2 dot:tag ?tag .
    ?file dot:inRepository ?repo .
  }

  FILTER (?file != ?document)

  # Generate Obsidian URL for the file in the other repo
  BIND(STR(?file) AS ?docStr)
  BIND(STR(?repo) AS ?repoStr)

  # Calculate relative file path (after repo URI + '/')
  BIND(SUBSTR(?docStr, STRLEN(?repoStr) + 2) AS ?filePath)

  # Extract vault name (last segment of repo URI)
  BIND(STRAFTER(?repoStr, "file:///") AS ?repoLocal)
  BIND(REPLACE(?repoLocal, "^.*/", "") AS ?vault)

  # Encode the file path for URI and build obsidian:// URL
  BIND(IRI(CONCAT("obsidian://open?vault=", ?vault, "&file=", ?filePath)) AS ?obdidian_url)
}
```
