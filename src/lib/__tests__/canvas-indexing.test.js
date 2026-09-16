import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Store } from 'oxigraph'
import { pathToFileURL } from 'canonical-md'
import { Controller } from '../Controller.js'

const board = { path: 'Board.canvas', basename: 'Board' }
const canvas = label => JSON.stringify({
  nodes: [
    { id: 'a', type: 'file', file: 'Alice.md', x: 0, y: 0, width: 100, height: 100 },
    { id: 'b', type: 'file', file: 'Bob.md', x: 200, y: 0, width: 100, height: 100 },
  ],
  edges: [{ id: 'edge', fromNode: 'a', toNode: 'b', label }],
})

describe('canvas indexing', () => {
  let controller
  let app
  beforeEach(() => {
    app = { vault: {
      adapter: { getFullPath: path => `/vault/${path}`, basePath: '/vault' },
      getFiles: () => [board, { path: 'Alice.md', basename: 'Alice' }, { path: 'image.png' }],
      read: vi.fn(async file => file.path === board.path ? canvas('knows') : '# Alice\nrole :: Engineer'),
    } }
    controller = new Controller(app, { mode: 'embedded', triplifierMode: 'embedded' })
    // Use the Node store directly; Obsidian initializes the WASM store instead.
    controller.triplestoreService.store = new Store()
    controller.triplestoreService.isInitialized = true
    controller.notifications.setEnabled(false)
  })

  const query = `SELECT ?role WHERE {
    GRAPH <file:///vault/Board.canvas> { <urn:name:Alice> <urn:token:knows> <urn:name:Bob> }
    GRAPH <file:///vault/Alice.md> { <urn:name:Alice> <urn:token:role> ?role }
  }`

  it('rebuilds Markdown and Canvas graphs and skips attachments', async () => {
    await controller.rebuildIndex()
    expect(app.vault.read.mock.calls.map(([file]) => file.path)).toEqual(['Board.canvas', 'Alice.md'])
    expect((await controller.select(query))[0].role.value).toBe('Engineer')
  })

  it('replaces canvas triples on save and removes its graph on deletion', async () => {
    await controller.rebuildIndex()
    await controller.syncFile(board, canvas('likes'))
    expect(await controller.select(query)).toHaveLength(0)
    const graph = pathToFileURL('/vault/Board.canvas')
    expect(controller.triplestoreService.store.match(null, null, null, graph).length).toBeGreaterThan(0)
    await controller.deleteNamedGraph(board.path)
    expect(controller.triplestoreService.store.match(null, null, null, graph)).toHaveLength(0)
    expect(controller.triplestoreService.size).toBeGreaterThan(0)
  })

  it('keeps the previous canvas graph when parsing fails', async () => {
    await controller.rebuildIndex()
    await expect(controller.syncFile(board, '{')).rejects.toThrow()
    expect(await controller.select(query)).toHaveLength(1)
  })
})
