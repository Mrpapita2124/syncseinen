import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('syncApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setDeviceName: (name: string) => ipcRenderer.invoke('config:setDeviceName', name),
  setPreferences: (prefs: { viewMode?: 'grid' | 'list' }) =>
    ipcRenderer.invoke('config:setPreferences', prefs),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadAndInstallUpdate: (params: { downloadUrl: string; assetName: string }) =>
    ipcRenderer.invoke('update:downloadAndInstall', params),
  onUpdateProgress: (callback: (event: unknown) => void) => {
    const listener = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on('update:progress', listener)
    return () => ipcRenderer.removeListener('update:progress', listener)
  },
  login: () => ipcRenderer.invoke('auth:login'),
  cancelLogin: () => ipcRenderer.invoke('auth:cancelLogin'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  pickLocalFolder: () => ipcRenderer.invoke('dialog:pickLocalFolder'),
  pickCoverImage: () => ipcRenderer.invoke('dialog:pickCoverImage'),
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
    ignoredPaths?: string[]
    coverImage?: string | null
  }) => ipcRenderer.invoke('sync:create', params),
  listLocalFolderContents: (rootPath: string, relSubPath?: string) =>
    ipcRenderer.invoke('local:listFolderContents', rootPath, relSubPath),
  listRemoteSyncFolderContents: (driveFolderPath: string, relSubPath?: string) =>
    ipcRenderer.invoke('drive:listSyncFolderContents', driveFolderPath, relSubPath),
  updateIgnoredPaths: (syncId: string, ignoredPaths: string[]) =>
    ipcRenderer.invoke('sync:updateIgnoredPaths', syncId, ignoredPaths),
  updateCoverImage: (syncId: string, coverImage: string | null) =>
    ipcRenderer.invoke('sync:updateCoverImage', syncId, coverImage),
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
