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
PREFIX schema: <https://schema.org/>

SELECT DISTINCT ?tag WHERE {
  GRAPH __DOC__ { ?document schema:keywords ?tag }
}
```

## Documents sharing a tag

```dot-sparql
PREFIX schema: <https://schema.org/>

SELECT DISTINCT ?tag ?file WHERE {
  GRAPH __DOC__ { ?current schema:keywords ?tag }
  GRAPH ?file { ?other schema:keywords ?tag }
  FILTER (?file != __DOC__)
}
```
