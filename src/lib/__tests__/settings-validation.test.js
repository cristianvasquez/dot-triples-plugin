import { describe, it, expect } from 'vitest'
import { Store } from 'oxigraph'
import rdf from 'rdf-ext'
import { pathToFileURL } from 'canonical-md'
import { triplifyToQuads } from 'triplifier-md'
import { DEFAULT_SETTINGS, migrateSettings } from '../settings.js'

describe('dot-triples settings', () => {
  it('uses dot-triples as the option-free embedded triplifier', () => {
    expect(DEFAULT_SETTINGS.embeddedSettings.triplifierOptions).toEqual({})
  })

  it('discovers panels using dot-triples tokens and code-block predicates', () => {
    expect(DEFAULT_SETTINGS.panelQuery).toContain('<urn:token:tags>')
    expect(DEFAULT_SETTINGS.panelQuery).toContain('<urn:token:about>')
    expect(DEFAULT_SETTINGS.panelQuery).toContain('<urn:code-block:osg>')
    expect(DEFAULT_SETTINGS.panelQuery).toContain('CONCAT("```osg\\n"')
    expect(DEFAULT_SETTINGS.panelQuery).not.toContain('urn:property:')
  })

  it('migrates the persisted vault-triplifier panel query', () => {
    const legacySettings = {
      panelQuery: 'SELECT * WHERE { ?document a dot:MarkdownDocument ; dot:raw ?content }',
      panelTag: 'panel/query',
    }

    expect(migrateSettings(legacySettings)).toEqual({
      ...legacySettings,
      panelQuery: DEFAULT_SETTINGS.panelQuery,
    })
  })

  it('runs the panel query against dot-triples output', async () => {
    const store = new Store()
    const graph = pathToFileURL('/vault/Stats.md')
    const markdown = [
      '---',
      'tags: [panel/query]',
      'title: Stats',
      'order: "4"',
      '---',
      '',
      '# Stats',
      '',
      '## Count',
      '',
      '```osg',
      'SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }',
      '```',
    ].join('\n')

    for (const quad of triplifyToQuads(markdown, { file: '/vault/Stats.md' })) {
      store.add(rdf.quad(quad.subject, quad.predicate, quad.object, graph))
    }

    const results = [...store.query(DEFAULT_SETTINGS.panelQuery, {
      use_default_graph_as_union: true,
    })]
    const bindings = Object.fromEntries(results[0])

    expect(results).toHaveLength(1)
    expect(bindings.title.value).toBe('Count')
    expect(bindings.content.value).toBe(
      '```osg\nSELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }\n```')
  })
})
