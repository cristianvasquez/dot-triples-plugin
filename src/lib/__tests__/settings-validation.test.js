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

  it('migrates the previous dot-triples default panel query', () => {
    const panelQuery = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?document ?title ?content WHERE {
    GRAPH ?g {
        ?document <urn:token:tags> "panel/query" ;
                  <urn:token:about> ?panel .
        ?panel <urn:code-block:dot-sparql> ?query .
        OPTIONAL { ?document <urn:token:title> ?documentTitle }
        OPTIONAL { ?panel rdfs:label ?panelTitle }
        OPTIONAL { ?document <urn:token:order> ?order }
        BIND(COALESCE(?panelTitle, ?documentTitle) AS ?title)
        BIND(CONCAT("\`\`\`dot-sparql\\n", STR(?query), "\\n\`\`\`") AS ?content)
    }
} ORDER BY ?order`
    expect(migrateSettings({ panelQuery }).panelQuery).toBe(DEFAULT_SETTINGS.panelQuery)
  })

  it('preserves custom panel queries', () => {
    const settings = { panelQuery: 'SELECT * WHERE { ?s <urn:code-block:dot-sparql> ?o }' }
    expect(migrateSettings(settings)).toBe(settings)
  })

  it.each([true, false])('discovers panel code with headings: %s', async (withHeadings) => {
    const store = new Store()
    const graph = pathToFileURL('/vault/Stats.md')
    const markdown = [
      '---',
      'tags: [panel/query]',
      'title: Stats',
      'order: "4"',
      '---',
      '',
      ...(withHeadings ? ['# Stats'] : []),
      '',
      ...(withHeadings ? ['## Count'] : []),
      '',
      '```dot-sparql',
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
    expect(bindings.title.value).toBe(withHeadings ? 'Count' : 'Stats')
    expect(bindings.content.value).toBe(
      '```dot-sparql\nSELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }\n```')
  })
})
