import { ns } from '../../namespaces.js'

/**
 * Sort SPARQL CONSTRUCT results by subject with custom priority ordering:
 * 1. File subjects
 * 2. Other named subjects
 * 3. Blank nodes
 *
 * Within each category, sort alphabetically by subject value, then by predicate
 * @param {Array} results - SPARQL CONSTRUCT results (array of triples)
 * @returns {Array} Sorted array of triples
 */
export function sortTriplesBySubject (results) {
  // First pass: build priority map for all subjects
  const priorityMap = buildSubjectPriorityMap(results)

  return [...results].sort((a, b) => {
    const subjectA = a.subject
    const subjectB = b.subject

    const priorityA = priorityMap.get(subjectA.value) || 1
    const priorityB = priorityMap.get(subjectB.value) || 1

    // Sort by priority first
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    // Within same priority, sort by subject value
    const valA = subjectA.value
    const valB = subjectB.value

    if (valA !== valB) {
      return valA.localeCompare(valB)
    }

    // Finally sort by predicate
    return a.predicate.value.localeCompare(b.predicate.value)
  })
}

/**
 * Build a map of subject value -> priority for efficient sorting
 * @param {Array} results - All SPARQL triples
 * @returns {Map} Map of subject value to priority number
 */
function buildSubjectPriorityMap (results) {
  const priorityMap = new Map()

  for (const triple of results) {
    const subjectValue = triple.subject.value

    // A file's type triple may follow its other properties.
    let priority = priorityMap.get(subjectValue) ?? 2
    if (triple.subject.termType === 'BlankNode') {
      priority = 3
    } else if (triple.predicate.value === ns.rdf.type.value &&
      triple.object.value === ns.document('File').value) {
      priority = 1
    }

    priorityMap.set(subjectValue, priority)
  }

  return priorityMap
}

/**
 * Sort triples by predicate with custom priority ordering:
 * 1. rdf:type (always first)
 * 2. All other properties alphabetically
 *
 * @param {Array} triples - Array of triples for a single subject
 * @returns {Array} Sorted array of triples
 */
export function sortTriplesByProperty (triples) {
  return [...triples].sort((a, b) => {
    const predicateA = a.predicate.value
    const predicateB = b.predicate.value

    const aIsType = predicateA === ns.rdf.type.value
    const bIsType = predicateB === ns.rdf.type.value

    // rdf:type always comes first
    if (aIsType && !bIsType) return -1
    if (!aIsType && bIsType) return 1

    // Both are rdf:type or both are other properties
    return predicateA.localeCompare(predicateB)
  })
}
