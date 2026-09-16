import { beforeEach, describe, expect, it, vi } from 'vitest'
import rdf from 'rdf-ext'

vi.mock('obsidian', async importOriginal => ({
  ...await importOriginal(),
  DropdownComponent: class {
    constructor (container) {
      this.selectEl = document.createElement('select')
      container.appendChild(this.selectEl)
    }
  },
  setIcon: vi.fn(),
}))

let renderPanel, refreshPanelQueries, renderSparqlView, MarkdownRenderer
let context, container, template, results, activeFile, render

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetModules()
  ;({ renderPanel, refreshPanelQueries } = await import('../MainPanel.js'))
  ;({ renderSparqlView } = await import('../SparqlView.js'))
  ;({ MarkdownRenderer } = await import('obsidian'))
  template = '# Panel\n```dot-sparql\nSELECT ?value WHERE { ?s ?p ?value }\n```'
  results = [{ value: rdf.literal('first') }]
  activeFile = { path: 'Note.md' }
  context = {
    app: {
      workspace: { getActiveFile: () => activeFile },
      vault: {
        getMarkdownFiles: () => [],
        adapter: { getFullPath: path => `/vault/${path}`, basePath: '/vault' },
      },
    },
    plugin: { settings: { panelQuery: 'discover' } },
    controller: {
      select: vi.fn(async query => query === 'discover'
        ? [{ title: { value: 'Current file' }, content: { value: template } }]
        : results),
    },
  }
  container = document.createElement('div')
  render = vi.spyOn(MarkdownRenderer, 'render').mockImplementation(async (app, markdown, target) => {
    const block = markdown.match(/```(dot-sparql(?:-debug)?)\n([\s\S]*?)```/)
    if (block) {
      target.innerHTML = '<h1>Panel</h1><div class="block"></div>'
      await renderSparqlView(block[2], target.querySelector('.block'), context, block[1].endsWith('-debug'))
    } else target.textContent = markdown
  })
})

describe('panel refresh', () => {
  it('retains unchanged content, controls, scroll and expanded query state', async () => {
    await renderPanel(container, context)
    const content = container.querySelector('.query-content')
    const controls = container.querySelector('.dot-triples-controls')
    const body = container.querySelector('.dot-triples-results-body')
    content.scrollTop = 40
    container.querySelector('.dot-triples-query-toggle').click()
    render.mockClear()

    await renderPanel(container, context)
    expect(render).not.toHaveBeenCalled()
    expect(context.controller.select).toHaveBeenCalledTimes(3)
    expect(container.querySelector('.query-content')).toBe(content)
    expect(container.querySelector('.dot-triples-controls')).toBe(controls)
    expect(container.querySelector('.dot-triples-results-body')).toBe(body)
    expect(content.scrollTop).toBe(40)
    expect(container.querySelector('.dot-triples-query').hidden).toBe(false)
  })

  it('updates changed query results without replacing the panel', async () => {
    await renderPanel(container, context)
    const content = container.querySelector('.query-content')
    results = [{ value: rdf.literal('second') }]
    await renderPanel(container, context)
    expect(container.querySelector('.query-content')).toBe(content)
    expect(container.querySelector('.dot-triples-results-body').textContent).toContain('second')
  })

  it('renders changed templates and source paths', async () => {
    await renderPanel(container, context)
    let content = container.querySelector('.query-content')
    template = 'Changed template'
    await refreshPanelQueries(context)
    await renderPanel(container, context)
    expect(container.querySelector('.query-content')).not.toBe(content)
    expect(container.textContent).toContain('Changed template')
    content = container.querySelector('.query-content')
    activeFile = { path: 'Other/Note.md' }
    await renderPanel(container, context)
    expect(container.querySelector('.query-content')).not.toBe(content)
    expect(render.mock.lastCall[3]).toBe('Other/Note.md')
  })

  it('renders mode changes', async () => {
    await renderPanel(container, context)
    const checkbox = container.querySelector('input[type=checkbox]')
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change'))
    await vi.waitFor(() => expect(container.textContent).toContain('Results · Raw'))
  })

  it('keeps old results visible while new results are rendered', async () => {
    await renderPanel(container, context)
    const body = container.querySelector('.dot-triples-results-body')
    let finish
    render.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    results = [{ value: rdf.literal('second') }]
    const update = renderPanel(container, context)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    expect(container.querySelector('.dot-triples-results-body')).toBe(body)
    finish()
    await update
    expect(container.querySelector('.dot-triples-results-body').textContent).toContain('second')
  })

  it('coalesces panel updates while a query is pending', async () => {
    await renderPanel(container, context)
    context.controller.select.mockClear()
    let finish
    context.controller.select.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const first = renderPanel(container, context)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    const pending = Array.from({ length: 8 }, () => renderPanel(container, context))
    results = [{ value: rdf.literal('latest') }]
    finish([])
    await Promise.all([first, ...pending])
    expect(context.controller.select).toHaveBeenCalledTimes(2)
    expect(container.querySelector('.dot-triples-results-body').textContent).toContain('latest')
  })

})
