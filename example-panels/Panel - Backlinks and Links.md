---
uuid: 053ad81d-f5ef-4d66-a63f-f06047aadf46
tags:
  - panel/query
title: Backlinks and Links
order: "3"
---
 
# Panel - Backlinks and Links

## Backlinks

```dot-sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX dot: <http://pending.org/dot/>
PREFIX oa: <http://www.w3.org/ns/oa#>

CONSTRUCT { ?s ?p ?concept } WHERE {
	 BIND(__DOC__ AS ?doc)
	 VALUES ?type { dot:NamedConcept oa:Annotation }

    GRAPH ?doc {
        ?concept a ?type
    }
    GRAPH ?other_doc {
        ?s ?p ?concept
    }
    FILTER (?doc!=?other_doc)
}
```

## Links

```dot-sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX dot: <http://pending.org/dot/>
PREFIX oa: <http://www.w3.org/ns/oa#>

CONSTRUCT {
  ?concept ?p ?o
}
WHERE {
  BIND(__DOC__ AS ?doc)
  VALUES ?type { dot:NamedConcept oa:Annotation }
  GRAPH ?doc {
    ?concept a ?type ;
             ?p ?o .
  }
  FILTER EXISTS {
    GRAPH ?other_doc {
      ?o ?p2 ?o2 .
      FILTER (?other_doc != ?doc)
    }
  }
}
```

## IRIS

> The URI if the main concept is: __THIS__
