export interface SyncMetadata {
  id: string
  name: string
  driveFolderPath: string
  driveFolderName: string
  createdAt: string
  createdByDevice: string
  lastPushedAt: string | null
  lastPushedByDevice: string | null
  lastPushedFileCount: number
}

export interface LocalSyncMapping {
  localPath: string
  lastPulledAt?: string
  lastPushedAt?: string
}

export interface AppConfig {
  deviceName: string
  isConnected: boolean
  rcloneVersion?: string
  localMappings: Record<string, LocalSyncMapping>
}

export interface SyncProgressEvent {
  syncId: string
  syncName: string
  operation: 'push' | 'pull' | 'setup'
  phase: string
  current: number
  total: number
  detail?: string
}

export interface DriveFolderItem {
  path: string
  name: string
  parentPath: string
}

export interface SyncApi {
  getConfig: () => Promise<AppConfig>
  setDeviceName: (name: string) => Promise<AppConfig>
  login: () => Promise<AppConfig>
  cancelLogin: () => Promise<AppConfig>
  logout: () => Promise<AppConfig>
  pickLocalFolder: () => Promise<string | null>
  openLocalPath: (folderPath: string) => Promise<void>
  listDriveFolders: (parentPath?: string) => Promise<DriveFolderItem[]>
  createDriveFolder: (name: string, parentPath?: string) => Promise<DriveFolderItem>
  listSyncMetadatas: () => Promise<SyncMetadata[]>
  createSync: (params: {
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
  }) => Promise<{ meta: SyncMetadata; config: AppConfig }>
  assignLocalFolder: (syncId: string, localPath: string) => Promise<AppConfig>
  unlinkLocalFolder: (syncId: string) => Promise<AppConfig>
  deleteSyncMetadata: (syncId: string) => Promise<AppConfig>
  pushSync: (syncId: string) => Promise<{ meta: SyncMetadata; config: AppConfig }>
  pullSync: (syncId: string) => Promise<{ meta: SyncMetadata; config: AppConfig }>
  pushAll: () => Promise<{ metas: SyncMetadata[]; config: AppConfig; processedCount: number }>
  pullAll: () => Promise<{ metas: SyncMetadata[]; config: AppConfig; processedCount: number }>
  onProgress: (callback: (event: SyncProgressEvent) => void) => () => void
}

declare global {
  interface Window {
    syncApi: SyncApi
  }
}
