---
uuid: 765bbba9-37be-493b-aea3-59ef4341d013
tags:
  - panel/query
title: Personal Ontology View
order: "7"
---

# Class info

- rdfs:comment :: Ontology info for when this document denotes a class or property: instances, super/subclasses, and domain/range.

## Direct instances of this class

```dot-sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?concept
WHERE {
	  ?concept a __THIS__ . 
}
GROUP BY ?concept ?class
LIMIT 300
```

## Broader transitive

```dot-sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT (?superClass as ?concept) 
WHERE {
  __THIS__ rdfs:subClassOf+ ?superClass .
  OPTIONAL {
    __THIS__ rdfs:subClassOf+ ?mid .
    ?mid rdfs:subClassOf+ ?superClass .
    FILTER (?mid != ?superClass)
  }
}
GROUP BY ?superClass
ORDER BY (COUNT(?mid))
```

## Narrower transitive

```dot-sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT (?subClass as ?concept) 
WHERE {
  ?subClass rdfs:subClassOf+ __THIS__ .
  OPTIONAL {
    ?subClass rdfs:subClassOf+ ?mid .
    ?mid rdfs:subClassOf+ __THIS__ .
    FILTER (?mid != ?subClass)
  }
}
GROUP BY ?subClass
ORDER BY (COUNT(?mid))
```

## Direct Domain

```dot-sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?domainOf
WHERE {
	?domainOf rdfs:domain __THIS__ .
}
```

## Direct Range

```dot-sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?rangeOf
WHERE {
	?rangeOf rdfs:range __THIS__ .
}
```
