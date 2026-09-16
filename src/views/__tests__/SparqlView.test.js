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


describe('SELECT columns and queued refreshes', () => {
  const selectQuery = 'SELECT ?value ?optional WHERE { ?s ?p ?value OPTIONAL { ?s <urn:optional> ?optional } }'

  it.each([false, true])('includes bindings from later rows in display and copy (debug=%s)', async debug => {
    const ctx = context([])
    ctx.controller.select = vi.fn().mockResolvedValue([
      {},
      { value: rdf.literal('first') },
      { optional: rdf.literal('later'), value: rdf.literal('second') },
    ])
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    try {
      const container = document.createElement('div')
      await renderSparqlView(selectQuery, container, ctx, debug)
      const body = container.querySelector('.dot-triples-results-body').textContent
      expect(body).toContain('| value | optional |')
      expect(body).toContain('later')
      container.querySelector('.dot-triples-copy').click()
      expect(writeText).toHaveBeenCalledWith(body)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('runs only the latest pending query after a slow request', async () => {
    const ctx = context([])
    let finish
    ctx.controller.select = vi.fn().mockResolvedValue([{ value: rdf.literal('latest') }])
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const container = document.createElement('div')
    const first = renderSparqlView(selectQuery, container, ctx)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    const pending = Array.from({ length: 8 }, (_, i) =>
      renderSparqlView(`${selectQuery} # update ${i}`, container, ctx))
    expect(ctx.controller.select).toHaveBeenCalledTimes(1)
    finish([])
    await Promise.all([first, ...pending])
    expect(ctx.controller.select).toHaveBeenCalledTimes(2)
    expect(ctx.controller.select.mock.lastCall[0]).toContain('# update 7')
    expect(container.textContent).toContain('latest')
    await renderSparqlView(selectQuery, container, ctx)
    expect(ctx.controller.select).toHaveBeenCalledTimes(3)
  })
})
