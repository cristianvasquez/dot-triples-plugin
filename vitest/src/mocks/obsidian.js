// Mock Obsidian API for testing
export class Notice {
  constructor(message, timeout) {
    this.message = message
    this.timeout = timeout
  }
}

export class Plugin {
  constructor(app, manifest) {
    this.app = app
    this.manifest = manifest
  }
  
  onload() {}
  onunload() {}
}

export class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app
    this.plugin = plugin
  }
  
  display() {}
}

export class Modal {
  constructor(app) {
    this.app = app
  }

  open() {}
  close() {}
}

export class MarkdownRenderer {
  static render(app, markdown, element, sourcePath, component) {
    element.innerHTML = markdown
  }
}

export const mockApp = {
  vault: {
    adapter: {
      getFullPath: (path) => `/vault/path/${path}`
    },
    read: () => Promise.resolve(''),
    getMarkdownFiles: () => [],
    on: () => {},
    offref: () => {}
  },
  workspace: {
    openLinkText: () => {},
    getLeaf: () => ({
      view: null,
      setViewState: () => Promise.resolve()
    }),
    getLeavesOfType: () => [],
    detachLeavesOfType: () => {},
    on: () => {},
    offref: () => {}
  },
  metadataCache: {
    on: () => {},
    offref: () => {}
  }
}
