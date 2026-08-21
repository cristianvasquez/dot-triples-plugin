import { describe, it, expect } from 'vitest'
import { 
  replacePropertyPlaceholders, 
  replaceInternalLinks, 
  replaceAllTokens,
  removeFrontmatter
} from './templates.js'

describe('Template System', () => {
  
  describe('replacePropertyPlaceholders', () => {
    it('should replace simple property placeholders', () => {
      const input = 'SELECT * WHERE { ?s __label__ ?o }'
      const result = replacePropertyPlaceholders(input)
      expect(result).toContain('<urn:token:label>')
      expect(result).not.toContain('__label__')
    })

    it('should replace property placeholders with spaces', () => {
      const input = 'SELECT * WHERE { ?s __generated at time__ ?o }'
      const result = replacePropertyPlaceholders(input)
      expect(result).toContain('<urn:token:generated%20at%20time>')
      expect(result).not.toContain('__generated at time__')
    })

    it('should replace prefixed property placeholders', () => {
      const input = 'SELECT * WHERE { ?s __rdfs:label__ ?o }'
      const result = replacePropertyPlaceholders(input)
      expect(result).toContain('<urn:token:rdfs%3Alabel>')
      expect(result).not.toContain('__rdfs:label__')
    })

    it('should handle multiple property placeholders', () => {
      const input = '?s __type__ ?type . ?s __label__ ?name'
      const result = replacePropertyPlaceholders(input)
      expect(result).toContain('<urn:token:type>')
      expect(result).toContain('<urn:token:label>')
    })

    it('should not affect text without placeholders', () => {
      const input = 'SELECT * WHERE { ?s ?p ?o }'
      const result = replacePropertyPlaceholders(input)
      expect(result).toBe(input)
    })
  })

  describe('replaceInternalLinks', () => {
    it('should replace wiki links with name URIs', () => {
      const input = 'SELECT * WHERE { [[MyNote]] ?p ?o }'
      const result = replaceInternalLinks(input, (link) => `<urn:name:${link}>`)
      expect(result).toContain('<urn:name:MyNote>')
      expect(result).not.toContain('[[MyNote]]')
    })

    it('should handle multiple wiki links', () => {
      const input = '[[Note1]] [[Note2]]'
      const result = replaceInternalLinks(input, (link) => `<urn:name:${link}>`)
      expect(result).toContain('<urn:name:Note1>')
      expect(result).toContain('<urn:name:Note2>')
    })
  })


  describe('removeFrontmatter', () => {
    it('should remove YAML frontmatter', () => {
      const input = `---
title: Test
tags: [example]
---

Content here`
      const result = removeFrontmatter(input)
      expect(result).toBe('Content here')
    })

    it('should not affect content without frontmatter', () => {
      const input = 'Regular content'
      const result = removeFrontmatter(input)
      expect(result).toBe(input)
    })

    it('should handle malformed frontmatter', () => {
      const input = '---\nno closing marker\nContent here'
      const result = removeFrontmatter(input)
      expect(result).toBe(input)
    })
  })

  describe('replaceAllTokens', () => {
    it('should replace __DATE__ token', () => {
      const input = 'Current time: __DATE__'
      const result = replaceAllTokens(input, '/path/to/file.md', null)
      expect(result).not.toContain('__DATE__')
      expect(result).toContain('Current time:')
    })

    it('should replace multiple token types', () => {
      const input = '__THIS__ __label__ [[LinkedNote]] __DATE__'
      const result = replaceAllTokens(input, '/path/to/TestFile.md', null)
      
      expect(result).toContain('<urn:name:TestFile>')
      expect(result).toContain('<urn:token:label>')
      expect(result).toContain('<urn:name:LinkedNote>')
      expect(result).not.toContain('__DATE__')
    })

    it('should handle prefixed properties', () => {
      const input = '__rdfs:label__ __owl:sameAs__'
      const result = replaceAllTokens(input, '/path/to/file.md', null)
      
      expect(result).toContain('<urn:token:rdfs%3Alabel>')
      expect(result).toContain('<urn:token:owl%3AsameAs>')
    })
  })

  describe('replaceAllTokens integration', () => {
    it('should replace __THIS__ token', () => {
      const sparql = 'SELECT * WHERE { __THIS__ ?p ?o }'
      const result = replaceAllTokens(sparql, '/path/to/MyFile.md', null, null)
      expect(result).toContain('<urn:name:MyFile>')
      expect(result).not.toContain('__THIS__')
    })

    it('should replace __DOC__ token', () => {
      const sparql = 'CONSTRUCT { ?s ?p ?o } WHERE { GRAPH __DOC__ { ?s ?p ?o } }'
      const result = replaceAllTokens(sparql, '/path/to/MyFile.md', null, null)
      expect(result).toContain('<file:///path/to/MyFile.md>')
      expect(result).not.toContain('__DOC__')
    })

    it('should replace __REPO__ token', () => {
      const sparql = 'SELECT * WHERE { GRAPH __REPO__ { ?s ?p ?o } }'
      const result = replaceAllTokens(sparql, '/path/to/MyFile.md', null, '/home/user/repo')
      expect(result).toContain('<file:///home/user/repo>')
      expect(result).not.toContain('__REPO__')
    })

    it('should handle combined replacements', () => {
      const sparql = `
        SELECT * WHERE {
          GRAPH __DOC__ {
            __THIS__ __label__ [[LinkedNote]]
          }
        }`
      const result = replaceAllTokens(sparql, '/path/to/TestFile.md', null, null)
      
      expect(result).toContain('<file:///path/to/TestFile.md>')
      expect(result).toContain('<urn:name:TestFile>')
      expect(result).toContain('<urn:token:label>')
      expect(result).toContain('<urn:name:LinkedNote>')
    })

    it('should handle __DATE__ token in SPARQL', () => {
      const sparql = 'SELECT * WHERE { ?s __created_at__ "__DATE__" }'
      const result = replaceAllTokens(sparql, '/path/to/file.md', null, null)
      
      expect(result).toContain('<urn:token:created_at>')
      expect(result).not.toContain('__DATE__')
    })

    it('should handle prefixed properties in SPARQL', () => {
      const sparql = 'SELECT * WHERE { ?s __rdfs:label__ __owl:sameAs__ }'
      const result = replaceAllTokens(sparql, '/path/to/file.md', null, null)
      
      expect(result).toContain('<urn:token:rdfs%3Alabel>')
      expect(result).toContain('<urn:token:owl%3AsameAs>')
    })

    it('should work without file path', () => {
      const sparql = 'SELECT * WHERE { [[MyNote]] __label__ ?o }'
      const result = replaceAllTokens(sparql, null, null, null)
      
      expect(result).toContain('<urn:name:MyNote>')
      expect(result).toContain('<urn:token:label>')
      expect(result).not.toContain('__THIS__')
      expect(result).not.toContain('__DOC__')
    })
  })
})
