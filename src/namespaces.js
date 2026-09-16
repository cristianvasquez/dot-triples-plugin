import rdf from 'rdf-ext'

// Create rdf-ext namespace objects
const ns = {
  rdf: rdf.namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
  rdfs: rdf.namespace('http://www.w3.org/2000/01/rdf-schema#'),
  xsd: rdf.namespace('http://www.w3.org/2001/XMLSchema#'),
  owl: rdf.namespace('http://www.w3.org/2002/07/owl#'),
  skos: rdf.namespace('http://www.w3.org/2004/02/skos/core#'),
  schema: rdf.namespace('https://schema.org/'),
  foaf: rdf.namespace('http://xmlns.com/foaf/0.1/'),
  prov: rdf.namespace('http://www.w3.org/ns/prov#'),
  oa: rdf.namespace('http://www.w3.org/ns/oa#'),
  acl: rdf.namespace('http://www.w3.org/ns/auth/acl#'),
  document: rdf.namespace('osg://vocab/document#'),
  resource: rdf.namespace('osg://vocab/resource#'),
  osg: rdf.namespace('http://pending.org/osg/'),
  dct: rdf.namespace('http://purl.org/dc/terms/'),
}

// Build prefixes from namespace objects for shrinking URIs
const prefixes = {}
for (const [prefix, namespace] of Object.entries(ns)) {
  prefixes[namespace().value] = prefix + ':'
}
prefixes['file://'] = ''

export { ns, prefixes }
