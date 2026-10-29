import { contextBridge, ipcRenderer } from 'electron'

const api = {
  assetBase: 'world://asset/',
  loadWorld: (): Promise<{ dir: string; data: unknown }> => ipcRenderer.invoke('world:load'),
  saveWorld: (data: unknown): Promise<boolean> => ipcRenderer.invoke('world:save', data),
  importImage: (folder: string): Promise<string | null> => ipcRenderer.invoke('world:importImage', folder),
  openWorldFolder: (): Promise<string> => ipcRenderer.invoke('world:openFolder')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
