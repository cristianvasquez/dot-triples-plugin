---
uuid: 63de4597-6424-4722-974a-8e1218d2f6df
tags:
  - panel/query
title: Navigation view
order: "2"
---

# Panel - Navigation view

---

Sibling concepts

```dot-sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>  
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>  
PREFIX prov: <http://www.w3.org/ns/prov#>  
PREFIX dot: <http://pending.org/dot/>  
PREFIX oa: <http://www.w3.org/ns/oa#>
  
SELECT DISTINCT  (?class as ?common_class) (?concept as ?sibling_concept)  WHERE { 
    GRAPH __DOC__ {
        ?s a ?knownClass .
        ?s ?relation ?otherClass
        VALUES ?relation { rdf:type rdfs:subClassOf }
	    VALUES ?knownClass { dot:NamedConcept oa:Annotation }
	    FILTER (?otherClass != ?knownClass)
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
PREFIX dot: <http://pending.org/dot/>  
PREFIX oa: <http://www.w3.org/ns/oa#>

SELECT DISTINCT ?concept (?relatedClass as ?broader_concept)
WHERE {
	  GRAPH __DOC__ {
		 { 
		    ?concept a ?knownClass .
		    ?concept  ?relation ?thisClass .
		    VALUES ?relation { rdf:type rdfs:subClassOf }		 
		    VALUES ?knownClass { dot:NamedConcept oa:Annotation }
		    FILTER (?thisClass != ?knownClass)
		 } UNION {
			?thisClass a ?knownClass
			VALUES ?knownClass { dot:NamedConcept oa:Annotation }
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
PREFIX dot: <http://pending.org/dot/>  
PREFIX oa: <http://www.w3.org/ns/oa#>

SELECT DISTINCT ?concept (?relatedClass as ?narrower_concept)
WHERE {
	  GRAPH __DOC__ {
		 { 
		    ?concept a ?knownClass .
		    ?concept ?relation ?thisClass .
	        VALUES ?relation { rdf:type rdfs:subClassOf }		    
		    VALUES ?knownClass { dot:NamedConcept oa:Annotation }
		    FILTER (?thisClass != ?knownClass)
		 } UNION {
			?thisClass a ?knownClass
			VALUES ?knownClass { dot:NamedConcept oa:Annotation }
		 }
	 }
 ?relatedClass rdfs:subClassOf ?thisClass .
}
ORDER BY ?concept ?relatedClass
```
