import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('syncApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setDeviceName: (name: string) => ipcRenderer.invoke('config:setDeviceName', name),
  setPreferences: (prefs: {
    viewMode?: 'grid' | 'list'
    theme?: 'liquid' | 'flat-red' | 'material'
    closeBehavior?: 'tray' | 'quit'
  }) => ipcRenderer.invoke('config:setPreferences', prefs),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadAndInstallUpdate: (params: { downloadUrl: string; assetName: string }) =>
    ipcRenderer.invoke('update:downloadAndInstall', params),
  onUpdateProgress: (callback: (event: unknown) => void) => {
    const listener = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on('update:progress', listener)
    return () => ipcRenderer.removeListener('update:progress', listener)
  },
  login: (provider: string) => ipcRenderer.invoke('auth:login', provider),
  cancelLogin: () => ipcRenderer.invoke('auth:cancelLogin'),
  logout: (provider: string) => ipcRenderer.invoke('auth:logout', provider),
  pickLocalFolder: () => ipcRenderer.invoke('dialog:pickLocalFolder'),
  pickCoverImage: () => ipcRenderer.invoke('dialog:pickCoverImage'),
  searchCoverImagesOnline: (query: string) => ipcRenderer.invoke('cover:searchOnline', query),
  downloadCoverImageOnline: (params: { imageUrl: string; thumbnailUrl?: string }) =>
    ipcRenderer.invoke('cover:downloadOnline', params),
  openLocalPath: (folderPath: string) => ipcRenderer.invoke('shell:openLocalPath', folderPath),
  listDriveFolders: (parentPath?: string, provider?: string) =>
    ipcRenderer.invoke('drive:listFolders', parentPath, provider),
  createDriveFolder: (name: string, parentPath?: string, provider?: string) =>
    ipcRenderer.invoke('drive:createFolder', name, parentPath, provider),
  listSyncMetadatas: () => ipcRenderer.invoke('sync:listMetadatas'),
  scanGameSaves: () => ipcRenderer.invoke('games:scanSaves'),
  findAutoSavePaths: (syncs: unknown[]) => ipcRenderer.invoke('games:findAutoSavePaths', syncs),
  createGameSaveSync: (params: {
    provider: string
    name: string
    localPath: string
    ignoredPaths?: string[]
    coverUrl?: string | null
    thumbUrl?: string | null
    emulatorName?: string | null
    systemName?: string | null
  }) => ipcRenderer.invoke('games:createSaveSync', params),
  createSync: (params: {
    provider: string
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
    ignoredPaths?: string[]
    coverImage?: string | null
    isGameSave?: boolean
  }) => ipcRenderer.invoke('sync:create', params),
  listLocalFolderContents: (rootPath: string, relSubPath?: string) =>
    ipcRenderer.invoke('local:listFolderContents', rootPath, relSubPath),
  listRemoteSyncFolderContents: (driveFolderPath: string, relSubPath?: string, provider?: string) =>
    ipcRenderer.invoke('drive:listSyncFolderContents', driveFolderPath, relSubPath, provider),
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
  pushAll: (provider?: string) => ipcRenderer.invoke('sync:pushAll', provider),
  pullAll: (provider?: string) => ipcRenderer.invoke('sync:pullAll', provider),
  onProgress: (callback: (event: unknown) => void) => {
    const listener = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on('sync:progress', listener)
    return () => ipcRenderer.removeListener('sync:progress', listener)
  },
  onTrayAction: (callback: (action: 'pushAll' | 'pullAll') => void) => {
    const listener = (_event: unknown, action: 'pushAll' | 'pullAll') => callback(action)
    ipcRenderer.on('tray:action', listener)
    return () => ipcRenderer.removeListener('tray:action', listener)
  },
  triggerTrayMenuAction: (action: string) => {
    ipcRenderer.send('tray-menu:action', action)
  },
})
