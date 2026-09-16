---
uuid: 63de4597-6424-4722-974a-8e1218d2f6df
tags:
  - panel/query
title: Navigation view
order: "2"
---

# Panel - Navigation view

- rdfs:comment :: Class-based navigation of sibling, broader, and narrower concepts, using rdf:type / rdfs:subClassOf triples.

These queries require domain `rdf:type` and `rdfs:subClassOf` triples from downstream mappings.

---

Sibling concepts

```dot-sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX schema: <https://schema.org/>
PREFIX oa: <http://www.w3.org/ns/oa#>

SELECT DISTINCT  (?class as ?common_class) (?concept as ?sibling_concept)  WHERE {
    GRAPH __DOC__ {
        ?file schema:about ?s .
        ?s ?relation ?otherClass
        VALUES ?relation { rdf:type rdfs:subClassOf }
	}
	  ?concept a ?class .
	  ?class rdfs:subClassOf* ?otherClass .
	  OPTIONAL {
	    ?class rdfs:subClassOf+ ?mid .
	    ?mid rdfs:subClassOf* ?otherClass .
	    FILTER (?mid != ?class)
	  }
}
GROUP BY ?concept ?class
ORDER BY ?class (COUNT(?mid))
LIMIT 100
```

---

Transitive instances of class

```dot-sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?class (?concept as ?instance_concept)
WHERE {
  ?concept a ?class .
  ?class rdfs:subClassOf* __THIS__ .
  OPTIONAL {
    ?class rdfs:subClassOf+ ?mid .
    ?mid rdfs:subClassOf* __THIS__ .
    FILTER (?mid != ?class)
  }
}
GROUP BY ?concept ?class
ORDER BY (COUNT(?mid))
LIMIT 300
```

---

```dot-sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <https://schema.org/>
PREFIX oa: <http://www.w3.org/ns/oa#>

SELECT DISTINCT ?concept (?relatedClass as ?broader_concept)
WHERE {
	  GRAPH __DOC__ {
		 {
		    ?file schema:about ?concept .
		    ?concept  ?relation ?thisClass .
		    VALUES ?relation { rdf:type rdfs:subClassOf }
		 } UNION {
			?file schema:about ?thisClass .
		 }
	 }
 ?thisClass rdfs:subClassOf ?relatedClass .
}
ORDER BY ?concept ?relatedClass
```

---

```dot-sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <https://schema.org/>
PREFIX oa: <http://www.w3.org/ns/oa#>

SELECT DISTINCT ?concept (?relatedClass as ?narrower_concept)
WHERE {
	  GRAPH __DOC__ {
		 {
		    ?file schema:about ?concept .
		    ?concept ?relation ?thisClass .
	        VALUES ?relation { rdf:type rdfs:subClassOf }
		 } UNION {
			?file schema:about ?thisClass .
		 }
	 }
 ?relatedClass rdfs:subClassOf ?thisClass .
}
ORDER BY ?concept ?relatedClass
```
