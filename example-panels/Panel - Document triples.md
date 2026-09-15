---
uuid: 8585da6b-19a2-4fbe-95ef-0a7c3085d79c
tags:
  - panel/query
title: Document triples
order: "1"
---

# Panel - Document triples

- rdfs:comment :: Dumps every RDF triple triplified from this document's named graph.

## Triplified content

> __DATE__

```dot-sparql
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
```
