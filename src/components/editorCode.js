/** Use Obsidian's loaded editor modes and retain Markdown highlighting as a fallback. */
export function styleEditorCode (container, codeMirror = globalThis.CodeMirror) {
  if (!codeMirror?.getMode || !codeMirror?.StringStream) return
  for (const code of container.querySelectorAll('pre > code')) {
    const language = [...code.classList].find(name => name.startsWith('language-'))?.slice(9)
    if (!codeMirror.modes?.[language]) continue
    const mode = codeMirror.getMode({ indentUnit: 2 }, language)
    const state = codeMirror.startState(mode)
    const lines = code.textContent.replace(/\n$/, '').split('\n')
    const fragment = document.createDocumentFragment()
    lines.forEach((text, index) => {
      const row = document.createElement('span')
      row.className = 'dot-triples-code-line'
      const number = document.createElement('span')
      number.className = 'dot-triples-code-number'
      number.dataset.line = String(index + 1)
      number.setAttribute('aria-hidden', 'true')
      const content = document.createElement('span')
      content.className = 'dot-triples-code-text'
      const stream = new codeMirror.StringStream(text, 4)
      if (!text && mode.blankLine) mode.blankLine(state)
      while (!stream.eol()) {
        stream.start = stream.pos
        const style = mode.token(stream, state)
        // Avoid a loop if a mode returns without consuming input.
        if (stream.pos === stream.start) stream.next()
        const token = document.createElement('span')
        if (style) token.className = style.split(/\s+/).map(name => `cm-${name}`).join(' ')
        token.textContent = stream.current()
        content.appendChild(token)
      }
      if (index < lines.length - 1) content.appendChild(document.createTextNode('\n'))
      row.append(number, content)
      fragment.appendChild(row)
    })
    code.replaceChildren(fragment)
    code.parentElement.classList.add('dot-triples-editor-code', 'cm-s-obsidian')
    code.parentElement.style.setProperty('--dot-triples-gutter-width', `${String(lines.length).length + 3}ch`)
  }
}
