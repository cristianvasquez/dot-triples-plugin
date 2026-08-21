# Dot Triples

Query your Obsidian notes with SPARQL. Dot Triples is an alternative to Dataview
that uses standard RDF and SPARQL instead of a custom query language.

## What it does

Dot Triples indexes your markdown files as RDF triples with
[dot-triples](https://github.com/cristianvasquez/dot-triples) and stores them in
a triplestore. You then query that graph from inside your notes.

You can:

- Run SPARQL queries in `dot-sparql` code blocks.
- Show contextual panels with query results for the current note.
- Query across many vaults when you use a shared triplestore.

The queries use standard SPARQL. Other RDF tools and external systems (for
example MCP servers) can query the same graph.

## Features

- **Built-in triplestore**: the plugin runs an in-memory triplestore. You do not
  need external setup to start.
- **Automatic indexing**: the plugin indexes a note when you open or save it.
- **Contextual panels**: the panel shows query results for the current note.
- **Cross-vault queries**: query across many vaults through a shared triplestore.
- **Agent integration**: external tools can query the graph through the SPARQL
  endpoint.

## Install

Install with [BRAT](https://tfthacker.com/BRAT):

1. Install the BRAT plugin.
2. Add this repository: `https://github.com/cristianvasquez/dot-triples-plugin`.

Or install manually:

1. Download the release archive from the GitHub releases page.
2. Extract `main.js`, `manifest.json`, and `styles.css` into
   `<vault>/.obsidian/plugins/dot-triples/`.

## Quick start

1. Enable the plugin. It uses the in-memory triplestore by default.
2. Run the **Re-index vault** command to index your notes.
3. Add a `dot-sparql` code block to a note:

```dot-sparql
SELECT ?p ?o WHERE {
  ?s ?p ?o .
} LIMIT 5
```

This query shows 5 triples.

To query the current note, use the note name as the subject:

```dot-sparql
SELECT ?p ?o WHERE {
  [[Current Note]] ?p ?o .
}
```

4. Open the panel to show contextual queries for the current note.

## Template tokens

The plugin replaces these tokens before it sends the query:

- `__THIS__`: the current note name URI (`urn:name:NoteName`).
- `__DOC__`: the current note file URI (`file:///absolute/path`).
- `__REPO__`: the current vault repository URI.
- `__property__`: a property placeholder (for example, `__label__` becomes
  `<urn:token:label>`).
- `[[Note Name]]`: a wiki link. The plugin converts it to a name URI.

## Example panels

The [example-panels/](./example-panels/) directory has ready-to-use query panels
for backlinks, statistics, navigation, tags, and more. Each panel is a note with
the `panel/query` tag.

## Commands

- **Open panel**: show the query panel for the current note.
- **Insert example SPARQL code-block**: add a query template at the cursor.
- **Insert named query template**: add a titled query block at the cursor.
- **Sync current file**: index the current note.
- **Re-index vault**: index all notes in the vault.
- **Refresh panel**: reload the panel and render it again.

## Settings

- **Query URL**: the SPARQL endpoint. Set it to use an external triplestore
  instead of the built-in one.
- **Panel tag**: the tag that marks panel notes. The default is `panel/query`.
- **Panel SPARQL query**: the query that finds panel notes. It must return
  `?document`, `?title`, and `?content`.
- **Index on open / Index on save**: index a note automatically when you open or
  save it.

## Development

```bash
pnpm install       # install dependencies
pnpm run build     # production build into main.js
pnpm exec vitest run   # run the tests once
```
