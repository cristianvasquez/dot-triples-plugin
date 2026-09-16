import { describe, it, expect, beforeEach } from 'vitest'
import { EmbeddedTriplifierService } from '../triplifier/EmbeddedTriplifierService.js'
import { ExternalTriplifierService } from '../triplifier/ExternalTriplifierService.js'

// Mock Obsidian API
const mockApp = {
  vault: {
    adapter: {
      getFullPath: (path) => `/test/vault/${path}`
    },
    getAbstractFileByPath: () => ({
      stat: { ctime: Date.now(), mtime: Date.now() }
    })
  }
}

const mockSettings = {
  embeddedSettings: {
    triplifierOptions: {
      partitionBy: ['headers-h2-h3'],
      includeLabelsFor: ['documents'],
      includeSelectors: true,
      includeRaw: true,
      prefix: {
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
      },
      mappings: {
        'title': 'dct:title'
      }
    }
  },
  osgPath: '/fake/osg/path'
}

describe('TriplifierService Architecture', () => {
  describe('EmbeddedTriplifierService', () => {
    let service

    beforeEach(() => {
      service = new EmbeddedTriplifierService(mockApp, mockSettings)
    })

    it('should initialize correctly', () => {
      expect(service).toBeDefined()
      expect(service.app).toBe(mockApp)
      expect(service.settings).toBe(mockSettings)
    })

    it('should process markdown files', () => {
      expect(service.canProcess('/test/document.md')).toBe(true)
      expect(service.canProcess('/test/Board.canvas')).toBe(true)
      expect(service.canProcess('/test/document.txt')).toBe(false)
    })

    it('should triplify canvas edges between note identities', async () => {
      const content = JSON.stringify({
        nodes: [
          { id: 'a', type: 'file', file: 'people/Alice.md', x: 0, y: 0, width: 100, height: 100 },
          { id: 'b', type: 'file', file: 'Bob.md', x: 200, y: 0, width: 100, height: 100 },
        ],
        edges: [{ id: 'edge', fromNode: 'a', toNode: 'b', label: 'knows' }],
      })
      const result = await service.triplify('/test/vault/Board.canvas', content)
      expect(result.graphUri.value).toBe('file:///test/vault/Board.canvas')
      expect([...result.dataset]).toEqual(expect.arrayContaining([
        expect.objectContaining({
          subject: expect.objectContaining({ value: 'urn:name:Alice' }),
          predicate: expect.objectContaining({ value: 'urn:token:knows' }),
          object: expect.objectContaining({ value: 'urn:name:Bob' }),
        }),
        expect.objectContaining({
          subject: expect.objectContaining({ value: 'urn:name:Board.canvas' }),
        }),
      ]))
    })

    it('should reject malformed canvas JSON', async () => {
      await expect(service.triplify('/test/Board.canvas', '{')).rejects.toThrow()
    })

    it('should skip unsupported file types', async () => {
      expect(await service.triplify('/test/data.json', '{}')).toBeNull()
    })

    it('should triplify markdown content', async () => {
      const absolutePath = '/test/vault/test.md'
      const content = '---\ntags: [example]\n---\n\n# Test Document\n\ntitle :: Test Title'
      
      const result = await service.triplify(absolutePath, content)
      
      expect(result).toBeDefined()
      expect(result.dataset).toBeDefined()
      expect(result.graphUri).toBeDefined() 
      expect(result.dataset.size).toBeGreaterThan(0)
      expect(result.graphUri.value).toBe('file:///test/vault/test.md')

      const quads = [...result.dataset]
      expect(quads).toEqual(expect.arrayContaining([
        expect.objectContaining({
          subject: expect.objectContaining({ value: 'urn:name:test.md' }),
          predicate: expect.objectContaining({ value: 'https://schema.org/keywords' }),
          object: expect.objectContaining({ value: 'example' }),
        }),
        expect.objectContaining({
          subject: expect.objectContaining({ value: 'urn:name:test' }),
          predicate: expect.objectContaining({ value: 'urn:token:title' }),
          object: expect.objectContaining({ value: 'Test Title' }),
        }),
      ]))
    })
  })

  describe('ExternalTriplifierService', () => {
    let service

    beforeEach(() => {
      service = new ExternalTriplifierService(mockApp, mockSettings)
    })

    it('should initialize correctly', () => {
      expect(service).toBeDefined()
      expect(service.app).toBe(mockApp)
      expect(service.settings).toBe(mockSettings)
    })

    it('should process markdown files', () => {
      expect(service.canProcess('/test/document.md')).toBe(true)
      expect(service.canProcess('/test/document.txt')).toBe(false)
    })

    it('should return external sync requirement', async () => {
      const absolutePath = '/test/vault/test.md'
      const content = '# Test Document'
      
      const result = await service.triplify(absolutePath, content)
      
      expect(result).toBeDefined()
      expect(result.requiresExternalSync).toBe(true)
      expect(result.dataset).toBeNull()
      expect(result.graphUri).toBeDefined()
    })
  })


  describe('Service Selection Logic', () => {
    it('should choose correct service based on settings', () => {
      const embeddedSettings = { ...mockSettings, triplifierMode: 'embedded' }
      const externalSettings = { ...mockSettings, triplifierMode: 'external' }

      const embeddedService = new EmbeddedTriplifierService(mockApp, embeddedSettings)
      const externalService = new ExternalTriplifierService(mockApp, externalSettings)

      expect(embeddedService.constructor.name).toBe('EmbeddedTriplifierService')
      expect(externalService.constructor.name).toBe('ExternalTriplifierService')
    })
  })
})
