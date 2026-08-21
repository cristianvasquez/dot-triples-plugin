import { ItemView } from 'obsidian'
import { renderPanel } from './MainPanel.js'

export const SIDE_VIEW_ID = `dot-triples-sideview`

export class CurrentFileView extends ItemView {
  constructor (leaf, appContext) {
    super(leaf)
    this.appContext = appContext
    this.container = null
    this.lastUpdateTime = null
  }

  getViewType () {
    return SIDE_VIEW_ID
  }

  getDisplayText () {
    return 'Dot Triples'
  }

  async onOpen () {
    // Use the proper content container for ItemView
    this.container = this.contentEl
    await renderPanel(this.container, this.appContext, true) // Force init on first open

    // Store reference in plugin for file change updates
    this.appContext.plugin.debugView = this
  }

  async onClose () {
    // Remove reference from plugin
    if (this.appContext.plugin.debugView === this) {
      this.appContext.plugin.debugView = null
    }
  }

  async updateForFile () {
    if (this.container) {
      await renderPanel(this.container, this.appContext)
    }
  }
}
