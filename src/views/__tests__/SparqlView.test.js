import { describe, it, expect, vi } from 'vitest'
import rdf from 'rdf-ext'
import { renderSparqlView } from '../SparqlView.js'

const query = 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }'
function context (results) {
  return {
    app: {
      workspace: { getActiveFile: () => ({ path: 'Note.md' }) },
      vault: { adapter: { getFullPath: () => '/vault/Note.md', basePath: '/vault' } },
    },
    controller: { construct: vi.fn().mockResolvedValue(results) },
    plugin: {},
  }
}

describe('query results', () => {
  it('places Copy before results and copies Turtle in rich and raw modes', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    try {
      for (const debug of [false, true]) {
        const container = document.createElement('div')
        await renderSparqlView(query, container, context([
          rdf.quad(rdf.namedNode('urn:subject'), rdf.namedNode('urn:property'), rdf.literal('value')),
        ]), debug)
        const queryContent = container.querySelector('.dot-triples-query')
        expect(queryContent.hidden).toBe(true)
        const toolbar = container.querySelector('.dot-triples-results-toolbar')
        expect(toolbar.nextElementSibling).toBe(queryContent)
        expect(toolbar.textContent).not.toContain('Rich')
        toolbar.querySelector('.dot-triples-copy').click()
        await vi.waitFor(() => expect(writeText).toHaveBeenCalled())
        expect(writeText.mock.lastCall[0]).toContain('"value"')
        expect(writeText.mock.lastCall[0]).not.toContain('```')
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('disables copying empty results', async () => {
    const container = document.createElement('div')
    await renderSparqlView(query, container, context([]))
    expect(container.querySelector('.dot-triples-copy').disabled).toBe(true)
    expect(container.textContent).toContain('No results found.')
  })
})
