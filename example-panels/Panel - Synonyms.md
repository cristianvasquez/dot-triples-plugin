---
uuid: 162cc357-7559-41aa-8c62-f2d0b03a0615
tags:
  - panel/query
title: Synonyms
order: "5"
---
 
# Synonyms

- rdfs:comment :: Finds other files whose content resolves to the same concept as this document.

> Notes and headings materialised in more than one file.

```dot-sparql
PREFIX schema: <https://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?concept ?label ?file WHERE {
  GRAPH __DOC__ { ?current schema:about ?concept }
  GRAPH ?file {
    ?other schema:about ?concept .
    OPTIONAL { ?concept rdfs:label ?label }
  }
  FILTER (?file != __DOC__)
}
```
