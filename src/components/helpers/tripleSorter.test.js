import { describe, it, expect } from 'vitest'
import { sortTriplesBySubject, sortTriplesByProperty } from './tripleSorter.js'
import { ns } from '../../namespaces.js'

describe('Triple Sorter', () => {
  describe('sortTriplesBySubject', () => {
    it('should sort subjects by priority: File -> Normal -> Blank nodes', () => {
      const triples = [
        // Blank node (should be last)
        {
          subject: { termType: 'BlankNode', value: '_:b1' },
          predicate: { value: 'http://example.org/prop' },
          object: { value: 'blank value' }
        },
        // File (should be middle)
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/doc1' },
          predicate: { value: ns.rdf.type.value },
          object: { value: ns.document('File').value }
        },
        // Normal subject (should be first)
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/normal' },
          predicate: { value: 'http://example.org/prop' },
          object: { value: 'normal value' }
        },
        // Another File property
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/doc1' },
          predicate: { value: 'http://example.org/title' },
          object: { value: 'Document Title' }
        }
      ]

      const sorted = sortTriplesBySubject(triples)

      // First should be File subjects (both triples)
      expect(sorted[0].subject.value).toBe('http://example.org/doc1')
      expect(sorted[1].subject.value).toBe('http://example.org/doc1')
      
      // Next should be normal subject
      expect(sorted[2].subject.value).toBe('http://example.org/normal')
      
      // Last should be blank node
      expect(sorted[3].subject.value).toBe('_:b1')
    })

    it('should sort alphabetically within same priority group', () => {
      const triples = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/zebra' },
          predicate: { value: 'http://example.org/prop' },
          object: { value: 'zebra' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/alpha' },
          predicate: { value: 'http://example.org/prop' },
          object: { value: 'alpha' }
        }
      ]

      const sorted = sortTriplesBySubject(triples)

      expect(sorted[0].subject.value).toBe('http://example.org/alpha')
      expect(sorted[1].subject.value).toBe('http://example.org/zebra')
    })

    it('should sort by predicate within same subject', () => {
      const triples = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: 'http://example.org/zebra' },
          object: { value: 'z-value' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: 'http://example.org/alpha' },
          object: { value: 'a-value' }
        }
      ]

      const sorted = sortTriplesBySubject(triples)

      expect(sorted[0].predicate.value).toBe('http://example.org/alpha')
      expect(sorted[1].predicate.value).toBe('http://example.org/zebra')
    })

    it('should handle empty results', () => {
      const sorted = sortTriplesBySubject([])
      expect(sorted).toEqual([])
    })

    it('should not mutate original array', () => {
      const original = [
        {
          subject: { termType: 'BlankNode', value: '_:b1' },
          predicate: { value: 'http://example.org/prop' },
          object: { value: 'value' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/normal' },
          predicate: { value: 'http://example.org/prop' },
          object: { value: 'value' }
        }
      ]
      
      const originalFirstSubject = original[0].subject.value
      const sorted = sortTriplesBySubject(original)
      
      expect(original[0].subject.value).toBe(originalFirstSubject)
      expect(sorted[0]).not.toBe(original[0])
    })
  })

  describe('sortTriplesByProperty', () => {
    it('should sort properties with rdf:type first', () => {
      const triples = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: 'http://example.org/zebra' },
          object: { value: 'z-value' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: ns.rdf.type.value },
          object: { value: 'http://example.org/Type' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: 'http://example.org/alpha' },
          object: { value: 'a-value' }
        }
      ]

      const sorted = sortTriplesByProperty(triples)

      expect(sorted[0].predicate.value).toBe(ns.rdf.type.value)
      expect(sorted[1].predicate.value).toBe('http://example.org/alpha')
      expect(sorted[2].predicate.value).toBe('http://example.org/zebra')
    })

    it('should sort non-type properties alphabetically', () => {
      const triples = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: 'http://example.org/zebra' },
          object: { value: 'z-value' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: 'http://example.org/alpha' },
          object: { value: 'a-value' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: 'http://example.org/bravo' },
          object: { value: 'b-value' }
        }
      ]

      const sorted = sortTriplesByProperty(triples)

      expect(sorted[0].predicate.value).toBe('http://example.org/alpha')
      expect(sorted[1].predicate.value).toBe('http://example.org/bravo')
      expect(sorted[2].predicate.value).toBe('http://example.org/zebra')
    })

    it('should handle multiple rdf:type properties', () => {
      const triples = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: ns.rdf.type.value },
          object: { value: 'http://example.org/TypeA' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: 'http://example.org/prop' },
          object: { value: 'value' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: ns.rdf.type.value },
          object: { value: 'http://example.org/TypeB' }
        }
      ]

      const sorted = sortTriplesByProperty(triples)

      expect(sorted[0].predicate.value).toBe(ns.rdf.type.value)
      expect(sorted[1].predicate.value).toBe(ns.rdf.type.value)
      expect(sorted[2].predicate.value).toBe('http://example.org/prop')
    })

    it('should handle empty array', () => {
      const sorted = sortTriplesByProperty([])
      expect(sorted).toEqual([])
    })

    it('should not mutate original array', () => {
      const original = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: 'http://example.org/zebra' },
          object: { value: 'z-value' }
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/subject' },
          predicate: { value: ns.rdf.type.value },
          object: { value: 'http://example.org/Type' }
        }
      ]
      
      const originalOrder = original.map(t => t.predicate.value)
      const sorted = sortTriplesByProperty(original)
      
      expect(original.map(t => t.predicate.value)).toEqual(originalOrder)
      expect(sorted[0]).not.toBe(original[0])
    })
  })
})