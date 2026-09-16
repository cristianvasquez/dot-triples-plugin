import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Store } from 'oxigraph'
import rdf from 'rdf-ext'
import { pathToFileURL, vocab, nameToURI } from 'canonical-md'
import { EmbeddedTriplifierService } from '../triplifier/EmbeddedTriplifierService.js'
import { DEFAULT_SETTINGS } from '../settings.js'
import { replaceAllTokens } from '../templates.js'
import { resultsToMarkdownTurtle } from '../../components/turtleAsMarkdown.js'
import { termAsMarkdown } from '../../components/termAsMarkdown.js'

const service = new EmbeddedTriplifierService({}, {})

async function addNote(store, path, markdown) {
  const { dataset, graphUri } = await service.triplify(path, markdown)
  for (const quad of dataset) {
    store.add(rdf.quad(quad.subject, quad.predicate, quad.object, graphUri))
  }
  return dataset
}

describe('document model integration', () => {
  it('keeps heading identity and ownership across independently indexed notes', async () => {
    const store = new Store()
    const source = await addNote(store, '/vault/Alice.md', '# Alice\nSee [[Bob#Bio]].')
    const owner = await addNote(store, '/vault/Bob.md', '# Bob\n## Bio\nrole :: Engineer')
    const heading = nameToURI('Bob#Bio')
    expect(source.match(nameToURI('Alice'), vocab.references, heading).size).toBe(1)
    expect(source.match(null, vocab.about, heading).size).toBe(0)
    expect(owner.match(nameToURI('Bob.md'), vocab.about, heading).size).toBe(1)
    expect(owner.match(heading, vocab.source, nameToURI('Bob')).size).toBe(1)
    expect(termAsMarkdown(heading, '/vault')).toBe('[[Bob#Bio]]')
    expect(replaceAllTokens('SELECT * WHERE { [[Bob#Bio]] ?p ?o }', '/vault/Alice.md'))
      .toContain(`<${heading.value}>`)
  })

  it('renders file metadata separately from note and heading selectors', async () => {
    const { dataset } = await service.triplify('/vault/Alice.md', '# Alice\n## Work\nrole :: Engineer')
    const app = { vault: { adapter: { getBasePath: () => '/vault' } } }
    // Exercise unordered CONSTRUCT output: the file type need not come first.
    const markdown = resultsToMarkdownTurtle([...dataset].reverse(), app)
    expect(markdown).toContain('<summary>Document metadata</summary>')
    expect(markdown).toContain('## [[Alice#Work]]')
    expect(markdown.indexOf('<summary>')).toBeLessThan(markdown.indexOf('## [[Alice]]'))
  })

  it('discovers all bundled query blocks and executes them against notes', async () => {
    const store = new Store()
    await addNote(store, '/vault/Alice.md', '---\ntags: [shared]\n---\n# Alice\nSee [[Bob#Bio]].')
    await addNote(store, '/vault/Bob.md', '---\ntags: [shared]\n---\n# Bob\n## Bio\nSee [[Alice]].')
    const directory = resolve('example-panels')
    let expectedCount = 0
    for (const filename of readdirSync(directory).filter(name => name.endsWith('.md'))) {
      const markdown = readFileSync(resolve(directory, filename), 'utf8')
      expectedCount += [...markdown.matchAll(/^```dot-sparql$/gm)].length
      await addNote(store, `/vault/${filename}`, markdown)
    }
    const panels = [...store.query(DEFAULT_SETTINGS.panelQuery)]
    expect(panels).toHaveLength(expectedCount)
    const results = new Map()
    for (const panel of panels) {
      const query = panel.get('content').value.replace(/^```dot-sparql\n|\n```$/g, '')
      const rewritten = replaceAllTokens(query, '/vault/Alice.md', null, '/vault')
      results.set(panel.get('title').value, [...store.query(rewritten, { use_default_graph_as_union: true })])
    }
    expect(results.get('Backlinks')).toHaveLength(1)
    expect(results.get('Links')).toHaveLength(1)
    expect(results.get('Tags of this document')[0].get('tag').value).toBe('shared')
    expect(results.get('Documents sharing a tag')[0].get('file').value)
      .toBe(pathToFileURL('/vault/Bob.md').value)
  })
})
