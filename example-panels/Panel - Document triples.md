---
uuid: 559e12a0-d189-4442-a0ff-ac7174df04f1
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
  
CONSTRUCT { ?s ?p ?o } WHERE {  
    GRAPH __DOC__ {
	    ?s ?p ?o    
	}    
}
```
