---
uuid: 8585da6b-19a2-4fbe-95ef-0a7c3085d79c
tags:
  - panel/query
title: Stats
order: "4"
---

# Stats

## Total number of named graphs

```dot-sparql
SELECT (COUNT(DISTINCT ?g) AS ?graphCount)
WHERE {
  GRAPH ?g {
    ?s ?p ?o
  }
}
```

## Total number of triples

```dot-sparql
SELECT (COUNT(*) AS ?tripleCount)
WHERE {
  GRAPH ?g {
    ?s ?p ?o
  }
}
```
