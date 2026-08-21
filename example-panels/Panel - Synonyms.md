---
uuid: 162cc357-7559-41aa-8c62-f2d0b03a0615
tags:
  - panel/query
title: Synonyms
order: "5"
---
 
# Synonyms
> Occurrences of Named Concepts of this document in other documents of other vaults


```dot-sparql
PREFIX dot: <http://pending.org/dot/>
PREFIX oa: <http://www.w3.org/ns/oa#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?label ?file ?repo ?obdidian_url 
WHERE {
  BIND(__DOC__ AS ?document)

  VALUES ?type { dot:NamedConcept oa:Annotation }

  # Get typed resources with labels in the current document
  GRAPH ?document {
    ?concept a ?type 
  }

  # Find matching resources with labels in other graphs
  GRAPH ?file {
    ?concept a ?type ;
              rdfs:label ?label .
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
