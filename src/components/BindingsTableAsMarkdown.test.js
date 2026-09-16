import { describe, it, expect } from 'vitest'
import {
  generateMarkdownTable,
  generateMarkdownTableRaw,
} from './BindingsTableAsMarkdown.js'
import rdf from 'rdf-ext'

// Mock app object
const mockApp = {
  vault: {
    adapter: {
      path: {
        absolute: '/mock/vault/path',
      },
    },
  },
}

// Mock RDF terms
const mockNamedNode = rdf.namedNode('http://example.org/resource')
const mockLiteral = rdf.literal('Test Value')

describe('BindingsTable', () => {
  describe('generateMarkdownTable', () => {
    it('should generate markdown table with normal values', () => {
      const header = ['resource', 'label']
      const rows = [
        [mockNamedNode, mockLiteral],
        [mockNamedNode, mockLiteral],
      ]

      const result = generateMarkdownTable(header, rows, mockApp)

      expect(result).toContain('| resource | label |')
      expect(result).toContain('| --- | --- |')
      expect(result).toContain('Test Value')
    })

    it('should handle null values from OPTIONAL SPARQL clauses', () => {
      const header = ['resource', 'optionalLabel', 'optionalValue']
      const rows = [
        [mockNamedNode, mockLiteral, null], // Has optional value
        [mockNamedNode, null, mockLiteral], // Missing middle optional
        [mockNamedNode, null, null],         // Missing both optionals
      ]

      expect(() => {
        generateMarkdownTable(header, rows, mockApp)
      }).not.toThrow()
    })

    it('should render null values as empty cells', () => {
      const header = ['resource', 'optional']
      const rows = [
        [mockNamedNode, null],
      ]

      const result = generateMarkdownTable(header, rows, mockApp)

      expect(result).toContain('| resource | optional |')
      expect(result).toContain('| --- | --- |')
      // The row should have an empty cell for null value
      expect(result).toMatch(/\|\s*\[.*\]\(.*\)\s*\|\s*\|/)
    })

    it('should handle mixed null and non-null values', () => {
      const header = ['col1', 'col2', 'col3']
      const rows = [
        [mockLiteral, null, mockNamedNode],
        [null, mockLiteral, null],
        [mockNamedNode, mockLiteral, mockLiteral],
      ]

      const result = generateMarkdownTable(header, rows, mockApp)

      expect(result).toContain('| col1 | col2 | col3 |')
      expect(result).toContain('| --- | --- | --- |')
      // Should not throw and should contain the non-null values
      expect(result).toContain('Test Value')
    })

    it('should handle completely null rows', () => {
      const header = ['col1', 'col2']
      const rows = [
        [null, null],
      ]

      const result = generateMarkdownTable(header, rows, mockApp)

      expect(result).toContain('| col1 | col2 |')
      expect(result).toContain('| --- | --- |')
      expect(result).toContain('|  |  |')
    })

    it('should preserve repeated values in every row',
      () => {
        const header = ['resource', 'type']
        const rows = [
          [mockNamedNode, mockLiteral],
          [mockNamedNode, mockLiteral], // Same values as previous row
          [mockLiteral, mockNamedNode],  // Different values
        ]

        const result = generateMarkdownTable(header, rows, mockApp)
        const lines = result.split('\n')

        // First data row should have both values
        expect(lines[2]).toContain('Test Value')
        // Repeated bindings must remain visible.
        expect(lines[3]).toBe(lines[2])
        // Third data row should have different values displayed
        expect(lines[4]).toContain('Test Value')
      })
  })

  describe('generateMarkdownTableRaw', () => {
    it('should generate markdown table with raw toString() values', () => {
      const header = ['resource', 'label']
      const rows = [
        [mockNamedNode, mockLiteral],
        [mockNamedNode, mockLiteral],
      ]

      const result = generateMarkdownTableRaw(header, rows, mockApp)

      expect(result).toContain('| resource | label |')
      expect(result).toContain('| --- | --- |')
      expect(result).toContain('<http://example.org/resource>')
      expect(result).toContain('Test Value')
      // Should not contain markdown links, just raw values
      expect(result).not.toContain('[')
      expect(result).not.toContain('](')
    })

    it('should handle null values in raw mode', () => {
      const header = ['resource', 'optional']
      const rows = [
        [mockNamedNode, null],
      ]

      const result = generateMarkdownTableRaw(header, rows, mockApp)

      expect(result).toContain('| resource | optional |')
      expect(result).toContain('| --- | --- |')
      expect(result).toContain('<http://example.org/resource>')
      // Should have empty cell for null
      expect(result).toMatch(/\|\s*<http:\/\/example\.org\/resource>\s*\|\s*\|/)
    })

    it('should always show all values (no non-repeating logic in raw mode)',
      () => {
        const header = ['resource', 'type']
        const rows = [
          [mockNamedNode, mockLiteral],
          [mockNamedNode, mockLiteral], // Same values as previous row
          [mockLiteral, mockNamedNode],
        ]

        const result = generateMarkdownTableRaw(header, rows, mockApp)
        const lines = result.split('\n')

        // All rows should show their values, no skipping for repetition
        expect(lines[2]).toContain('<http://example.org/resource>')
        expect(lines[2]).toContain('Test Value')
        expect(lines[3]).toContain('<http://example.org/resource>')
        expect(lines[3]).toContain('Test Value')
        expect(lines[4]).toContain('Test Value')
        expect(lines[4]).toContain('<http://example.org/resource>')
      })

    it('should escape pipe characters in raw mode', () => {
      const mockLiteralWithPipe = rdf.literal('Value | With | Pipes')

      const header = ['resource']
      const rows = [[mockLiteralWithPipe]]

      const result = generateMarkdownTableRaw(header, rows, mockApp)

      expect(result).toContain('Value \\| With \\| Pipes')
    })
  })
})
