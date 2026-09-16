---
uuid: 053ad81d-f5ef-4d66-a63f-f06047aadf46
tags:
  - panel/query
title: Backlinks and Links
order: "3"
---
 
# Panel - Backlinks and Links

- rdfs:comment :: Backlinks are other files' triples that point at this document's concept.

## Backlinks

```dot-sparql
PREFIX schema: <https://schema.org/>
PREFIX dct: <http://purl.org/dc/terms/>

CONSTRUCT { ?source dct:references ?concept } WHERE {
  GRAPH __DOC__ { ?file schema:about ?concept }
  GRAPH ?other { ?source dct:references ?concept }
  FILTER (?other != __DOC__)
}
```

## Links

```dot-sparql
PREFIX schema: <https://schema.org/>
PREFIX dct: <http://purl.org/dc/terms/>

CONSTRUCT { ?concept dct:references ?target } WHERE {
  GRAPH __DOC__ {
    ?file schema:about? ?concept .
    ?concept dct:references ?target .
  }
}
```

## IRIS

> The URI if the main concept is: __THIS__
