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
  ignoredPaths?: string[]
  coverImage?: string | null
}

export interface LocalSyncMapping {
  localPath: string
  lastPulledAt?: string
  lastPushedAt?: string
  ignoredPaths?: string[]
}

export interface FolderEntryItem {
  name: string
  relPath: string
  isDir: boolean
  size?: number
}

export interface AppConfig {
  deviceName: string
  isConnected: boolean
  rcloneVersion?: string
  appVersion?: string
  theme?: 'liquid' | 'flat-red'
  closeBehavior?: 'tray' | 'quit'
  viewMode?: 'grid' | 'list'
  localMappings: Record<string, LocalSyncMapping>
}

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseName: string
  releaseNotes: string
  publishedAt: string
  downloadUrl: string | null
  assetName: string | null
  htmlUrl: string
}

export interface UpdateProgressEvent {
  phase: string
  percent: number
  detail?: string
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

export interface OnlineImageItem {
  id: string
  title: string
  thumbnail: string
  image: string
  width: number
  height: number
}

export interface SyncApi {
  getConfig: () => Promise<AppConfig>
  setDeviceName: (name: string) => Promise<AppConfig>
  setPreferences: (prefs: {
    viewMode?: 'grid' | 'list'
    theme?: 'liquid' | 'flat-red'
    closeBehavior?: 'tray' | 'quit'
  }) => Promise<AppConfig>
  checkForUpdates: () => Promise<UpdateCheckResult>
  downloadAndInstallUpdate: (params: {
    downloadUrl: string
    assetName: string
  }) => Promise<{ ok: boolean }>
  onUpdateProgress: (callback: (event: UpdateProgressEvent) => void) => () => void
  login: () => Promise<AppConfig>
  cancelLogin: () => Promise<AppConfig>
  logout: () => Promise<AppConfig>
  pickLocalFolder: () => Promise<string | null>
  pickCoverImage: () => Promise<string | null>
  searchCoverImagesOnline: (query: string) => Promise<OnlineImageItem[]>
  downloadCoverImageOnline: (params: {
    imageUrl: string
    thumbnailUrl?: string
  }) => Promise<string>
  openLocalPath: (folderPath: string) => Promise<void>
  listDriveFolders: (parentPath?: string) => Promise<DriveFolderItem[]>
  createDriveFolder: (name: string, parentPath?: string) => Promise<DriveFolderItem>
  listSyncMetadatas: () => Promise<SyncMetadata[]>
  createSync: (params: {
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
    ignoredPaths?: string[]
    coverImage?: string | null
  }) => Promise<{ meta: SyncMetadata; config: AppConfig }>
  listLocalFolderContents: (rootPath: string, relSubPath?: string) => Promise<FolderEntryItem[]>
  listRemoteSyncFolderContents: (
    driveFolderPath: string,
    relSubPath?: string
  ) => Promise<FolderEntryItem[]>
  updateIgnoredPaths: (
    syncId: string,
    ignoredPaths: string[]
  ) => Promise<{ meta: SyncMetadata; config: AppConfig }>
  updateCoverImage: (
    syncId: string,
    coverImage: string | null
  ) => Promise<{ meta: SyncMetadata; config: AppConfig }>
  assignLocalFolder: (syncId: string, localPath: string) => Promise<AppConfig>
  unlinkLocalFolder: (syncId: string) => Promise<AppConfig>
  deleteSyncMetadata: (syncId: string) => Promise<AppConfig>
  pushSync: (syncId: string) => Promise<{ meta: SyncMetadata; config: AppConfig }>
  pullSync: (syncId: string) => Promise<{ meta: SyncMetadata; config: AppConfig }>
  pushAll: () => Promise<{ metas: SyncMetadata[]; config: AppConfig; processedCount: number }>
  pullAll: () => Promise<{ metas: SyncMetadata[]; config: AppConfig; processedCount: number }>
  onProgress: (callback: (event: SyncProgressEvent) => void) => () => void
  onTrayAction: (callback: (action: 'pushAll' | 'pullAll') => void) => () => void
}

declare global {
  interface Window {
    syncApi: SyncApi
  }
}
