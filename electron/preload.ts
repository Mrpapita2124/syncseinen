import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('syncApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setDeviceName: (name: string) => ipcRenderer.invoke('config:setDeviceName', name),
  login: () => ipcRenderer.invoke('auth:login'),
  cancelLogin: () => ipcRenderer.invoke('auth:cancelLogin'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  pickLocalFolder: () => ipcRenderer.invoke('dialog:pickLocalFolder'),
  openLocalPath: (folderPath: string) => ipcRenderer.invoke('shell:openLocalPath', folderPath),
  listDriveFolders: (parentPath?: string) => ipcRenderer.invoke('drive:listFolders', parentPath),
  createDriveFolder: (name: string, parentPath?: string) =>
    ipcRenderer.invoke('drive:createFolder', name, parentPath),
  listSyncMetadatas: () => ipcRenderer.invoke('sync:listMetadatas'),
  createSync: (params: {
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
  }) => ipcRenderer.invoke('sync:create', params),
  assignLocalFolder: (syncId: string, localPath: string) =>
    ipcRenderer.invoke('sync:assignLocalFolder', syncId, localPath),
  unlinkLocalFolder: (syncId: string) => ipcRenderer.invoke('sync:unlinkLocalFolder', syncId),
  deleteSyncMetadata: (syncId: string) => ipcRenderer.invoke('sync:deleteMetadata', syncId),
  pushSync: (syncId: string) => ipcRenderer.invoke('sync:push', syncId),
  pullSync: (syncId: string) => ipcRenderer.invoke('sync:pull', syncId),
  pushAll: () => ipcRenderer.invoke('sync:pushAll'),
  pullAll: () => ipcRenderer.invoke('sync:pullAll'),
  onProgress: (callback: (event: unknown) => void) => {
    const listener = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on('sync:progress', listener)
    return () => ipcRenderer.removeListener('sync:progress', listener)
  },
})
