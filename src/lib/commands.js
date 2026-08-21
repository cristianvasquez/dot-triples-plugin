import { Notice } from 'obsidian'
import { refreshPanelQueries } from '../views/MainPanel.js'
import { getOSGQueryTemplate, getTemplate } from './templates.js'

export class CommandManager {
  constructor (plugin, controller) {
    this.plugin = plugin
    this.controller = controller
  }

  registerCommands () {
    this.plugin.addCommand({
      id: 'open-dot-triples-panel',
      name: 'Open panel',
      checkCallback: (checking) => {
        if (this.plugin.app.workspace.activeLeaf) {
          if (!checking) this.plugin.activateSidePanel()
          return true
        }
        return false
      },
    })

    this.plugin.addCommand({
      id: 'insert-sparql-template',
      name: 'Insert example SPARQL code-block',
      editorCallback: (editor) => {
        editor.replaceRange(getTemplate(), editor.getCursor())
      },
    })

    this.plugin.addCommand({
      id: 'insert-osg-template',
      name: 'Insert OSG query template',
      editorCallback: (editor) => {
        editor.replaceRange(getOSGQueryTemplate(), editor.getCursor())
      },
    })

    this.plugin.addCommand({
      id: 'sync-current-file',
      name: 'Sync current file',
      checkCallback: (checking) => {
        const activeFile = this.plugin.app.workspace.getActiveFile()
        if (activeFile) {
          if (!checking) {
            this.plugin.app.vault.read(activeFile).then(async content => {
              try {
                await this.controller.syncFile(activeFile, content, true)
              } catch (error) {
                console.error('Command sync file error:', error)
                // Error already shown by Controller with showNotifications=true
              }
            }).catch(error => {
              console.error('Failed to read file for sync:', error)
              new Notice(`Failed to read file: ${error.message}`)
            })
          }
          return true
        }
        return false
      },
    })

    this.plugin.addCommand({
      id: 'index-vault',
      name: 'Re-index vault',
      callback: () => this.controller.rebuildIndex(),
    })

    this.plugin.addCommand({
      id: 'refresh-panel-queries',
      name: 'Refresh panel',
      callback: async () => {
        if (this.plugin.debugView) {
          await refreshPanelQueries(this.plugin.appContext)
        }
      },
    })
  }

  registerEvents () {

    this.plugin.registerEvent(
      this.plugin.app.vault.on('modify', async (file) => {
        // Only sync when file is modified/saved if setting is enabled
        if (this.plugin.settings.indexOnSave) {
          try {
            const content = await this.plugin.app.vault.read(file)
            await this.controller.syncFile(file, content)
          } catch (error) {
            console.error('Auto-sync on save error:', error)
            new Notice(
              `Auto-sync failed for ${file.basename}: ${error.message}`)
          }
        }
        // Update debug panel if open
        if (file && this.plugin.debugView) {
          await this.plugin.debugView.updateForFile()
        }
      }),
    )

    this.plugin.registerEvent(
      this.plugin.app.vault.on('rename', async (file, oldPath) => {
        try {
          await this.controller.deleteNamedGraph(oldPath)
          // Only sync renamed file if indexOnSave is enabled
          if (this.plugin.settings.indexOnSave) {
            const content = await this.plugin.app.vault.read(file)
            await this.controller.syncFile(file, content)
          }
        } catch (error) {
          console.error('Auto-sync on rename error:', error)
          new Notice(
            `Auto-sync failed for renamed ${file.basename}: ${error.message}`)
        }
        // Update debug panel if open
        if (file && this.plugin.debugView) {
          await this.plugin.debugView.updateForFile()
        }
      }),
    )

    this.plugin.registerEvent(
      this.plugin.app.vault.on('delete', async (file) => {
        await this.controller.deleteNamedGraph(file.path)

      }),
    )

    // Update debug panel when switching files and optionally index on open
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('file-open', async (file) => {
        // Index file on open if setting is enabled
        if (file && this.plugin.settings.indexOnOpen) {
          try {
            const content = await this.plugin.app.vault.read(file)
            await this.controller.syncFile(file, content)
          } catch (error) {
            console.error('Auto-sync on open error:', error)
            new Notice(
              `Auto-sync failed for ${file.basename}: ${error.message}`)
          }
        }
        // Update debug panel if open
        if (file && this.plugin.debugView) {
          await this.plugin.debugView.updateForFile()
        }
      }),
    )

  }
}
