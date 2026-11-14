import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, Tray, Menu, Notification, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import https from 'node:https'
import crypto from 'node:crypto'
import { spawn, execFile, ChildProcess } from 'node:child_process'
import extract from 'extract-zip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export type CloudProvider = 'gdrive' | 'dropbox' | 'onedrive'

export interface SyncMetadata {
  id: string
  provider?: CloudProvider
  isGameSave?: boolean
  emulatorName?: string | null
  systemName?: string | null
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

export interface AutoDetectedSaveMatch {
  syncId: string
  localPath: string
  ignoredPaths?: string[]
  emulatorName?: string | null
  systemName?: string | null
  matchType: 'exact-save' | 'emulator-root' | 'ludusavi-path'
}

export interface DetectedGameSaveItem {
  id: string
  name: string
  steamId: number | null
  localPath: string
  ignoredPaths: string[]
  coverUrl: string | null
  thumbUrl: string | null
  source?: 'ludusavi' | 'emuvault' | 'emuatlas'
  emulatorName?: string | null
  systemName?: string | null
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
  connectedServices: Record<CloudProvider, boolean>
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
  htmlUrl: string
  downloadUrl: string | null
  assetName: string | null
}

export interface UpdateProgressEvent {
  percent: number
  phase: string
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

const CONFIG_FILENAME = 'syncseinen-config.json'
const RCLONE_CONF_FILENAME = 'rclone.conf'
const REMOTE_NAME = 'syncseinen'
const METADATA_FOLDER_NAME = '_SyncSeinen_Metadata'
const GAME_SAVES_ROOT_FOLDER = 'SyncSeinen_games_saves'
const STEAMGRIDDB_API_KEY = 'ac4b064580cac55b3050b8b2f4d42a73'
const LUDUSAVI_MANIFEST_URL =
  'https://raw.githubusercontent.com/mtkennerly/ludusavi-manifest/master/data/manifest.yaml'
const GITHUB_REPO = 'Mrpapita2124/syncseinen'

const ALL_PROVIDERS: CloudProvider[] = ['gdrive', 'dropbox', 'onedrive']

const PROVIDER_CONFIG: Record<
  CloudProvider,
  { remoteName: string; rcloneType: string; label: string }
> = {
  gdrive: {
    remoteName: 'syncseinen',
    rcloneType: 'drive',
    label: 'Google Drive',
  },
  dropbox: {
    remoteName: 'syncseinen_dropbox',
    rcloneType: 'dropbox',
    label: 'Dropbox',
  },
  onedrive: {
    remoteName: 'syncseinen_onedrive',
    rcloneType: 'onedrive',
    label: 'OneDrive',
  },
}

function isNewerSemver(latest: string, current: string): boolean {
  const cleanLatest = latest.replace(/^v/i, '').trim().split('-')[0]
  const cleanCurrent = current.replace(/^v/i, '').trim().split('-')[0]
  const lParts = cleanLatest.split('.').map((n) => parseInt(n, 10) || 0)
  const cParts = cleanCurrent.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(lParts.length, cParts.length)
  for (let i = 0; i < len; i++) {
    const l = lParts[i] || 0
    const c = cParts[i] || 0
    if (l > c) return true
    if (l < c) return false
  }
  return false
}

function fetchJsonFromUrl(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'SyncSeinen-AutoUpdater',
          Accept: 'application/vnd.github+json',
        },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchJsonFromUrl(res.headers.location).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        let body = ''
        res.on('data', (chunk) => {
          body += chunk.toString()
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch (e) {
            reject(e)
          }
        })
      }
    )
    req.on('error', reject)
  })
}

function downloadFileWithProgress(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'SyncSeinen-AutoUpdater',
        },
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          downloadFileWithProgress(response.headers.location, destPath, onProgress)
            .then(resolve)
            .catch(reject)
          return
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Error descargando actualización (HTTP ${response.statusCode})`))
          return
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedBytes = 0

        const file = fs.createWriteStream(destPath)
        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length
          if (totalBytes > 0 && onProgress) {
            const pct = Math.min(99, Math.round((downloadedBytes / totalBytes) * 100))
            onProgress(pct)
          }
        })

        response.pipe(file)
        file.on('finish', () => {
          file.close()
          if (onProgress) onProgress(100)
          resolve()
        })
        file.on('error', (err) => {
          fs.unlink(destPath, () => {})
          reject(err)
        })
      }
    )
    req.on('error', (err) => reject(err))
  })
}

async function checkGitHubUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  try {
    const data = await fetchJsonFromUrl(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
    )
    const tagName = String(data.tag_name || '')
    const latestVersion = tagName.replace(/^v/i, '').trim() || currentVersion
    const hasUpdate = isNewerSemver(latestVersion, currentVersion)

    const assets = Array.isArray(data.assets)
      ? (data.assets as Array<{ name: string; browser_download_url: string }>)
      : []

    let selectedAsset: { name: string; browser_download_url: string } | undefined

    if (process.platform === 'linux') {
      selectedAsset =
        assets.find((a) => a.name.toLowerCase().endsWith('.appimage')) || assets[0]
    } else {
      const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE)
      if (isPortable) {
        selectedAsset =
          assets.find((a) => a.name.toLowerCase().endsWith('.exe')) ||
          assets.find((a) => a.name.toLowerCase().endsWith('.zip'))
      } else {
        selectedAsset =
          assets.find((a) => a.name.toLowerCase().endsWith('.zip')) ||
          assets.find((a) => a.name.toLowerCase().endsWith('.exe'))
      }
    }

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseName: String(data.name || `SyncSeinen v${latestVersion}`),
      releaseNotes: String(data.body || 'Mejoras de rendimiento y estabilidad.'),
      publishedAt: String(data.published_at || ''),
      htmlUrl: String(data.html_url || `https://github.com/${GITHUB_REPO}/releases`),
      downloadUrl: selectedAsset?.browser_download_url || null,
      assetName: selectedAsset?.name || null,
    }
  } catch {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseName: `SyncSeinen v${currentVersion}`,
      releaseNotes: '',
      publishedAt: '',
      htmlUrl: `https://github.com/${GITHUB_REPO}/releases`,
      downloadUrl: null,
      assetName: null,
    }
  }
}

async function downloadAndApplyUpdate(
  downloadUrl: string,
  assetName: string,
  onProgress: (ev: UpdateProgressEvent) => void
): Promise<void> {
  const safeName = assetName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const tempDownloadPath = path.join(os.tmpdir(), `syncseinen-update-${Date.now()}-${safeName}`)

  onProgress({
    percent: 2,
    phase: `Descargando ${assetName} desde GitHub Releases...`,
  })

  await downloadFileWithProgress(downloadUrl, tempDownloadPath, (pct) => {
    onProgress({
      percent: pct,
      phase: `Descargando nueva versión (${pct}%)...`,
    })
  })

  if (process.platform === 'win32') {
    if (safeName.toLowerCase().endsWith('.exe')) {
      const targetExe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
      const batPath = path.join(os.tmpdir(), `syncseinen-updater-${Date.now()}.bat`)
      const batContent = [
        '@echo off',
        'timeout /t 2 /nobreak >nul',
        ':retry',
        `move /y "${tempDownloadPath}" "${targetExe}" >nul 2>&1`,
        'if errorlevel 1 (',
        '  timeout /t 1 /nobreak >nul',
        '  goto retry',
        ')',
        `start "" "${targetExe}"`,
        'del "%~f0"',
      ].join('\r\n')

      fs.writeFileSync(batPath, batContent, 'utf-8')
      onProgress({
        percent: 100,
        phase: 'Instalando y reiniciando aplicación...',
      })

      const child = spawn('cmd.exe', ['/c', batPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
      setTimeout(() => {
        isQuitting = true
        app.quit()
      }, 400)
      return
    }

    if (safeName.toLowerCase().endsWith('.zip')) {
      const extractDir = path.join(os.tmpdir(), `syncseinen-update-extracted-${Date.now()}`)
      onProgress({
        percent: 99,
        phase: 'Descomprimiendo paquete de actualización...',
      })
      fs.mkdirSync(extractDir, { recursive: true })
      await extract(tempDownloadPath, { dir: extractDir })

      const targetDir = path.dirname(process.execPath)
      const targetExe = process.execPath
      const batPath = path.join(os.tmpdir(), `syncseinen-updater-${Date.now()}.bat`)
      const batContent = [
        '@echo off',
        'timeout /t 2 /nobreak >nul',
        `xcopy /s /e /y "${extractDir}\\*" "${targetDir}\\" >nul 2>&1`,
        `start "" "${targetExe}"`,
        `rmdir /s /q "${extractDir}" >nul 2>&1`,
        `del /f /q "${tempDownloadPath}" >nul 2>&1`,
        'del "%~f0"',
      ].join('\r\n')

      fs.writeFileSync(batPath, batContent, 'utf-8')
      onProgress({
        percent: 100,
        phase: 'Instalando y reiniciando aplicación...',
      })

      const child = spawn('cmd.exe', ['/c', batPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
      setTimeout(() => {
        isQuitting = true
        app.quit()
      }, 400)
      return
    }
  } else {
    // Linux AppImage
    fs.chmodSync(tempDownloadPath, 0o755)
    const targetAppImage = process.env.APPIMAGE || process.execPath
    const shCmd = `sleep 2 && mv -f "${tempDownloadPath}" "${targetAppImage}" && chmod +x "${targetAppImage}" && "${targetAppImage}" &`
    const child = spawn('sh', ['-c', shCmd], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    setTimeout(() => {
      isQuitting = true
      app.quit()
    }, 400)
  }
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME)
}

function getRcloneConfigPath(): string {
  return path.join(app.getPath('userData'), RCLONE_CONF_FILENAME)
}

function removeRemoteSectionFromConf(remoteName: string): void {
  const confPath = getRcloneConfigPath()
  if (!fs.existsSync(confPath)) return
  try {
    const content = fs.readFileSync(confPath, 'utf-8')
    const lines = content.split(/\r?\n/)
    const kept: string[] = []
    let skipping = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const secName = trimmed.slice(1, -1).trim()
        skipping = secName === remoteName
      }
      if (!skipping) {
        kept.push(line)
      }
    }
    const nextContent = kept.join('\n').trim()
    fs.writeFileSync(confPath, nextContent ? `${nextContent}\n` : '', 'utf-8')
  } catch {
    // ignore
  }
}

function isProviderConfigured(provider: CloudProvider): boolean {
  const confPath = getRcloneConfigPath()
  if (!fs.existsSync(confPath)) return false
  try {
    const content = fs.readFileSync(confPath, 'utf-8')
    const remoteName = PROVIDER_CONFIG[provider]?.remoteName
    if (!remoteName) return false

    const lines = content.split(/\r?\n/)
    let inSection = false
    let hasToken = false
    let hasDriveId = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const secName = trimmed.slice(1, -1).trim()
        inSection = secName === remoteName
      } else if (inSection) {
        if (/^token\s*=\s*\S+/.test(trimmed)) {
          hasToken = true
        }
        if (/^drive_id\s*=\s*\S+/.test(trimmed)) {
          hasDriveId = true
        }
      }
    }
    if (provider === 'onedrive') {
      return hasToken && hasDriveId
    }
    return hasToken
  } catch {
    return false
  }
}

function getConnectedServices(): Record<CloudProvider, boolean> {
  return {
    gdrive: isProviderConfigured('gdrive'),
    dropbox: isProviderConfigured('dropbox'),
    onedrive: isProviderConfigured('onedrive'),
  }
}

function hasRcloneRemoteConfigured(): boolean {
  const services = getConnectedServices()
  return Object.values(services).some(Boolean)
}

function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  const connectedServices = getConnectedServices()
  const isConnected = Object.values(connectedServices).some(Boolean)
  const defaultConfig: AppConfig = {
    deviceName:
      os.hostname() || (process.platform === 'linux' ? 'Dispositivo-Linux' : 'Dispositivo-Windows'),
    isConnected,
    connectedServices,
    localMappings: {},
  }
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw)
      return {
        ...defaultConfig,
        ...parsed,
        isConnected,
        connectedServices,
        localMappings: parsed.localMappings || {},
      }
    }
  } catch (err) {
    console.error('Error reading config:', err)
  }
  return defaultConfig
}

function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error writing config:', err)
  }
}

function downloadFileWithRedirects(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        downloadFileWithRedirects(response.headers.location, destPath).then(resolve).catch(reject)
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Error descargando rclone (HTTP ${response.statusCode})`))
        return
      }
      const file = fs.createWriteStream(destPath)
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
      file.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    })
    request.on('error', (err) => reject(err))
  })
}

class RcloneSyncService {
  private rcloneBinPath: string | null = null
  private activeAuthProcess: ChildProcess | null = null
  private activeAuthProvider: CloudProvider | null = null
  private loginCanceled = false
  private metadataFolderEnsured: Set<CloudProvider> = new Set()
  private metadatasCache: Map<string, SyncMetadata> = new Map()
  private onProgressCallback?: (event: SyncProgressEvent) => void

  constructor(onProgress?: (event: SyncProgressEvent) => void) {
    this.onProgressCallback = onProgress
  }

  private getRemoteName(provider: CloudProvider = 'gdrive'): string {
    return PROVIDER_CONFIG[provider]?.remoteName || REMOTE_NAME
  }

  private getProviderLabel(provider: CloudProvider = 'gdrive'): string {
    return PROVIDER_CONFIG[provider]?.label || 'Google Drive'
  }

  /**
   * Flags de aceleración para que rclone opere a máxima velocidad según el proveedor
   */
  private getSpeedFlags(provider: CloudProvider = 'gdrive'): string[] {
    if (provider === 'onedrive') {
      return [
        '--transfers',
        '8',
        '--checkers',
        '16',
        '--buffer-size',
        '32M',
        '--exclude',
        '/Personal Vault/**',
        '--exclude',
        '/Almacén personal/**',
        '--exclude',
        '/Bóveda personal/**',
      ]
    }
    const baseFlags = [
      '--fast-list',
      '--transfers',
      '16',
      '--checkers',
      '32',
      '--buffer-size',
      '32M',
    ]
    if (provider === 'gdrive') {
      return [
        ...baseFlags,
        '--drive-chunk-size',
        '64M',
        '--drive-pacer-min-sleep',
        '10ms',
        '--drive-pacer-burst',
        '200',
      ]
    }
    if (provider === 'dropbox') {
      return [...baseFlags, '--dropbox-chunk-size', '64M']
    }
    return baseFlags
  }

  private emitProgress(event: SyncProgressEvent) {
    if (this.onProgressCallback) {
      this.onProgressCallback(event)
    }
  }

  /**
   * Busca el ejecutable de rclone en:
   * 1. Recursos empaquetados de la aplicación (resources/bin/rclone[.exe])
   * 2. Carpeta userData/bin/rclone[.exe]
   * 3. PATH del sistema operativo (Windows o Linux)
   * Si no existe en ninguno, lo descarga automáticamente desde downloads.rclone.org para el SO actual.
   */
  public async ensureRcloneBinary(): Promise<string> {
    if (this.rcloneBinPath && fs.existsSync(this.rcloneBinPath)) {
      return this.rcloneBinPath
    }

    const exeName = process.platform === 'win32' ? 'rclone.exe' : 'rclone'

    const candidates = [
      path.join(process.resourcesPath || '', 'bin', exeName),
      path.join(app.getAppPath(), 'resources', 'bin', exeName),
      path.join(process.cwd(), 'resources', 'bin', exeName),
      path.join(app.getPath('userData'), 'bin', exeName),
    ]

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          if (process.platform !== 'win32') {
            fs.chmodSync(candidate, 0o755)
          }
          this.rcloneBinPath = candidate
          return candidate
        } catch {
          // continuar probando candidatos
        }
      }
    }

    // Probar si rclone está instalado globalmente en el PATH del sistema (muy común en Linux y Windows)
    const systemRcloneWorks = await new Promise<boolean>((resolve) => {
      execFile('rclone', ['version'], (err) => {
        resolve(!err)
      })
    })

    if (systemRcloneWorks) {
      this.rcloneBinPath = 'rclone'
      return 'rclone'
    }

    // Descargar automáticamente rclone oficial para Windows o Linux
    const userBinDir = path.join(app.getPath('userData'), 'bin')
    fs.mkdirSync(userBinDir, { recursive: true })
    const targetBin = path.join(userBinDir, exeName)

    const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
    const osName = process.platform === 'win32' ? 'windows' : 'linux'
    const zipUrl = `https://downloads.rclone.org/rclone-current-${osName}-${arch}.zip`
    const tempZip = path.join(os.tmpdir(), `rclone-${Date.now()}.zip`)
    const tempExtractDir = path.join(os.tmpdir(), `rclone-extract-${Date.now()}`)

    this.emitProgress({
      syncId: 'setup',
      syncName: 'Motor Rclone',
      operation: 'setup',
      phase: `Descargando rclone oficial para ${osName}-${arch}...`,
      current: 1,
      total: 2,
    })

    await downloadFileWithRedirects(zipUrl, tempZip)
    fs.mkdirSync(tempExtractDir, { recursive: true })
    await extract(tempZip, { dir: tempExtractDir })

    // Buscar el binario dentro de la carpeta extraída
    const findBinary = (dir: string): string | null => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          const found = findBinary(full)
          if (found) return found
        } else if (entry.name === exeName) {
          return full
        }
      }
      return null
    }

    const extractedBin = findBinary(tempExtractDir)
    if (!extractedBin) {
      throw new Error('No se encontró el binario de rclone dentro del archivo descargado.')
    }

    fs.copyFileSync(extractedBin, targetBin)
    if (process.platform !== 'win32') {
      fs.chmodSync(targetBin, 0o755)
    }

    try {
      fs.unlinkSync(tempZip)
      fs.rmSync(tempExtractDir, { recursive: true, force: true })
    } catch {
      // ignorar limpieza
    }

    this.rcloneBinPath = targetBin
    return targetBin
  }

  private async runRclone(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const bin = await this.ensureRcloneBinary()
    const confPath = getRcloneConfigPath()
    const fullArgs = [...args, '--config', confPath]

    return new Promise((resolve, reject) => {
      execFile(
        bin,
        fullArgs,
        { maxBuffer: 50 * 1024 * 1024, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message))
            return
          }
          resolve({ stdout, stderr })
        }
      )
    })
  }

  public async getVersion(): Promise<string> {
    try {
      const { stdout } = await this.runRclone(['version'])
      const firstLine = stdout.split(/\r?\n/)[0]
      return firstLine || 'rclone activo'
    } catch {
      return 'rclone listo'
    }
  }

  private fetchGraphJson(url: string, accessToken: string): Promise<any | null> {
    return new Promise((resolve) => {
      try {
        const req = https.get(
          url,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            timeout: 6000,
          },
          (res) => {
            let body = ''
            res.on('data', (chunk) => {
              body += chunk.toString()
            })
            res.on('end', () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                try {
                  resolve(JSON.parse(body))
                  return
                } catch {
                  resolve(null)
                  return
                }
              }
              resolve(null)
            })
          }
        )
        req.on('error', () => resolve(null))
        req.on('timeout', () => {
          req.destroy()
          resolve(null)
        })
      } catch {
        resolve(null)
      }
    })
  }

  private readAccessTokenFromConf(remoteName: string): string | null {
    const confPath = getRcloneConfigPath()
    if (!fs.existsSync(confPath)) return null
    try {
      const content = fs.readFileSync(confPath, 'utf-8')
      const lines = content.split(/\r?\n/)
      let inSection = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          inSection = trimmed.slice(1, -1).trim() === remoteName
        } else if (inSection && /^token\s*=/.test(trimmed)) {
          const jsonStr = trimmed.replace(/^token\s*=\s*/, '').trim()
          const parsed = JSON.parse(jsonStr)
          if (parsed && typeof parsed.access_token === 'string' && parsed.access_token) {
            return parsed.access_token
          }
        }
      }
    } catch {
      // ignore
    }
    return null
  }

  /**
   * Obtiene y prioriza los candidatos de drive_id para OneDrive.
   * En cuentas personales de Microsoft con Personal Vault (Almacén personal),
   * /me/drives suele devolver primero un drive fantasma "b!..." que falla con
   * HTTP 400 "ObjectHandle is Invalid", mientras que el segundo drive (hexadecimal sin "b!")
   * o el devuelto por /me/drive/root es el OneDrive real del usuario.
   */
  private async resolveOneDriveCandidateDrives(
    remoteName: string,
    examples: Array<{ Value?: string; Help?: string }>
  ): Promise<string[]> {
    const highPriority: string[] = []
    const lowPriority: string[] = []

    const addCandidate = (id: unknown, preferHigh: boolean) => {
      if (typeof id !== 'string') return
      const clean = id.trim()
      if (!clean) return
      const isBHandle = clean.startsWith('b!')
      if (preferHigh && !isBHandle) {
        if (!highPriority.includes(clean)) highPriority.push(clean)
      } else if (!isBHandle) {
        if (!highPriority.includes(clean)) highPriority.push(clean)
      } else {
        if (!lowPriority.includes(clean)) lowPriority.push(clean)
      }
    }

    // 1. Clasificar los ejemplos devueltos por rclone (priorizando los que NO empiezan con "b!")
    for (const ex of examples) {
      if (ex?.Value) {
        addCandidate(ex.Value, !ex.Value.startsWith('b!'))
      }
    }

    // 2. Consultar directamente Microsoft Graph con el token recién obtenido por rclone
    const accessToken = this.readAccessTokenFromConf(remoteName)
    if (accessToken) {
      const [meDriveRoot, meDrive, meDrives] = await Promise.all([
        this.fetchGraphJson('https://graph.microsoft.com/v1.0/me/drive/root', accessToken),
        this.fetchGraphJson('https://graph.microsoft.com/v1.0/me/drive', accessToken),
        this.fetchGraphJson('https://graph.microsoft.com/v1.0/me/drives', accessToken),
      ])

      if (meDriveRoot?.parentReference?.driveId) {
        const rootDriveId = String(meDriveRoot.parentReference.driveId).trim()
        if (rootDriveId && !highPriority.includes(rootDriveId)) {
          highPriority.unshift(rootDriveId)
        }
      }

      if (meDrive?.id) {
        addCandidate(meDrive.id, true)
      }
      if (typeof meDrive?.webUrl === 'string') {
        const match = meDrive.webUrl.match(/\/personal\/([a-fA-F0-9]{12,32})(?:\/|$)/)
        if (match?.[1]) {
          addCandidate(match[1], true)
        }
      }

      if (Array.isArray(meDrives?.value)) {
        for (const d of meDrives.value) {
          if (d?.id) {
            addCandidate(d.id, !String(d.id).startsWith('b!'))
          }
          if (typeof d?.webUrl === 'string') {
            const match = d.webUrl.match(/\/personal\/([a-fA-F0-9]{12,32})(?:\/|$)/)
            if (match?.[1]) {
              addCandidate(match[1], true)
            }
          }
        }
      }
    }

    const combined: string[] = []
    for (const id of [...highPriority, ...lowPriority]) {
      if (id && !combined.includes(id)) {
        combined.push(id)
      }
    }
    return combined
  }

  /**
   * Inicia sesión con el proveedor elegido (Google Drive, Dropbox o OneDrive) mediante rclone
   * usando la máquina de estados --non-interactive para completar automáticamente preguntas post-OAuth
   * (como drive_id y drive_type en OneDrive) y sin abrir pestañas duplicadas en el navegador.
   */
  public async loginWithRclone(provider: CloudProvider = 'gdrive'): Promise<AppConfig> {
    const bin = await this.ensureRcloneBinary()
    const confPath = getRcloneConfigPath()
    fs.mkdirSync(path.dirname(confPath), { recursive: true })

    if (this.activeAuthProcess) {
      try {
        this.activeAuthProcess.kill()
      } catch {
        // ignorar
      }
      this.activeAuthProcess = null
    }

    const remoteName = this.getRemoteName(provider)
    const providerLabel = this.getProviderLabel(provider)
    this.activeAuthProvider = provider
    this.loginCanceled = false

    // Eliminar cualquier sección previa incompleta de este proveedor
    removeRemoteSectionFromConf(remoteName)

    const runStep = (args: string[]): Promise<{
      State?: string
      Error?: string
      Option?: {
        Name?: string
        DefaultStr?: string
        Examples?: Array<{ Value?: string; Help?: string }>
      }
    }> => {
      return new Promise((resolve, reject) => {
        if (this.loginCanceled) {
          reject(new Error(`Inicio de sesión en ${providerLabel} cancelado.`))
          return
        }

        const child = spawn(bin, args, { windowsHide: true })
        this.activeAuthProcess = child

        let stdoutOutput = ''
        let stderrOutput = ''

        child.stdout.on('data', (chunk: Buffer) => {
          stdoutOutput += chunk.toString()
        })

        child.stderr.on('data', (chunk: Buffer) => {
          stderrOutput += chunk.toString()
        })

        child.on('error', (err) => {
          this.activeAuthProcess = null
          reject(err)
        })

        child.on('close', (code) => {
          this.activeAuthProcess = null
          if (this.loginCanceled) {
            reject(new Error(`Inicio de sesión en ${providerLabel} cancelado.`))
            return
          }
          if (code !== 0) {
            reject(
              new Error(
                stderrOutput.trim() ||
                  `Se canceló o no se completó el inicio de sesión con ${providerLabel}.`
              )
            )
            return
          }
          const trimmedOut = stdoutOutput.trim()
          if (!trimmedOut) {
            resolve({ State: '' })
            return
          }
          try {
            const parsed = JSON.parse(trimmedOut)
            resolve(parsed)
          } catch {
            resolve({ State: '' })
          }
        })
      })
    }

    try {
      let createArgs: string[]
      if (provider === 'gdrive') {
        createArgs = [
          'config',
          'create',
          remoteName,
          'drive',
          'scope',
          'drive',
          '--non-interactive',
          '--config',
          confPath,
        ]
      } else if (provider === 'dropbox') {
        createArgs = [
          'config',
          'create',
          remoteName,
          'dropbox',
          '--non-interactive',
          '--config',
          confPath,
        ]
      } else {
        createArgs = [
          'config',
          'create',
          remoteName,
          'onedrive',
          '--non-interactive',
          '--config',
          confPath,
        ]
      }

      let step = await runStep(createArgs)

      let guard = 0
      while (step && step.State && guard < 15) {
        guard++
        if (step.Error) {
          throw new Error(step.Error)
        }

        const optName = step.Option?.Name || ''

        if (optName === 'config_driveid' && provider === 'onedrive') {
          const driveIdState = step.State
          const candidates = await this.resolveOneDriveCandidateDrives(
            remoteName,
            step.Option?.Examples || []
          )

          let resolvedStep: typeof step | null = null
          let lastErr = ''

          for (const candidateId of candidates) {
            const tryStep = await runStep([
              'config',
              'update',
              remoteName,
              '--continue',
              '--state',
              driveIdState,
              '--result',
              candidateId,
              '--non-interactive',
              '--config',
              confPath,
            ])
            if (!tryStep.Error) {
              resolvedStep = tryStep
              break
            }
            lastErr = tryStep.Error
          }

          if (!resolvedStep) {
            throw new Error(
              lastErr || 'No se pudo obtener una unidad válida de OneDrive para esta cuenta.'
            )
          }

          step = resolvedStep
          continue
        }

        let answer = ''

        if (optName === 'config_shared_client_id') {
          answer = 'true'
        } else if (optName === 'config_is_local') {
          answer = 'true'
        } else if (optName === 'config_type') {
          answer = 'onedrive'
        } else if (optName === 'config_drive_ok') {
          answer = 'true'
        } else if (optName === 'config_change_team_drive') {
          answer = 'false'
        } else if (step.Option?.DefaultStr !== undefined && step.Option.DefaultStr !== '') {
          answer = String(step.Option.DefaultStr)
        } else if (
          Array.isArray(step.Option?.Examples) &&
          step.Option.Examples.length > 0 &&
          step.Option.Examples[0].Value !== undefined
        ) {
          answer = String(step.Option.Examples[0].Value)
        }

        step = await runStep([
          'config',
          'update',
          remoteName,
          '--continue',
          '--state',
          step.State,
          '--result',
          answer,
          '--non-interactive',
          '--config',
          confPath,
        ])
      }

      if (step?.Error) {
        throw new Error(step.Error)
      }

      if (!isProviderConfigured(provider)) {
        throw new Error(
          `No se completó la configuración de ${providerLabel}. Intenta iniciar sesión nuevamente.`
        )
      }
    } catch (err) {
      removeRemoteSectionFromConf(remoteName)
      throw err
    } finally {
      this.activeAuthProvider = null
      this.activeAuthProcess = null
    }

    const cfg = loadConfig()
    cfg.rcloneVersion = await this.getVersion()
    saveConfig(cfg)
    return cfg
  }

  public cancelLogin(): void {
    this.loginCanceled = true
    const providerToClean = this.activeAuthProvider
    if (this.activeAuthProcess) {
      try {
        this.activeAuthProcess.kill()
      } catch {
        // ignorar
      }
      this.activeAuthProcess = null
    }
    if (providerToClean) {
      const remoteName = this.getRemoteName(providerToClean)
      removeRemoteSectionFromConf(remoteName)
    }
    this.activeAuthProvider = null
  }

  public async logout(provider: CloudProvider = 'gdrive'): Promise<AppConfig> {
    if (this.activeAuthProvider === provider) {
      this.cancelLogin()
    }
    const remoteName = this.getRemoteName(provider)
    removeRemoteSectionFromConf(remoteName)
    try {
      await this.runRclone(['config', 'delete', remoteName])
    } catch {
      // ignorar
    }

    this.metadataFolderEnsured.delete(provider)
    for (const [id, meta] of this.metadatasCache.entries()) {
      if ((meta.provider || 'gdrive') === provider) {
        this.metadatasCache.delete(id)
      }
    }

    const cfg = loadConfig()
    saveConfig(cfg)
    return cfg
  }

  /**
   * Asegura que exista la carpeta dedicada _SyncSeinen_Metadata en el proveedor indicado.
   * En esta carpeta NUNCA se guardan los archivos sincronizados del usuario, solo los JSON de metadata.
   */
  public async ensureMetadataFolder(provider: CloudProvider = 'gdrive'): Promise<void> {
    if (this.metadataFolderEnsured.has(provider)) return
    const remoteName = this.getRemoteName(provider)
    await this.runRclone(['mkdir', `${remoteName}:${METADATA_FOLDER_NAME}`])
    this.metadataFolderEnsured.add(provider)
  }

  public async listDriveFolders(
    parentPath = '',
    provider: CloudProvider = 'gdrive'
  ): Promise<DriveFolderItem[]> {
    const remoteName = this.getRemoteName(provider)
    const cleanParent = parentPath.replace(/^\/+|\/+$/g, '')
    const remoteTarget = cleanParent ? `${remoteName}:${cleanParent}` : `${remoteName}:`

    const extraFlags =
      provider === 'gdrive'
        ? ['--fast-list', '--drive-pacer-min-sleep', '10ms', '--drive-pacer-burst', '200']
        : provider === 'onedrive'
          ? [
              '--exclude',
              '/Personal Vault/**',
              '--exclude',
              '/Almacén personal/**',
              '--exclude',
              '/Bóveda personal/**',
            ]
          : ['--fast-list']

    const { stdout } = await this.runRclone([
      'lsjson',
      remoteTarget,
      '--dirs-only',
      '--no-modtime',
      '--no-mimetype',
      ...extraFlags,
    ])

    const vaultNames = new Set(['Personal Vault', 'Almacén personal', 'Bóveda personal'])
    const items: Array<{ Name: string; IsDir: boolean }> = JSON.parse(stdout || '[]')
    return items
      .filter(
        (item) =>
          item.IsDir &&
          item.Name !== METADATA_FOLDER_NAME &&
          !(provider === 'onedrive' && vaultNames.has(item.Name))
      )
      .map((item) => ({
        name: item.Name,
        path: cleanParent ? `${cleanParent}/${item.Name}` : item.Name,
        parentPath: cleanParent,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  public async createDriveFolder(
    name: string,
    parentPath = '',
    provider: CloudProvider = 'gdrive'
  ): Promise<DriveFolderItem> {
    const remoteName = this.getRemoteName(provider)
    const cleanName = name.trim().replace(/^\/+|\/+$/g, '')
    const cleanParent = parentPath.replace(/^\/+|\/+$/g, '')
    const fullPath = cleanParent ? `${cleanParent}/${cleanName}` : cleanName

    await this.runRclone(['mkdir', `${remoteName}:${fullPath}`])

    return {
      name: cleanName,
      path: fullPath,
      parentPath: cleanParent,
    }
  }

  /**
   * Lee todos los archivos JSON de metadata desde la carpeta dedicada _SyncSeinen_Metadata
   * de todos los servicios conectados (Google Drive, Dropbox, OneDrive).
   */
  public async listSyncMetadatas(): Promise<SyncMetadata[]> {
    const connected = getConnectedServices()
    const activeProviders = ALL_PROVIDERS.filter((p) => connected[p])
    if (activeProviders.length === 0) return []

    const baseTempMetaDir = path.join(os.tmpdir(), 'syncseinen-metadata-cache')
    if (fs.existsSync(baseTempMetaDir)) {
      fs.rmSync(baseTempMetaDir, { recursive: true, force: true })
    }
    fs.mkdirSync(baseTempMetaDir, { recursive: true })

    const metadatas: SyncMetadata[] = []
    this.metadatasCache.clear()

    await Promise.all(
      activeProviders.map(async (provider) => {
        const providerDir = path.join(baseTempMetaDir, provider)
        fs.mkdirSync(providerDir, { recursive: true })
        const remoteName = this.getRemoteName(provider)

        try {
          await this.runRclone([
            'copy',
            `${remoteName}:${METADATA_FOLDER_NAME}`,
            providerDir,
            '--include',
            'sync-*.json',
            ...this.getSpeedFlags(provider),
          ])
          this.metadataFolderEnsured.add(provider)
        } catch {
          try {
            await this.ensureMetadataFolder(provider)
          } catch {
            // ignorar
          }
        }

        const files = fs
          .readdirSync(providerDir)
          .filter((f) => f.startsWith('sync-') && f.endsWith('.json'))

        for (const file of files) {
          try {
            const raw = fs.readFileSync(path.join(providerDir, file), 'utf-8')
            const parsed = JSON.parse(raw)
            if (parsed && parsed.id) {
              const driveFolderPath =
                parsed.driveFolderPath || parsed.driveFolderName || parsed.name
              const driveFolderName =
                parsed.driveFolderName ||
                driveFolderPath.split('/').filter(Boolean).pop() ||
                driveFolderPath

              const isGameSave = Boolean(
                parsed.isGameSave ||
                  (typeof driveFolderPath === 'string' &&
                    driveFolderPath.startsWith(`${GAME_SAVES_ROOT_FOLDER}/`))
              )

              const metaItem: SyncMetadata = {
                id: parsed.id,
                provider,
                isGameSave,
                emulatorName: parsed.emulatorName || null,
                systemName: parsed.systemName || null,
                name: parsed.name,
                driveFolderPath,
                driveFolderName,
                createdAt: parsed.createdAt || new Date().toISOString(),
                createdByDevice: parsed.createdByDevice || 'Dispositivo',
                lastPushedAt: parsed.lastPushedAt || null,
                lastPushedByDevice: parsed.lastPushedByDevice || null,
                lastPushedFileCount: parsed.lastPushedFileCount ?? 0,
                ignoredPaths: Array.isArray(parsed.ignoredPaths) ? parsed.ignoredPaths : [],
                coverImage: parsed.coverImage || null,
              }
              metadatas.push(metaItem)
              this.metadatasCache.set(metaItem.id, metaItem)
            }
          } catch (err) {
            console.error(`Error leyendo archivo de metadata ${file} (${provider}):`, err)
          }
        }
      })
    )

    metadatas.sort((a, b) => {
      const dateA = a.lastPushedAt || a.createdAt
      const dateB = b.lastPushedAt || b.createdAt
      return dateB.localeCompare(dateA)
    })

    return metadatas
  }

  public async saveSyncMetadataToDrive(meta: SyncMetadata): Promise<SyncMetadata> {
    const provider: CloudProvider = meta.provider || 'gdrive'
    const remoteName = this.getRemoteName(provider)
    const fileName = `sync-${meta.id}.json`
    const tempFile = path.join(os.tmpdir(), `${fileName}-${Date.now()}`)

    const payload: SyncMetadata = {
      ...meta,
      provider,
    }

    fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), 'utf-8')
    try {
      const extraFlags = provider === 'gdrive' ? ['--drive-pacer-min-sleep', '10ms'] : []
      await this.runRclone([
        'copyto',
        tempFile,
        `${remoteName}:${METADATA_FOLDER_NAME}/${fileName}`,
        ...extraFlags,
      ])
      this.metadataFolderEnsured.add(provider)
      this.metadatasCache.set(payload.id, payload)
    } finally {
      try {
        fs.unlinkSync(tempFile)
      } catch {
        // ignorar
      }
    }
    return payload
  }

  public async deleteSyncMetadata(syncId: string): Promise<void> {
    let meta = this.metadatasCache.get(syncId)
    if (!meta) {
      const allMetas = await this.listSyncMetadatas()
      meta = allMetas.find((m) => m.id === syncId)
    }
    const provider: CloudProvider = meta?.provider || 'gdrive'
    const remoteName = this.getRemoteName(provider)
    const fileName = `sync-${syncId}.json`
    try {
      await this.runRclone(['deletefile', `${remoteName}:${METADATA_FOLDER_NAME}/${fileName}`])
    } catch (err) {
      console.error('Error borrando metadata en la nube:', err)
    }
    this.metadatasCache.delete(syncId)
    const cfg = loadConfig()
    delete cfg.localMappings[syncId]
    saveConfig(cfg)
  }

  public listLocalFolderContents(rootPath: string, relSubPath = ''): FolderEntryItem[] {
    if (!rootPath || !fs.existsSync(rootPath)) return []
    const cleanRel = relSubPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const targetDir = cleanRel ? path.join(rootPath, ...cleanRel.split('/')) : rootPath
    if (!fs.existsSync(targetDir)) return []

    const entries = fs.readdirSync(targetDir, { withFileTypes: true })
    const items: FolderEntryItem[] = []

    for (const entry of entries) {
      const entryRelPath = cleanRel ? `${cleanRel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          relPath: entryRelPath,
          isDir: true,
        })
      } else if (entry.isFile()) {
        let size = 0
        try {
          size = fs.statSync(path.join(targetDir, entry.name)).size
        } catch {
          // ignorar
        }
        items.push({
          name: entry.name,
          relPath: entryRelPath,
          isDir: false,
          size,
        })
      }
    }

    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return items
  }

  public async listRemoteSyncFolderContents(
    driveFolderPath: string,
    relSubPath = '',
    provider: CloudProvider = 'gdrive'
  ): Promise<FolderEntryItem[]> {
    const remoteName = this.getRemoteName(provider)
    const cleanBase = driveFolderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const cleanRel = relSubPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const fullRemote = [cleanBase, cleanRel].filter(Boolean).join('/')
    const remoteTarget = fullRemote ? `${remoteName}:${fullRemote}` : `${remoteName}:`

    try {
      const extraFlags =
        provider === 'gdrive'
          ? ['--fast-list', '--drive-pacer-min-sleep', '10ms']
          : provider === 'onedrive'
            ? []
            : ['--fast-list']
      const { stdout } = await this.runRclone([
        'lsjson',
        remoteTarget,
        '--no-modtime',
        '--no-mimetype',
        ...extraFlags,
      ])
      const parsed: Array<{ Name: string; IsDir: boolean; Size?: number }> = JSON.parse(stdout || '[]')
      const items: FolderEntryItem[] = parsed
        .filter((it) => it.Name !== METADATA_FOLDER_NAME)
        .map((it) => ({
          name: it.Name,
          relPath: cleanRel ? `${cleanRel}/${it.Name}` : it.Name,
          isDir: Boolean(it.IsDir),
          size: it.Size,
        }))

      items.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return items
    } catch {
      return []
    }
  }

  private isPathIgnored(relPath: string, ignoredPaths: string[]): boolean {
    const cleanRel = relPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    for (const raw of ignoredPaths) {
      const cleanPattern = raw.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      if (!cleanPattern) continue
      if (cleanRel === cleanPattern || cleanRel.startsWith(`${cleanPattern}/`)) {
        return true
      }
    }
    return false
  }

  private countLocalFiles(
    dirPath: string,
    rootPath = dirPath,
    ignoredPaths: string[] = []
  ): number {
    if (!fs.existsSync(dirPath)) return 0
    let count = 0
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relPath = path.relative(rootPath, fullPath).split(path.sep).join('/')
      if (this.isPathIgnored(relPath, ignoredPaths)) {
        continue
      }
      if (entry.isDirectory()) {
        count += this.countLocalFiles(fullPath, rootPath, ignoredPaths)
      } else if (entry.isFile()) {
        count++
      }
    }
    return count
  }

  /**
   * Construye un archivo temporal de exclusiones para rclone (--exclude-from).
   * Como NO se pasa --delete-excluded a rclone sync:
   * - En Push: los archivos/carpetas ignorados NO se suben a la nube.
   * - En Pull: los archivos/carpetas ignorados son completamente ignorados en ambos lados y NO se borran ni sobrescriben localmente.
   */
  private createTempExcludeFile(ignoredPaths: string[]): string | null {
    const cleaned = Array.from(
      new Set(
        ignoredPaths
          .map((p) => p.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
          .filter(Boolean)
      )
    )
    if (cleaned.length === 0) return null

    const lines: string[] = []
    for (const item of cleaned) {
      if (!item.includes('/') && (item.includes('*') || item.includes('?'))) {
        lines.push(item)
      } else {
        lines.push(`/${item}`)
        lines.push(`/${item}/**`)
      }
    }

    const tempExcludePath = path.join(
      os.tmpdir(),
      `syncseinen-exclude-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`
    )
    fs.writeFileSync(tempExcludePath, lines.join('\n') + '\n', { encoding: 'utf-8' })
    return tempExcludePath
  }

  private async runRcloneSyncWithProgress(params: {
    syncId: string
    syncName: string
    provider: CloudProvider
    operation: 'push' | 'pull'
    source: string
    destination: string
    ignoredPaths?: string[]
  }): Promise<void> {
    const bin = await this.ensureRcloneBinary()
    const confPath = getRcloneConfigPath()
    const tempExcludeFile = this.createTempExcludeFile(params.ignoredPaths || [])
    const providerLabel = this.getProviderLabel(params.provider)

    const args = [
      'sync',
      params.source,
      params.destination,
      '--create-empty-src-dirs',
      ...this.getSpeedFlags(params.provider),
      ...(tempExcludeFile ? ['--exclude-from', tempExcludeFile] : []),
      '--stats',
      '300ms',
      '--stats-one-line',
      '-v',
      '--config',
      confPath,
    ]

    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(bin, args, { windowsHide: true })
        let stderrLog = ''

        const parseProgressLine = (text: string) => {
          const lines = text.split(/\r?\n/).filter(Boolean)
          for (const line of lines) {
            const percentMatch = line.match(/(\d+)%/)
            const pct = percentMatch ? parseInt(percentMatch[1], 10) : undefined
            const cleanDetail = line
              .replace(/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+(INFO|NOTICE)\s*:\s*/, '')
              .trim()

            this.emitProgress({
              syncId: params.syncId,
              syncName: params.syncName,
              operation: params.operation,
              phase:
                params.operation === 'push'
                  ? `Sincronizando archivos hacia ${providerLabel} con rclone...`
                  : `Descargando archivos desde ${providerLabel} con rclone...`,
              current: pct !== undefined ? pct : 50,
              total: 100,
              detail: cleanDetail.slice(0, 90),
            })
          }
        }

        child.stdout.on('data', (chunk: Buffer) => parseProgressLine(chunk.toString()))
        child.stderr.on('data', (chunk: Buffer) => {
          const str = chunk.toString()
          stderrLog += str
          parseProgressLine(str)
        })

        child.on('error', (err) => reject(err))
        child.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(stderrLog.trim() || `rclone sync terminó con código ${code}`))
          }
        })
      })
    } finally {
      if (tempExcludeFile) {
        try {
          fs.unlinkSync(tempExcludeFile)
        } catch {
          // ignorar
        }
      }
    }
  }

  public async updateIgnoredPaths(syncId: string, ignoredPaths: string[]): Promise<SyncMetadata> {
    const cleanPaths = Array.from(
      new Set(
        ignoredPaths
          .map((p) => p.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
          .filter(Boolean)
      )
    )

    let meta = this.metadatasCache.get(syncId)
    if (!meta) {
      const allMetas = await this.listSyncMetadatas()
      meta = allMetas.find((m) => m.id === syncId)
    }
    if (!meta) {
      throw new Error('No se encontró la metadata de esta sincronización en la nube.')
    }

    meta.ignoredPaths = cleanPaths
    await this.saveSyncMetadataToDrive(meta)

    const cfg = loadConfig()
    if (cfg.localMappings[syncId]) {
      cfg.localMappings[syncId].ignoredPaths = cleanPaths
      saveConfig(cfg)
    }

    return meta
  }

  public async updateCoverImage(syncId: string, coverImage: string | null): Promise<SyncMetadata> {
    let meta = this.metadatasCache.get(syncId)
    if (!meta) {
      const allMetas = await this.listSyncMetadatas()
      meta = allMetas.find((m) => m.id === syncId)
    }
    if (!meta) {
      throw new Error('No se encontró la metadata de esta sincronización en la nube.')
    }

    meta.coverImage = coverImage
    await this.saveSyncMetadataToDrive(meta)
    return meta
  }

  public async createSyncAndInitialPush(params: {
    provider?: CloudProvider
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
    ignoredPaths?: string[]
    coverImage?: string | null
    isGameSave?: boolean
    emulatorName?: string | null
    systemName?: string | null
  }): Promise<SyncMetadata> {
    const cfg = loadConfig()
    const syncId = crypto.randomUUID()
    const now = new Date().toISOString()
    const provider: CloudProvider = params.provider || 'gdrive'
    const cleanIgnored = Array.from(
      new Set(
        (params.ignoredPaths || [])
          .map((p) => p.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
          .filter(Boolean)
      )
    )

    const newMeta: SyncMetadata = {
      id: syncId,
      provider,
      isGameSave: Boolean(params.isGameSave),
      emulatorName: params.emulatorName || null,
      systemName: params.systemName || null,
      name: params.name.trim(),
      driveFolderPath: params.driveFolderPath,
      driveFolderName: params.driveFolderName,
      createdAt: now,
      createdByDevice: cfg.deviceName,
      lastPushedAt: null,
      lastPushedByDevice: null,
      lastPushedFileCount: 0,
      ignoredPaths: cleanIgnored,
      coverImage: params.coverImage || null,
    }

    cfg.localMappings[syncId] = {
      localPath: params.localPath,
      ignoredPaths: cleanIgnored,
    }
    saveConfig(cfg)

    this.metadatasCache.set(syncId, newMeta)
    return await this.pushSync(syncId)
  }

  /**
   * PUSH: Usa rclone sync para subir el contenido de la carpeta local a la carpeta elegida del servicio en la nube,
   * ignorando las rutas configuradas en ignoredPaths, y actualiza el JSON de metadata en _SyncSeinen_Metadata.
   */
  public async pushSync(syncId: string): Promise<SyncMetadata> {
    const cfg = loadConfig()
    const mapping = cfg.localMappings[syncId]

    if (!mapping || !mapping.localPath) {
      throw new Error('Esta sincronización no tiene una carpeta local asignada en este dispositivo.')
    }
    if (!fs.existsSync(mapping.localPath)) {
      throw new Error(`La carpeta local no existe en este dispositivo: ${mapping.localPath}`)
    }

    let meta = this.metadatasCache.get(syncId)
    if (!meta) {
      const allMetas = await this.listSyncMetadatas()
      meta = allMetas.find((m) => m.id === syncId)
    }
    if (!meta) {
      throw new Error('No se encontró la metadata de esta sincronización en la nube.')
    }

    const provider: CloudProvider = meta.provider || 'gdrive'
    const remoteName = this.getRemoteName(provider)
    const providerLabel = this.getProviderLabel(provider)

    const effectiveIgnored = Array.from(
      new Set([...(meta.ignoredPaths || []), ...(mapping.ignoredPaths || [])])
    )
    meta.ignoredPaths = effectiveIgnored

    const fileCount = this.countLocalFiles(mapping.localPath, mapping.localPath, effectiveIgnored)
    const remoteDest = meta.driveFolderPath
      ? `${remoteName}:${meta.driveFolderPath}`
      : `${remoteName}:`

    this.emitProgress({
      syncId,
      syncName: meta.name,
      operation: 'push',
      phase: `Iniciando Push acelerado con rclone hacia ${providerLabel}...`,
      current: 5,
      total: 100,
    })

    await this.runRcloneSyncWithProgress({
      syncId,
      syncName: meta.name,
      provider,
      operation: 'push',
      source: mapping.localPath,
      destination: remoteDest,
      ignoredPaths: effectiveIgnored,
    })

    const pushedAt = new Date().toISOString()
    meta.lastPushedAt = pushedAt
    meta.lastPushedByDevice = cfg.deviceName
    meta.lastPushedFileCount = fileCount

    this.emitProgress({
      syncId,
      syncName: meta.name,
      operation: 'push',
      phase: `Actualizando metadata en _SyncSeinen_Metadata (${providerLabel})...`,
      current: 95,
      total: 100,
    })

    await this.saveSyncMetadataToDrive(meta)

    cfg.localMappings[syncId] = {
      ...cfg.localMappings[syncId],
      lastPushedAt: pushedAt,
      ignoredPaths: effectiveIgnored,
    }
    saveConfig(cfg)

    return meta
  }

  /**
   * PULL: Usa rclone sync para descargar los archivos de la carpeta en la nube hacia el directorio local
   * asignado en esta computadora, ignorando las rutas en ignoredPaths para que NO se descarguen ni se borren localmente.
   */
  public async pullSync(syncId: string): Promise<SyncMetadata> {
    const cfg = loadConfig()
    const mapping = cfg.localMappings[syncId]

    if (!mapping || !mapping.localPath) {
      throw new Error('Selecciona primero un directorio local en esta computadora para descargar los archivos.')
    }

    fs.mkdirSync(mapping.localPath, { recursive: true })

    let meta = this.metadatasCache.get(syncId)
    if (!meta) {
      const allMetas = await this.listSyncMetadatas()
      meta = allMetas.find((m) => m.id === syncId)
    }
    if (!meta) {
      throw new Error('No se encontró la metadata de la sincronización en la nube.')
    }

    const provider: CloudProvider = meta.provider || 'gdrive'
    const remoteName = this.getRemoteName(provider)
    const providerLabel = this.getProviderLabel(provider)

    const effectiveIgnored = Array.from(
      new Set([...(meta.ignoredPaths || []), ...(mapping.ignoredPaths || [])])
    )

    const remoteSource = meta.driveFolderPath
      ? `${remoteName}:${meta.driveFolderPath}`
      : `${remoteName}:`

    this.emitProgress({
      syncId,
      syncName: meta.name,
      operation: 'pull',
      phase: `Iniciando Pull acelerado con rclone desde ${providerLabel}...`,
      current: 5,
      total: 100,
    })

    await this.runRcloneSyncWithProgress({
      syncId,
      syncName: meta.name,
      provider,
      operation: 'pull',
      source: remoteSource,
      destination: mapping.localPath,
      ignoredPaths: effectiveIgnored,
    })

    const pulledAt = new Date().toISOString()
    cfg.localMappings[syncId] = {
      ...cfg.localMappings[syncId],
      lastPulledAt: pulledAt,
      ignoredPaths: effectiveIgnored,
    }
    saveConfig(cfg)

    return meta
  }
}

interface ParsedLudusaviFileRule {
  pattern: string
  tags: string[]
  osList: string[]
}

interface ParsedLudusaviGame {
  name: string
  steamId: number | null
  files: ParsedLudusaviFileRule[]
  installDirs: string[]
}

interface MatchedFsItem {
  fullPath: string
  isDir: boolean
  isFile: boolean
  parentDir: string
  name: string
}

let cachedParsedManifest: ParsedLudusaviGame[] | null = null

function unquoteYamlKey(raw: string): string {
  let s = raw.trim()
  if (s.endsWith(':')) s = s.slice(0, -1).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const quote = s[0]
    s = s.slice(1, -1)
    if (quote === '"') {
      s = s.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    } else {
      s = s.replace(/''/g, "'")
    }
  }
  return s
}

async function ensureLudusaviManifestGames(): Promise<ParsedLudusaviGame[]> {
  if (cachedParsedManifest && cachedParsedManifest.length > 0) {
    return cachedParsedManifest
  }

  const cacheFile = path.join(app.getPath('userData'), 'ludusavi-manifest.yaml')
  let yamlText = ''

  let needDownload = !fs.existsSync(cacheFile)
  if (!needDownload) {
    try {
      const stat = fs.statSync(cacheFile)
      // Refrescar si tiene más de 48 horas
      if (Date.now() - stat.mtimeMs > 48 * 3600 * 1000 || stat.size < 100000) {
        needDownload = true
      }
    } catch {
      needDownload = true
    }
  }

  if (needDownload) {
    try {
      const res = await fetch(LUDUSAVI_MANIFEST_URL, {
        headers: {
          'User-Agent': 'SyncSeinen-LudusaviScanner',
        },
      })
      if (res.ok) {
        yamlText = await res.text()
        if (yamlText.length > 100000) {
          fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
          fs.writeFileSync(cacheFile, yamlText, 'utf-8')
        }
      }
    } catch {
      // Fallback al cache en disco si existe
    }
  }

  if (!yamlText && fs.existsSync(cacheFile)) {
    yamlText = fs.readFileSync(cacheFile, 'utf-8')
  }

  if (!yamlText) {
    throw new Error(
      'No se pudo descargar el manifest de Ludusavi. Verifica tu conexión a internet.'
    )
  }

  const lines = yamlText.split(/\r?\n/)
  const games: ParsedLudusaviGame[] = []
  let currentGame: ParsedLudusaviGame | null = null
  let section = ''
  let currentFile: ParsedLudusaviFileRule | null = null
  let fileSubSection = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line === '---') continue
    const indent = line.search(/\S/)
    if (indent === 0) {
      if (currentGame && currentGame.files.length > 0) games.push(currentGame)
      currentGame = { name: unquoteYamlKey(line), steamId: null, files: [], installDirs: [] }
      section = ''
      currentFile = null
    } else if (indent === 2 && currentGame) {
      const trimmed = line.trim()
      if (trimmed === 'files:') section = 'files'
      else if (trimmed === 'steam:') section = 'steam'
      else if (trimmed === 'installDir:') section = 'installDir'
      else section = 'other'
      currentFile = null
    } else if (indent === 4 && currentGame) {
      if (section === 'files') {
        const cleaned = line.trim().replace(/:\s*\{\}\s*$/, ':')
        currentFile = { pattern: unquoteYamlKey(cleaned), tags: [], osList: [] }
        currentGame.files.push(currentFile)
        fileSubSection = ''
      } else if (section === 'steam') {
        const m = line.trim().match(/^id:\s*(\d+)/)
        if (m) currentGame.steamId = Number(m[1])
      } else if (section === 'installDir') {
        const cleaned = line.trim().replace(/:\s*\{\}\s*$/, ':')
        const dirName = unquoteYamlKey(cleaned)
        if (dirName) currentGame.installDirs.push(dirName)
      }
    } else if (indent === 6 && currentFile && section === 'files') {
      const trimmed = line.trim()
      if (trimmed === 'tags:') fileSubSection = 'tags'
      else if (trimmed === 'when:') fileSubSection = 'when'
      else fileSubSection = ''
    } else if (indent >= 8 && currentFile && section === 'files') {
      const trimmed = line.trim()
      if (fileSubSection === 'tags' && trimmed.startsWith('- ')) {
        currentFile.tags.push(trimmed.slice(2).trim())
      } else if (fileSubSection === 'when') {
        const m = trimmed.match(/^(?:-\s*)?os:\s*(\S+)/)
        if (m) currentFile.osList.push(m[1])
      }
    }
  }
  if (currentGame && currentGame.files.length > 0) games.push(currentGame)

  cachedParsedManifest = games
  return games
}

function globSegmentToRegex(globSeg: string): RegExp {
  let re = '^'
  for (let i = 0; i < globSeg.length; i++) {
    const c = globSeg[i]
    if (c === '*') re += '.*'
    else if (c === '?') re += '.'
    else if ('+()^$.{}[]|\\'.includes(c)) re += '\\' + c
    else re += c
  }
  re += '$'
  return new RegExp(re, 'i')
}

function hasAnyRealFile(targetPath: string, maxDepth = 4): boolean {
  if (maxDepth < 0) return false
  try {
    const stat = fs.statSync(targetPath)
    if (stat.isFile()) return stat.size >= 0
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(targetPath, { withFileTypes: true })
      for (const e of entries) {
        if (e.isFile()) return true
        if (e.isDirectory() && hasAnyRealFile(path.join(targetPath, e.name), maxDepth - 1)) {
          return true
        }
      }
    }
  } catch {
    return false
  }
  return false
}

async function fetchSteamGridDbCoverForGame(
  gameName: string,
  steamId: number | null,
  cacheObj: Record<string, { coverUrl: string | null; thumbUrl: string | null }>
): Promise<{ coverUrl: string | null; thumbUrl: string | null }> {
  const cacheKey = steamId ? `steam:${steamId}` : `name:${gameName.toLowerCase()}`
  if (cacheObj[cacheKey] !== undefined) {
    return cacheObj[cacheKey]
  }

  const headers = {
    Authorization: `Bearer ${STEAMGRIDDB_API_KEY}`,
    Accept: 'application/json',
  }

  const pickBestGrid = (
    items: Array<{ url?: string; thumb?: string; width?: number; height?: number }>
  ): { coverUrl: string | null; thumbUrl: string | null } | null => {
    if (!Array.isArray(items) || items.length === 0) return null
    // Preferir formato horizontal (banner / card header) si existe, o el primero disponible
    const horizontal = items.find((it) => it.width && it.height && it.width > it.height)
    const chosen = horizontal || items[0]
    if (!chosen?.url && !chosen?.thumb) return null
    return {
      coverUrl: chosen.url || chosen.thumb || null,
      thumbUrl: chosen.thumb || chosen.url || null,
    }
  }

  try {
    if (steamId) {
      const r1 = await fetch(
        `https://www.steamgriddb.com/api/v2/grids/steam/${steamId}?dimensions=460x215,920x430`,
        { headers }
      )
      if (r1.ok) {
        const j1 = (await r1.json()) as { data?: Array<any> }
        const picked1 = pickBestGrid(j1.data || [])
        if (picked1) {
          cacheObj[cacheKey] = picked1
          return picked1
        }
      }

      const r2 = await fetch(`https://www.steamgriddb.com/api/v2/grids/steam/${steamId}`, {
        headers,
      })
      if (r2.ok) {
        const j2 = (await r2.json()) as { data?: Array<any> }
        const picked2 = pickBestGrid(j2.data || [])
        if (picked2) {
          cacheObj[cacheKey] = picked2
          return picked2
        }
      }
    }

    // Buscar por nombre en SteamGridDB
    const searchRes = await fetch(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameName)}`,
      { headers }
    )
    if (searchRes.ok) {
      const searchJson = (await searchRes.json()) as { data?: Array<{ id?: number }> }
      const firstGameId = searchJson.data?.[0]?.id
      if (firstGameId) {
        const gRes1 = await fetch(
          `https://www.steamgriddb.com/api/v2/grids/game/${firstGameId}?dimensions=460x215,920x430`,
          { headers }
        )
        if (gRes1.ok) {
          const gJson1 = (await gRes1.json()) as { data?: Array<any> }
          const pickedG1 = pickBestGrid(gJson1.data || [])
          if (pickedG1) {
            cacheObj[cacheKey] = pickedG1
            return pickedG1
          }
        }

        const gRes2 = await fetch(`https://www.steamgriddb.com/api/v2/grids/game/${firstGameId}`, {
          headers,
        })
        if (gRes2.ok) {
          const gJson2 = (await gRes2.json()) as { data?: Array<any> }
          const pickedG2 = pickBestGrid(gJson2.data || [])
          if (pickedG2) {
            cacheObj[cacheKey] = pickedG2
            return pickedG2
          }
        }
      }
    }
  } catch {
    // ignore network errors for individual covers
  }

  const empty = { coverUrl: null, thumbUrl: null }
  cacheObj[cacheKey] = empty
  return empty
}

const KNOWN_SWITCH_TITLES: Record<string, string> = {
  '0100000000010000': 'Super Mario Odyssey',
  '0100152000022000': 'Mario Kart 8 Deluxe',
  '01006A800016E000': 'Super Smash Bros. Ultimate',
  '010015100B514000': 'Super Mario Bros. Wonder',
  '010028600EBDA000': "Super Mario 3D World + Bowser's Fury",
  '0100FD8022DAA000': 'Super Mario Galaxy 2',
  '0100EA80032EA000': 'New Super Mario Bros. U Deluxe',
  '01009B90006DC000': 'Super Mario Maker 2',
  '01009B90006DC800': 'Super Mario Maker 2',
  '01007EF00011E000': 'The Legend of Zelda: Breath of the Wild',
  '0100F2C0115B6000': 'The Legend of Zelda: Tears of the Kingdom',
  '01008CF01BAAC000': 'The Legend of Zelda: Echoes of Wisdom',
  '01006BB00C6F0000': "The Legend of Zelda: Link's Awakening",
  '01002DA013484000': 'Metroid Dread',
  '010012F017576000': 'Metroid Prime Remastered',
  '01006F8002326000': 'Animal Crossing: New Horizons',
  '0100ABF008968000': 'Pokémon Sword',
  '01008DB008C2C000': 'Pokémon Shield',
  '0100A3D008C5C000': 'Pokémon Scarlet',
  '01008F6008C5E000': 'Pokémon Violet',
  '01001F5010DFA000': 'Pokémon Legends: Arceus',
  '010003F003A34000': "Pokémon: Let's Go, Pikachu!",
  '0100187003A36000': "Pokémon: Let's Go, Eevee!",
  '0100000011D90000': 'Pokémon Brilliant Diamond',
  '010018E011D92000': 'Pokémon Shining Pearl',
  '010086C00AF7C000': "Luigi's Mansion 3",
  '01004AD008F7B000': 'Kirby and the Forgotten Land',
  '010049900F546001': 'Super Mario 3D All-Stars',
  '0100F43008C44000': 'Fire Emblem: Three Houses',
  '0100A6301214E000': 'Fire Emblem Engage',
  '0100E95004038000': 'Xenoblade Chronicles 2',
  '010074F013262000': 'Xenoblade Chronicles 3',
  '0100FF500E34A000': 'Xenoblade Chronicles: Definitive Edition',
  '0100C2500FC20000': 'Splatoon 3',
  '01003BC0000A0000': 'Splatoon 2',
  '010057D00ECE4000': 'Paper Mario: The Origami King',
  '01006B0018BF2000': 'Paper Mario: The Thousand-Year Door',
  '01008F2005154000': 'Donkey Kong Country: Tropical Freeze',
  '0100A3900C3E2000': 'Super Mario Party',
  '01006FE013472000': 'Mario Party Superstars',
}

const KNOWN_3DS_TITLES: Record<string, string> = {
  '0004000000030700': 'Mario Kart 7',
  '0004000000030800': 'Mario Kart 7',
  '0004000000030600': 'Mario Kart 7',
  '0004000000053f00': 'Super Mario 3D Land',
  '0004000000054000': 'Super Mario 3D Land',
  '0004000000054100': 'Super Mario 3D Land',
  '000400000007af00': 'New Super Mario Bros. 2',
  '000400000007ad00': 'New Super Mario Bros. 2',
  '000400000007ae00': 'New Super Mario Bros. 2',
  '0004000000055d00': 'Pokémon X',
  '0004000000055e00': 'Pokémon Y',
  '000400000011c400': 'Pokémon Omega Ruby',
  '000400000011c500': 'Pokémon Alpha Sapphire',
  '0004000000164800': 'Pokémon Sun',
  '0004000000175e00': 'Pokémon Moon',
  '00040000001b5000': 'Pokémon Ultra Sun',
  '00040000001b5100': 'Pokémon Ultra Moon',
  '0004000000033500': 'The Legend of Zelda: Ocarina of Time 3D',
  '0004000000033600': 'The Legend of Zelda: Ocarina of Time 3D',
  '0004000000125500': "The Legend of Zelda: Majora's Mask 3D",
  '0004000000125600': "The Legend of Zelda: Majora's Mask 3D",
  '00040000000ec300': 'The Legend of Zelda: A Link Between Worlds',
  '00040000000ec400': 'The Legend of Zelda: A Link Between Worlds',
  '0004000000086300': 'Animal Crossing: New Leaf',
  '0004000000086400': 'Animal Crossing: New Leaf',
  '00040000000edf00': 'Super Smash Bros. for Nintendo 3DS',
  '00040000000ee000': 'Super Smash Bros. for Nintendo 3DS',
  '00040000000a0500': 'Fire Emblem Awakening',
  '0004000000076500': "Luigi's Mansion: Dark Moon",
}

const KNOWN_WIIU_TITLES: Record<string, string> = {
  '101c9400': 'The Legend of Zelda: Breath of the Wild',
  '101c9500': 'The Legend of Zelda: Breath of the Wild',
  '101c9300': 'The Legend of Zelda: Breath of the Wild',
  '1010ec00': 'Mario Kart 8',
  '1010ed00': 'Mario Kart 8',
  '10144f00': 'Super Smash Bros. for Wii U',
  '10145000': 'Super Smash Bros. for Wii U',
  '10145d00': 'Super Mario 3D World',
  '10101e00': 'New Super Mario Bros. U',
  '10199500': 'The Legend of Zelda: The Wind Waker HD',
  '101c4d00': 'Xenoblade Chronicles X',
  '10110e00': 'Splatoon',
  '1018dc00': 'Super Mario Maker',
}

function cleanRomOrSaveTitle(rawFileName: string): string {
  let base = rawFileName
    .replace(/\.(state\d*|state\.auto|srm|sav|dsv|sra|gci|mcd|mcr|ps2|bin|raw|nsp|xci|nsz|cci|3ds|cia|nds|gba|gbc|gb|sfc|smc|nes|iso|rvz|wbfs|cso|chd)$/i, '')
    .replace(/\.(state\d*|srm|sav|dsv|sra|gci)$/i, '')

  // Si es archivo .gci de Dolphin tipo "01-GMSE-super_mario_sunshine"
  const gciMatch = base.match(/^\d{2}-[A-Z0-9]{4}-(.+)$/i)
  if (gciMatch) {
    base = gciMatch[1].replace(/_/g, ' ')
  }

  // Quitar prefijos numéricos de ROMs (ej. "0434 - New Super Mario Bros.")
  base = base.replace(/^\d{3,4}\s*-\s*/, '')

  // Quitar etiquetas entre corchetes o paréntesis como (USA), (Europe), (En,Ja), [0100...], [v0], [!]
  base = base
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/™|®/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim()

  if (!base) return rawFileName

  // Si todo está en minúsculas (como "super mario sunshine"), capitalizar palabras
  if (base === base.toLowerCase()) {
    base = base
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  if (base.toLowerCase() === 'smw-extrawide-raw') {
    return 'Super Mario World'
  }

  return base
}

function parseParamSfoTitle(sfoPath: string): string | null {
  try {
    if (!fs.existsSync(sfoPath)) return null
    const buf = fs.readFileSync(sfoPath)
    if (buf.length < 20 || buf.toString('ascii', 0, 4) !== '\x00PSF') return null
    const keyTableStart = buf.readUInt32LE(8)
    const dataTableStart = buf.readUInt32LE(12)
    const tablesEntries = buf.readUInt32LE(16)
    for (let i = 0; i < tablesEntries; i++) {
      const entryOffset = 20 + i * 16
      if (entryOffset + 16 > buf.length) break
      const keyOffset = buf.readUInt16LE(entryOffset)
      const dataLen = buf.readUInt32LE(entryOffset + 4)
      const dataOffset = buf.readUInt32LE(entryOffset + 12)

      let keyEnd = keyTableStart + keyOffset
      while (keyEnd < buf.length && buf[keyEnd] !== 0) keyEnd++
      const key = buf.toString('utf8', keyTableStart + keyOffset, keyEnd)
      if (key === 'TITLE') {
        const rawTitle = buf
          .toString('utf8', dataTableStart + dataOffset, dataTableStart + dataOffset + dataLen)
          .replace(/\0+$/g, '')
          .replace(/\r?\n/g, ' ')
          .trim()
        if (rawTitle) return rawTitle
      }
    }
  } catch {
    // ignore
  }
  return null
}

function computeFileGroupIgnoresInFolder(
  dirPath: string,
  includedFileNames: string[]
): string[] {
  const includedLower = new Set(includedFileNames.map((n) => n.toLowerCase()))
  const ignores: string[] = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      if (!includedLower.has(e.name.toLowerCase())) {
        ignores.push(e.name)
      }
    }
  } catch {
    // ignore
  }
  return ignores
}

function scanEmulatorSavesWithEmuAtlasAndEmuVault(ctx: {
  home: string
  appData: string
  localAppData: string
  xdgData: string
  xdgConfig: string
  docCandidates: string[]
}): Array<{
  name: string
  searchTitle: string
  steamId: number | null
  localPath: string
  ignoredPaths: string[]
  source: 'ludusavi' | 'emuvault' | 'emuatlas'
  emulatorName: string | null
  systemName: string | null
}> {
  const results: Array<{
    name: string
    searchTitle: string
    steamId: number | null
    localPath: string
    ignoredPaths: string[]
    source: 'ludusavi' | 'emuvault' | 'emuatlas'
    emulatorName: string | null
    systemName: string | null
  }> = []
  const seenKeys = new Set<string>()

  const pushUnique = (item: {
    name: string
    searchTitle: string
    steamId: number | null
    localPath: string
    ignoredPaths: string[]
    source: 'ludusavi' | 'emuvault' | 'emuatlas'
    emulatorName: string | null
    systemName: string | null
  }) => {
    const normPath = path.resolve(item.localPath)
    const key = `${item.name.toLowerCase()}::${normPath.toLowerCase()}`
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    results.push({
      ...item,
      localPath: normPath,
    })
  }

  // 1. Descubrir raíces de Emulación (EmuAtlas / EmuDeck / EmuVault)
  const emulationRoots = new Set<string>()
  const savesRoots = new Set<string>()
  const romsRoots = new Set<string>()

  // Leer %APPDATA%/EmuDeck/settings.ps1 si existe
  const emuDeckSettings = path.join(ctx.appData, 'EmuDeck', 'settings.ps1')
  if (fs.existsSync(emuDeckSettings)) {
    try {
      const content = fs.readFileSync(emuDeckSettings, 'utf-8')
      const mEmu = content.match(/\$emulationPath\s*=\s*"([^"]+)"/i)
      const mSaves = content.match(/\$savesPath\s*=\s*"([^"]+)"/i)
      const mRoms = content.match(/\$romsPath\s*=\s*"([^"]+)"/i)
      if (mEmu?.[1] && fs.existsSync(mEmu[1])) emulationRoots.add(path.resolve(mEmu[1]))
      if (mSaves?.[1] && fs.existsSync(mSaves[1])) savesRoots.add(path.resolve(mSaves[1]))
      if (mRoms?.[1] && fs.existsSync(mRoms[1])) romsRoots.add(path.resolve(mRoms[1]))
    } catch {
      // ignore
    }
  }

  // Escanear letras de unidad comunes en Windows y rutas en Home para EmuAtlas / Emulation
  const driveLetters = ['C', 'D', 'E', 'F', 'G', 'H']
  for (const letter of driveLetters) {
    for (const folder of ['Emulation', 'EmuAtlas', 'Games\\Emulation', 'Games\\EmuAtlas']) {
      const candidate = `${letter}:\\${folder}`
      if (fs.existsSync(candidate)) {
        emulationRoots.add(path.resolve(candidate))
      }
    }
  }
  for (const folder of ['Emulation', 'EmuAtlas']) {
    const candidate = path.join(ctx.home, folder)
    if (fs.existsSync(candidate)) {
      emulationRoots.add(path.resolve(candidate))
    }
  }

  for (const root of emulationRoots) {
    const sDir = path.join(root, 'saves')
    const rDir = path.join(root, 'roms')
    if (fs.existsSync(sDir)) savesRoots.add(sDir)
    if (fs.existsSync(rDir)) romsRoots.add(rDir)
  }

  // 2. Construir mapas dinámicos de TitleID -> Nombre de Juego a partir de ROMs locales y configs
  const switchTitleMap = new Map<string, string>(
    Object.entries(KNOWN_SWITCH_TITLES).map(([k, v]) => [k.toUpperCase(), v])
  )
  const n3dsTitleMap = new Map<string, string>(
    Object.entries(KNOWN_3DS_TITLES).map(([k, v]) => [k.toLowerCase(), v])
  )

  const registerSwitchFileTitle = (fileOrPath: string) => {
    const base = path.basename(fileOrPath)
    const tidMatch = base.match(/\[(0100[0-9A-Fa-f]{12})\]/)
    if (tidMatch) {
      const tid = tidMatch[1].toUpperCase()
      const clean = cleanRomOrSaveTitle(base)
      if (clean && ! tid.startsWith(clean.toUpperCase())) {
        switchTitleMap.set(tid, clean)
      }
    }
  }

  for (const rRoot of romsRoots) {
    // Switch ROMs
    const swDir = path.join(rRoot, 'switch')
    if (fs.existsSync(swDir)) {
      try {
        for (const f of fs.readdirSync(swDir)) {
          registerSwitchFileTitle(f)
        }
      } catch {
        // ignore
      }
    }

    // Nintendo 3DS ROMs (.cci / .3ds NCSD header offset 0x108 -> 8-byte LE TitleID)
    for (const sub of ['n3ds', '3ds']) {
      const ds3Dir = path.join(rRoot, sub)
      if (fs.existsSync(ds3Dir)) {
        try {
          for (const f of fs.readdirSync(ds3Dir)) {
            if (!/\.(cci|3ds|cxi)$/i.test(f)) continue
            const fullRom = path.join(ds3Dir, f)
            const fd = fs.openSync(fullRom, 'r')
            try {
              const buf = Buffer.alloc(8)
              const bytesRead = fs.readSync(fd, buf, 0, 8, 0x108)
              if (bytesRead === 8) {
                const tidHex = buf.readBigUInt64LE(0).toString(16).padStart(16, '0').toLowerCase()
                if (tidHex.startsWith('00040000')) {
                  n3dsTitleMap.set(tidHex, cleanRomOrSaveTitle(f))
                }
              }
            } finally {
              fs.closeSync(fd)
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // Leer qt-config.ini de Eden / Yuzu / Suyu / Sudachi para extraer recentFiles y gamedirs de Switch
  for (const swEmu of ['eden', 'yuzu', 'suyu', 'sudachi', 'citron']) {
    const iniPath = path.join(ctx.appData, swEmu, 'config', 'qt-config.ini')
    if (fs.existsSync(iniPath)) {
      try {
        const iniText = fs.readFileSync(iniPath, 'utf-8')
        const matches = iniText.matchAll(/([^,"=\r\n]+\[(0100[0-9A-Fa-f]{12})\][^,"=\r\n]*)/g)
        for (const m of matches) {
          registerSwitchFileTitle(m[1])
        }
      } catch {
        // ignore
      }
    }
  }

  // ==========================================================================
  // 3. ESCANEAR EMULADORES DE SWITCH (Eden / Eden-NX2 / Yuzu / Suyu / Sudachi)
  // ==========================================================================
  const switchEmulators = [
    { id: 'eden', label: 'Eden' },
    { id: 'yuzu', label: 'Yuzu' },
    { id: 'suyu', label: 'Suyu' },
    { id: 'sudachi', label: 'Sudachi' },
    { id: 'citron', label: 'Citron' },
  ]

  for (const swEmu of switchEmulators) {
    const candidateSaveBases: string[] = [
      path.join(ctx.appData, swEmu.id, 'nand', 'user', 'save', '0000000000000000'),
      path.join(ctx.xdgData, swEmu.id, 'nand', 'user', 'save', '0000000000000000'),
    ]
    for (const sRoot of savesRoots) {
      candidateSaveBases.push(path.join(sRoot, swEmu.id, 'saves', '0000000000000000'))
      candidateSaveBases.push(path.join(sRoot, swEmu.id, 'nand', 'user', 'save', '0000000000000000'))
    }

    for (const baseDir of candidateSaveBases) {
      if (!fs.existsSync(baseDir)) continue
      try {
        const profiles = fs.readdirSync(baseDir, { withFileTypes: true }).filter((d) => d.isDirectory())
        for (const prof of profiles) {
          const profPath = path.join(baseDir, prof.name)
          const titleDirs = fs
            .readdirSync(profPath, { withFileTypes: true })
            .filter((d) => d.isDirectory() && /^0100[0-9A-Fa-f]{12}$/.test(d.name))

          for (const tDir of titleDirs) {
            const fullSaveDir = path.join(profPath, tDir.name)
            if (!hasAnyRealFile(fullSaveDir)) continue
            const tid = tDir.name.toUpperCase()
            // Ignorar carpeta interna de Mii de sistema si no es un juego real
            if (tid === '0100000000001009' || tid === '0100000000001000') continue
            const cleanTitle = switchTitleMap.get(tid) || `Switch Title ${tid}`
            pushUnique({
              name: `${cleanTitle} (${swEmu.label})`,
              searchTitle: cleanTitle,
              steamId: null,
              localPath: fullSaveDir,
              ignoredPaths: [],
              source: 'emuatlas',
              emulatorName: swEmu.label,
              systemName: 'Nintendo Switch',
            })
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // ==========================================================================
  // 4. ESCANEAR RYUJINX (Nintendo Switch)
  // ==========================================================================
  const ryujinxSaveBases: string[] = [
    path.join(ctx.appData, 'Ryujinx', 'bis', 'user', 'save'),
    path.join(ctx.xdgConfig, 'Ryujinx', 'bis', 'user', 'save'),
  ]
  for (const sRoot of savesRoots) {
    ryujinxSaveBases.push(path.join(sRoot, 'ryujinx', 'saves'))
    ryujinxSaveBases.push(path.join(sRoot, 'Ryujinx', 'bis', 'user', 'save'))
  }

  for (const ryuBase of ryujinxSaveBases) {
    if (!fs.existsSync(ryuBase)) continue
    try {
      const entries = fs.readdirSync(ryuBase, { withFileTypes: true }).filter((d) => d.isDirectory())
      const seenRyuTidsInBase = new Set<string>()

      for (const entry of entries) {
        const slotPath = path.join(ryuBase, entry.name)
        // Caso A: subcarpeta 0000000000000000/<profile>/<titleId>
        if (entry.name === '0000000000000000') {
          const subProfiles = fs
            .readdirSync(slotPath, { withFileTypes: true })
            .filter((d) => d.isDirectory())
          for (const sp of subProfiles) {
            const spPath = path.join(slotPath, sp.name)
            const tDirs = fs
              .readdirSync(spPath, { withFileTypes: true })
              .filter((d) => d.isDirectory() && /^0100[0-9A-Fa-f]{12}$/.test(d.name))
            for (const td of tDirs) {
              const fullSave = path.join(spPath, td.name)
              if (!hasAnyRealFile(fullSave)) continue
              const tid = td.name.toUpperCase()
              if (seenRyuTidsInBase.has(tid)) continue
              seenRyuTidsInBase.add(tid)
              const cleanTitle = switchTitleMap.get(tid) || `Switch Title ${tid}`
              pushUnique({
                name: `${cleanTitle} (Ryujinx)`,
                searchTitle: cleanTitle,
                steamId: null,
                localPath: fullSave,
                ignoredPaths: [],
                source: 'emuatlas',
                emulatorName: 'Ryujinx',
                systemName: 'Nintendo Switch',
              })
            }
          }
          continue
        }

        // Caso B: carpeta numerada 0000000000000001.. con archivo ExtraData0 (primeros 8 bytes = TitleID LE)
        const extraDataPath = path.join(slotPath, 'ExtraData0')
        if (fs.existsSync(extraDataPath)) {
          try {
            const buf = fs.readFileSync(extraDataPath)
            if (buf.length >= 8) {
              const tid = buf.readBigUInt64LE(0).toString(16).padStart(16, '0').toUpperCase()
              if (tid.startsWith('0100') && !seenRyuTidsInBase.has(tid)) {
                const subZero = path.join(slotPath, '0')
                const targetFolder =
                  fs.existsSync(subZero) && hasAnyRealFile(subZero) ? slotPath : slotPath
                if (hasAnyRealFile(targetFolder)) {
                  seenRyuTidsInBase.add(tid)
                  const cleanTitle = switchTitleMap.get(tid) || `Switch Title ${tid}`
                  pushUnique({
                    name: `${cleanTitle} (Ryujinx)`,
                    searchTitle: cleanTitle,
                    steamId: null,
                    localPath: targetFolder,
                    ignoredPaths: [],
                    source: 'emuatlas',
                    emulatorName: 'Ryujinx',
                    systemName: 'Nintendo Switch',
                  })
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // ==========================================================================
  // 5. ESCANEAR CEMU (Wii U - EmuAtlas)
  // ==========================================================================
  const cemuBases: string[] = [
    path.join(ctx.appData, 'Cemu', 'mlc01', 'usr', 'save', '00050000'),
    path.join(ctx.xdgData, 'Cemu', 'mlc01', 'usr', 'save', '00050000'),
  ]
  for (const sRoot of savesRoots) {
    cemuBases.push(path.join(sRoot, 'Cemu', 'saves', '00050000'))
    cemuBases.push(path.join(sRoot, 'cemu', 'saves', '00050000'))
  }
  for (const rRoot of romsRoots) {
    cemuBases.push(path.join(rRoot, 'wiiu', 'mlc01', 'usr', 'save', '00050000'))
  }

  const seenCemuTids = new Set<string>()
  for (const cBase of cemuBases) {
    if (!fs.existsSync(cBase)) continue
    try {
      const tDirs = fs.readdirSync(cBase, { withFileTypes: true }).filter((d) => d.isDirectory())
      for (const td of tDirs) {
        const tidLow = td.name.toLowerCase()
        if (seenCemuTids.has(tidLow)) continue
        const fullSaveDir = path.join(cBase, td.name)
        const userDir = path.join(fullSaveDir, 'user')
        if (!fs.existsSync(userDir) || !hasAnyRealFile(userDir)) continue

        let gameTitle = KNOWN_WIIU_TITLES[tidLow] || ''
        const metaXml = path.join(fullSaveDir, 'meta', 'meta.xml')
        if (fs.existsSync(metaXml)) {
          try {
            const xml = fs.readFileSync(metaXml, 'utf-8')
            const mLong = xml.match(/<longname_en[^>]*>([\s\S]*?)<\/longname_en>/i)
            const mShort = xml.match(/<shortname_en[^>]*>([\s\S]*?)<\/shortname_en>/i)
            const rawName = (mLong?.[1] || mShort?.[1] || '').replace(/\r?\n/g, ': ').replace(/\s+/g, ' ').trim()
            if (rawName) gameTitle = rawName
          } catch {
            // ignore
          }
        }
        if (!gameTitle) gameTitle = `Wii U Title ${tidLow.toUpperCase()}`
        seenCemuTids.add(tidLow)

        pushUnique({
          name: `${gameTitle} (Cemu)`,
          searchTitle: gameTitle,
          steamId: null,
          localPath: fullSaveDir,
          ignoredPaths: [],
          source: 'emuatlas',
          emulatorName: 'Cemu',
          systemName: 'Wii U',
        })
      }
    } catch {
      // ignore
    }
  }

  // ==========================================================================
  // 6. ESCANEAR AZAHAR / CITRA / LIME3DS (Nintendo 3DS - EmuAtlas)
  // ==========================================================================
  const n3dsEmus = [
    { id: 'azahar', label: 'Azahar' },
    { id: 'Citra', label: 'Citra' },
    { id: 'Lime3DS', label: 'Lime3DS' },
  ]
  for (const emu3ds of n3dsEmus) {
    const sdmcRoots: string[] = [
      path.join(ctx.appData, emu3ds.id, 'sdmc', 'Nintendo 3DS'),
      path.join(ctx.xdgData, emu3ds.id.toLowerCase(), 'sdmc', 'Nintendo 3DS'),
    ]
    for (const sRoot of savesRoots) {
      sdmcRoots.push(path.join(sRoot, emu3ds.id.toLowerCase(), 'saves', 'Nintendo 3DS'))
    }

    for (const n3dsRoot of sdmcRoots) {
      if (!fs.existsSync(n3dsRoot)) continue
      try {
        const id0Dirs = fs.readdirSync(n3dsRoot, { withFileTypes: true }).filter((d) => d.isDirectory())
        for (const id0 of id0Dirs) {
          const id0Path = path.join(n3dsRoot, id0.name)
          const id1Dirs = fs.readdirSync(id0Path, { withFileTypes: true }).filter((d) => d.isDirectory())
          for (const id1 of id1Dirs) {
            const title00040000 = path.join(id0Path, id1.name, 'title', '00040000')
            if (!fs.existsSync(title00040000)) continue
            const gameDirs = fs
              .readdirSync(title00040000, { withFileTypes: true })
              .filter((d) => d.isDirectory())
            for (const gd of gameDirs) {
              const dataDir = path.join(title00040000, gd.name, 'data', '00000001')
              const fallbackDataDir = path.join(title00040000, gd.name, 'data')
              const targetSaveDir = fs.existsSync(dataDir) ? dataDir : fallbackDataDir
              if (!fs.existsSync(targetSaveDir) || !hasAnyRealFile(targetSaveDir)) continue

              const fullTid = `00040000${gd.name.toLowerCase()}`
              const cleanTitle =
                n3dsTitleMap.get(fullTid) || `Nintendo 3DS (${gd.name.toUpperCase()})`

              pushUnique({
                name: `${cleanTitle} (${emu3ds.label})`,
                searchTitle: cleanTitle,
                steamId: null,
                localPath: targetSaveDir,
                ignoredPaths: [],
                source: 'emuatlas',
                emulatorName: emu3ds.label,
                systemName: 'Nintendo 3DS',
              })
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // ==========================================================================
  // 7. ESCANEAR DOLPHIN (GameCube & Wii - EmuVault & EmuAtlas)
  // ==========================================================================
  const dolphinGcBases: string[] = [
    path.join(ctx.appData, 'Dolphin Emulator', 'GC'),
    path.join(ctx.xdgData, 'dolphin-emu', 'GC'),
    ...ctx.docCandidates.map((d) => path.join(d, 'Dolphin Emulator', 'GC')),
  ]
  for (const sRoot of savesRoots) {
    dolphinGcBases.push(path.join(sRoot, 'dolphin', 'GC'))
  }

  for (const gcBase of dolphinGcBases) {
    if (!fs.existsSync(gcBase)) continue
    for (const region of ['USA', 'EUR', 'JAP']) {
      for (const card of ['Card A', 'Card B']) {
        const cardDir = path.join(gcBase, region, card)
        if (!fs.existsSync(cardDir)) continue
        try {
          const files = fs
            .readdirSync(cardDir)
            .filter(
              (f) =>
                f.toLowerCase().endsWith('.gci') &&
                !f.toLowerCase().includes('.sync-conflict-')
            )
          const groupedByGame = new Map<string, string[]>()
          for (const f of files) {
            const gameTitle = cleanRomOrSaveTitle(f)
            if (!groupedByGame.has(gameTitle)) groupedByGame.set(gameTitle, [])
            groupedByGame.get(gameTitle)!.push(f)
          }

          for (const [gameTitle, gciFiles] of groupedByGame.entries()) {
            const ignores = computeFileGroupIgnoresInFolder(cardDir, gciFiles)
            pushUnique({
              name: `${gameTitle} (Dolphin GC)`,
              searchTitle: gameTitle,
              steamId: null,
              localPath: cardDir,
              ignoredPaths: ignores,
              source: 'emuvault',
              emulatorName: 'Dolphin',
              systemName: 'GameCube',
            })
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // ==========================================================================
  // 8. ESCANEAR RETROARCH (Saves .srm/.sav y States - EmuVault & EmuAtlas)
  // ==========================================================================
  const retroArchDirs: Array<{ dir: string; kind: 'Save' | 'State' }> = [
    { dir: path.join(ctx.appData, 'RetroArch', 'saves'), kind: 'Save' },
    { dir: path.join(ctx.appData, 'RetroArch', 'states'), kind: 'State' },
    { dir: path.join(ctx.appData, 'EmuDeck', 'Emulators', 'RetroArch', 'saves'), kind: 'Save' },
    { dir: path.join(ctx.appData, 'EmuDeck', 'Emulators', 'RetroArch', 'states'), kind: 'State' },
    { dir: path.join(ctx.xdgConfig, 'retroarch', 'saves'), kind: 'Save' },
    { dir: path.join(ctx.xdgConfig, 'retroarch', 'states'), kind: 'State' },
  ]
  for (const sRoot of savesRoots) {
    retroArchDirs.push({ dir: path.join(sRoot, 'retroarch', 'saves'), kind: 'Save' })
    retroArchDirs.push({ dir: path.join(sRoot, 'retroarch', 'states'), kind: 'State' })
  }

  const scanFlatEmulatorSaveDir = (
    dirPath: string,
    emulatorName: string,
    systemName: string,
    source: 'emuvault' | 'emuatlas',
    validExtRegex: RegExp
  ) => {
    if (!fs.existsSync(dirPath)) return
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      const grouped = new Map<string, string[]>()

      for (const e of entries) {
        if (e.isFile() && validExtRegex.test(e.name) && !e.name.includes('.sync-conflict-')) {
          const cleanTitle = cleanRomOrSaveTitle(e.name)
          if (!grouped.has(cleanTitle)) grouped.set(cleanTitle, [])
          grouped.get(cleanTitle)!.push(e.name)
        } else if (e.isDirectory()) {
          // Algunos núcleos de RetroArch guardan en subcarpetas por núcleo (ej. states/Snes9x, saves/mGBA)
          const subDir = path.join(dirPath, e.name)
          const subEntries = fs.readdirSync(subDir, { withFileTypes: true })
          const subGrouped = new Map<string, string[]>()
          for (const se of subEntries) {
            if (se.isFile() && validExtRegex.test(se.name) && !se.name.includes('.sync-conflict-')) {
              const cleanTitle = cleanRomOrSaveTitle(se.name)
              if (!subGrouped.has(cleanTitle)) subGrouped.set(cleanTitle, [])
              subGrouped.get(cleanTitle)!.push(se.name)
            }
          }
          for (const [cleanTitle, fileList] of subGrouped.entries()) {
            const ignores = computeFileGroupIgnoresInFolder(subDir, fileList)
            pushUnique({
              name: `${cleanTitle} (${emulatorName} • ${e.name})`,
              searchTitle: cleanTitle,
              steamId: null,
              localPath: subDir,
              ignoredPaths: ignores,
              source,
              emulatorName,
              systemName: e.name,
            })
          }
        }
      }

      for (const [cleanTitle, fileList] of grouped.entries()) {
        const ignores = computeFileGroupIgnoresInFolder(dirPath, fileList)
        pushUnique({
          name: `${cleanTitle} (${emulatorName})`,
          searchTitle: cleanTitle,
          steamId: null,
          localPath: dirPath,
          ignoredPaths: ignores,
          source,
          emulatorName,
          systemName,
        })
      }
    } catch {
      // ignore
    }
  }

  for (const ra of retroArchDirs) {
    scanFlatEmulatorSaveDir(
      ra.dir,
      ra.kind === 'State' ? 'RetroArch States' : 'RetroArch',
      'RetroArch',
      'emuvault',
      /\.(srm|sav|sra|gci|bin|dsv|mcr|mcd|state\d*|state\.auto)$/i
    )
  }

  // ==========================================================================
  // 9. ESCANEAR mGBA, melonDS, Snes9x, DuckStation, PCSX2, PPSSPP, RPCS3, shadPS4
  // ==========================================================================
  // mGBA (EmuVault)
  const mgbaDirs = [
    path.join(ctx.appData, 'mGBA'),
    path.join(ctx.xdgConfig, 'mgba'),
    ...Array.from(savesRoots).map((r) => path.join(r, 'mgba')),
  ]
  for (const d of mgbaDirs) {
    scanFlatEmulatorSaveDir(d, 'mGBA', 'Game Boy Advance', 'emuvault', /\.(sav|srm|ss\d+)$/i)
  }

  // melonDS (EmuVault & EmuAtlas)
  const melonDirs = [
    path.join(ctx.appData, 'melonDS'),
    path.join(ctx.xdgConfig, 'melonDS'),
    ...Array.from(savesRoots).map((r) => path.join(r, 'melonds', 'saves')),
  ]
  for (const d of melonDirs) {
    scanFlatEmulatorSaveDir(d, 'melonDS', 'Nintendo DS', 'emuvault', /\.(sav|dsv|ml\d+)$/i)
  }

  // Snes9x (EmuVault)
  const snes9xDirs = [
    path.join(ctx.appData, 'Snes9x'),
    path.join(ctx.home, '.snes9x'),
    ...Array.from(savesRoots).map((r) => path.join(r, 'snes9x')),
  ]
  for (const d of snes9xDirs) {
    scanFlatEmulatorSaveDir(d, 'Snes9x', 'SNES', 'emuvault', /\.(srm|sav|00\d)$/i)
  }

  // DuckStation (EmuVault & EmuAtlas)
  const duckDirs = [
    path.join(ctx.appData, 'DuckStation', 'memcards'),
    path.join(ctx.xdgData, 'duckstation', 'memcards'),
    ...ctx.docCandidates.map((d) => path.join(d, 'DuckStation', 'memcards')),
    ...Array.from(savesRoots).map((r) => path.join(r, 'duckstation', 'saves')),
  ]
  for (const d of duckDirs) {
    scanFlatEmulatorSaveDir(d, 'DuckStation', 'PlayStation 1', 'emuvault', /\.(mcd|mcr)$/i)
  }

  // PCSX2 (EmuVault & EmuAtlas)
  const pcsx2Dirs = [
    path.join(ctx.appData, 'PCSX2', 'memcards'),
    path.join(ctx.xdgConfig, 'PCSX2', 'memcards'),
    ...ctx.docCandidates.map((d) => path.join(d, 'PCSX2', 'memcards')),
    ...Array.from(savesRoots).map((r) => path.join(r, 'pcsx2', 'saves')),
  ]
  for (const d of pcsx2Dirs) {
    if (!fs.existsSync(d)) continue
    try {
      const ps2Cards = fs.readdirSync(d).filter((f) => /\.ps2$/i.test(f))
      if (ps2Cards.length > 0) {
        // Si el usuario tiene ROMs de PS2 en roms/ps2, usar el primer juego representativo para la carátula o "PlayStation 2"
        let coverSearch = 'PlayStation 2'
        for (const rRoot of romsRoots) {
          const ps2RomDir = path.join(rRoot, 'ps2')
          if (fs.existsSync(ps2RomDir)) {
            const roms = fs
              .readdirSync(ps2RomDir)
              .filter((f) => /\.(iso|chd|bin|gz)$/i.test(f))
            if (roms.length > 0) {
              coverSearch = cleanRomOrSaveTitle(roms[0])
              break
            }
          }
        }
        const ignores = computeFileGroupIgnoresInFolder(d, ps2Cards)
        pushUnique({
          name: `Memory Cards PS2 (PCSX2)`,
          searchTitle: coverSearch,
          steamId: null,
          localPath: d,
          ignoredPaths: ignores,
          source: 'emuvault',
          emulatorName: 'PCSX2',
          systemName: 'PlayStation 2',
        })
      }
    } catch {
      // ignore
    }
  }

  // PPSSPP (EmuVault & EmuAtlas)
  const ppssppDirs = [
    path.join(ctx.appData, 'PPSSPP', 'PSP', 'SAVEDATA'),
    path.join(ctx.xdgConfig, 'ppsspp', 'PSP', 'SAVEDATA'),
    ...ctx.docCandidates.map((d) => path.join(d, 'PPSSPP', 'PSP', 'SAVEDATA')),
    ...Array.from(savesRoots).map((r) => path.join(r, 'ppsspp', 'saves', 'PSP', 'SAVEDATA')),
    ...Array.from(savesRoots).map((r) => path.join(r, 'ppsspp', 'saves')),
  ]
  for (const d of ppssppDirs) {
    if (!fs.existsSync(d)) continue
    try {
      const subDirs = fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory())
      for (const sd of subDirs) {
        if (sd.name === 'PSP' || sd.name === 'SAVEDATA') continue
        const fullSd = path.join(d, sd.name)
        if (!hasAnyRealFile(fullSd)) continue
        const sfoTitle = parseParamSfoTitle(path.join(fullSd, 'PARAM.SFO'))
        const cleanTitle = sfoTitle || sd.name
        pushUnique({
          name: `${cleanTitle} (PPSSPP)`,
          searchTitle: cleanTitle,
          steamId: null,
          localPath: fullSd,
          ignoredPaths: [],
          source: 'emuvault',
          emulatorName: 'PPSSPP',
          systemName: 'PSP',
        })
      }
    } catch {
      // ignore
    }
  }

  // RPCS3 (PlayStation 3 - EmuAtlas)
  const rpcs3Dirs = [
    path.join(ctx.appData, 'rpcs3', 'dev_hdd0', 'home', '00000001', 'savedata'),
    path.join(ctx.xdgConfig, 'rpcs3', 'dev_hdd0', 'home', '00000001', 'savedata'),
    ...Array.from(savesRoots).map((r) => path.join(r, 'rpcs3', 'saves')),
    ...Array.from(emulationRoots).map((r) =>
      path.join(r, 'storage', 'rpcs3', 'dev_hdd0', 'home', '00000001', 'savedata')
    ),
  ]
  for (const d of rpcs3Dirs) {
    if (!fs.existsSync(d)) continue
    try {
      const subDirs = fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory())
      for (const sd of subDirs) {
        const fullSd = path.join(d, sd.name)
        if (!hasAnyRealFile(fullSd)) continue
        const sfoTitle = parseParamSfoTitle(path.join(fullSd, 'PARAM.SFO'))
        const cleanTitle = sfoTitle || sd.name
        pushUnique({
          name: `${cleanTitle} (RPCS3)`,
          searchTitle: cleanTitle,
          steamId: null,
          localPath: fullSd,
          ignoredPaths: [],
          source: 'emuatlas',
          emulatorName: 'RPCS3',
          systemName: 'PlayStation 3',
        })
      }
    } catch {
      // ignore
    }
  }

  // EmuVault GameScanner: Buscar archivos de guardado (.sav, .srm, .dsv, .sra) junto a las ROMs en roms/<system>
  const emuVaultSystems: Record<string, string> = {
    nes: 'NES',
    snes: 'SNES',
    gb: 'Game Boy',
    gbc: 'Game Boy Color',
    gba: 'Game Boy Advance',
    nds: 'Nintendo DS',
    genesis: 'Sega Genesis',
    sms: 'Master System',
    gg: 'Game Gear',
    psx: 'PlayStation 1',
    n64: 'Nintendo 64',
    arcade: 'Arcade',
  }
  for (const rRoot of romsRoots) {
    for (const [sysKey, sysLabel] of Object.entries(emuVaultSystems)) {
      const sysDir = path.join(rRoot, sysKey)
      if (!fs.existsSync(sysDir)) continue
      scanFlatEmulatorSaveDir(
        sysDir,
        `EmuVault ${sysLabel}`,
        sysLabel,
        'emuvault',
        /\.(sav|srm|dsv|sra|eep|fla|mcr|mcd)$/i
      )
    }
  }

  return results
}

async function scanInstalledGameSavesOnPc(): Promise<DetectedGameSaveItem[]> {
  const games = await ensureLudusaviManifestGames()

  const dirCache = new Map<
    string,
    {
      realPath: string
      entries: Map<string, { name: string; isDir: boolean; isFile: boolean }>
    } | null
  >()

  const getDirEntries = (dirPath: string) => {
    const norm = path.resolve(dirPath)
    const key = norm.toLowerCase()
    if (dirCache.has(key)) return dirCache.get(key) || null
    try {
      const entries = fs.readdirSync(norm, { withFileTypes: true })
      const map = new Map<string, { name: string; isDir: boolean; isFile: boolean }>()
      for (const e of entries) {
        map.set(e.name.toLowerCase(), {
          name: e.name,
          isDir: e.isDirectory(),
          isFile: e.isFile(),
        })
      }
      const res = { realPath: norm, entries: map }
      dirCache.set(key, res)
      return res
    } catch {
      dirCache.set(key, null)
      return null
    }
  }

  const resolvePatternMatches = (patternStr: string): MatchedFsItem[] => {
    const normalized = patternStr.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
    const parts = normalized.split('/')
    if (parts.length < 2) return []

    let rootPrefix = parts[0]
    if (/^[a-zA-Z]:$/.test(rootPrefix)) {
      rootPrefix += '\\'
    } else if (rootPrefix === '') {
      rootPrefix = '/'
    }

    let currentDirs = [rootPrefix]
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i]
      const isLast = i === parts.length - 1
      if (seg === '.' || seg === '') continue

      if (seg === '**') {
        const expanded = [...currentDirs]
        for (const d of currentDirs) {
          const info1 = getDirEntries(d)
          if (!info1) continue
          for (const e1 of info1.entries.values()) {
            if (e1.isDir) {
              const p1 = path.join(info1.realPath, e1.name)
              expanded.push(p1)
              const info2 = getDirEntries(p1)
              if (info2) {
                for (const e2 of info2.entries.values()) {
                  if (e2.isDir) expanded.push(path.join(info2.realPath, e2.name))
                }
              }
            }
          }
        }
        currentDirs = expanded
        continue
      }

      const hasWildcard = seg.includes('*') || seg.includes('?')
      const nextDirs: string[] = []
      const matchedItems: MatchedFsItem[] = []

      if (!hasWildcard) {
        const segLower = seg.toLowerCase()
        for (const d of currentDirs) {
          const info = getDirEntries(d)
          if (!info) continue
          const found = info.entries.get(segLower)
          if (found) {
            const full = path.join(info.realPath, found.name)
            if (isLast) {
              matchedItems.push({
                fullPath: full,
                isDir: found.isDir,
                isFile: found.isFile,
                parentDir: info.realPath,
                name: found.name,
              })
            } else if (found.isDir) {
              nextDirs.push(full)
            }
          }
        }
      } else {
        const rx = globSegmentToRegex(seg)
        for (const d of currentDirs) {
          const info = getDirEntries(d)
          if (!info) continue
          for (const found of info.entries.values()) {
            if (rx.test(found.name)) {
              const full = path.join(info.realPath, found.name)
              if (isLast) {
                matchedItems.push({
                  fullPath: full,
                  isDir: found.isDir,
                  isFile: found.isFile,
                  parentDir: info.realPath,
                  name: found.name,
                })
              } else if (found.isDir) {
                nextDirs.push(full)
              }
            }
          }
        }
      }

      if (isLast) return matchedItems
      currentDirs = nextDirs
      if (currentDirs.length === 0) return []
    }
    return []
  }

  const computeSyncRootAndIgnores = (
    matches: MatchedFsItem[],
    forbiddenRootsSet: Set<string>
  ): { localPath: string; ignoredPaths: string[] } | null => {
    const valid = matches.filter((m) => m.isFile || (m.isDir && hasAnyRealFile(m.fullPath)))
    if (valid.length === 0) return null

    const groups = new Map<string, MatchedFsItem[]>()
    for (const m of valid) {
      const targetDir = m.isDir ? m.fullPath : m.parentDir
      const parts = path.resolve(targetDir).split(path.sep)
      const groupKey = parts.slice(0, Math.min(parts.length, 6)).join(path.sep).toLowerCase()
      if (!groups.has(groupKey)) groups.set(groupKey, [])
      groups.get(groupKey)!.push(m)
    }

    let bestGroup: MatchedFsItem[] | null = null
    for (const g of groups.values()) {
      if (!bestGroup || g.length > bestGroup.length) {
        bestGroup = g
      }
    }
    if (!bestGroup) return null

    if (bestGroup.length === 1 && bestGroup[0].isDir) {
      return {
        localPath: bestGroup[0].fullPath,
        ignoredPaths: [],
      }
    }

    const dirLists = bestGroup.map((m) =>
      path.resolve(m.isDir ? m.fullPath : m.parentDir).split(path.sep)
    )
    let commonParts = [...dirLists[0]]
    for (let i = 1; i < dirLists.length; i++) {
      const cur = dirLists[i]
      let j = 0
      while (
        j < commonParts.length &&
        j < cur.length &&
        commonParts[j].toLowerCase() === cur[j].toLowerCase()
      ) {
        j++
      }
      commonParts = commonParts.slice(0, j)
    }

    let localPath = commonParts.join(path.sep)
    if (
      bestGroup.every(
        (m) => m.isDir && path.resolve(m.fullPath).toLowerCase() === localPath.toLowerCase()
      )
    ) {
      return {
        localPath,
        ignoredPaths: [],
      }
    }

    if (forbiddenRootsSet.has(localPath.toLowerCase())) {
      const first = bestGroup[0]
      localPath = first.isDir ? first.fullPath : first.parentDir
      if (first.isDir) {
        return { localPath, ignoredPaths: [] }
      }
    }

    const ignoredPaths: string[] = []
    const normLocal = path.resolve(localPath)

    const matchedRels = bestGroup
      .map((m) => ({
        rel: path.relative(normLocal, path.resolve(m.fullPath)).split(path.sep).join('/'),
        isDir: m.isDir,
      }))
      .filter((r) => r.rel && !r.rel.startsWith('..'))

    if (matchedRels.length === 0) {
      return { localPath: normLocal, ignoredPaths: [] }
    }

    const scanDirForIgnores = (currentRel: string) => {
      const absDir = currentRel ? path.join(normLocal, ...currentRel.split('/')) : normLocal
      const info = getDirEntries(absDir)
      if (!info) return
      for (const entry of info.entries.values()) {
        const childRel = currentRel ? `${currentRel}/${entry.name}` : entry.name
        const childRelLower = childRel.toLowerCase()

        const exactMatch = matchedRels.find((m) => m.rel.toLowerCase() === childRelLower)
        if (exactMatch) continue

        const isAncestorOfMatch =
          entry.isDir && matchedRels.some((m) => m.rel.toLowerCase().startsWith(`${childRelLower}/`))
        if (isAncestorOfMatch) {
          scanDirForIgnores(childRel)
          continue
        }

        ignoredPaths.push(childRel)
      }
    }

    scanDirForIgnores('')

    return {
      localPath: normLocal,
      ignoredPaths,
    }
  }

  const home = os.homedir()
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
  const localAppDataLow = path.join(home, 'AppData', 'LocalLow')
  const winPublic = process.env.PUBLIC || 'C:\\Users\\Public'
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData'
  const winDir = process.env.WINDIR || 'C:\\Windows'
  const osUserName = os.userInfo().username
  const xdgData = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share')
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config')

  const docCandidates = [
    path.join(home, 'Documents'),
    path.join(home, 'Documentos'),
    path.join(home, 'OneDrive', 'Documents'),
    path.join(home, 'OneDrive', 'Documentos'),
  ].filter((p) => fs.existsSync(p))

  const steamRoots = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'D:\\SteamLibrary',
    'E:\\SteamLibrary',
    'F:\\SteamLibrary',
    path.join(home, '.steam', 'steam'),
    path.join(home, '.local', 'share', 'Steam'),
  ].filter((p) => fs.existsSync(p))

  for (const sr of [...steamRoots]) {
    const vdf = path.join(sr, 'steamapps', 'libraryfolders.vdf')
    if (fs.existsSync(vdf)) {
      try {
        const content = fs.readFileSync(vdf, 'utf-8')
        const matches = content.matchAll(/"path"\s+"([^"]+)"/g)
        for (const m of matches) {
          const libPath = m[1].replace(/\\\\/g, '\\')
          if (fs.existsSync(libPath) && !steamRoots.includes(libPath)) {
            steamRoots.push(libPath)
          }
        }
      } catch {
        // ignore
      }
    }
  }

  const forbiddenRootsSet = new Set(
    [
      home,
      appData,
      localAppData,
      localAppDataLow,
      winPublic,
      programData,
      winDir,
      xdgData,
      xdgConfig,
      path.join(home, 'Saved Games'),
      ...docCandidates,
      ...docCandidates.map((d) => path.join(d, 'My Games')),
      ...steamRoots,
    ].map((p) => path.resolve(p).toLowerCase())
  )

  const currentOs = process.platform === 'linux' ? 'linux' : 'windows'

  const rawDetected: Array<{
    name: string
    searchTitle: string
    steamId: number | null
    localPath: string
    ignoredPaths: string[]
    source: 'ludusavi' | 'emuvault' | 'emuatlas'
    emulatorName: string | null
    systemName: string | null
  }> = []

  for (const game of games) {
    const matchedPaths: MatchedFsItem[] = []
    for (const f of game.files) {
      if (f.osList.length > 0 && !f.osList.includes(currentOs) && !f.osList.includes('dos')) {
        continue
      }
      if (f.tags.length > 0 && !f.tags.includes('save')) {
        continue
      }

      const pat = f.pattern
      if (pat.includes('<registry>') || pat.startsWith('HKEY_')) continue

      let expandedList = [pat]
      const replaceToken = (token: string, values: string[]) => {
        if (!expandedList.some((s) => s.includes(token))) return
        const next: string[] = []
        for (const item of expandedList) {
          if (item.includes(token)) {
            for (const v of values) next.push(item.split(token).join(v))
          } else {
            next.push(item)
          }
        }
        expandedList = next
      }

      replaceToken('<home>', [home])
      replaceToken('<winAppData>', [appData])
      replaceToken('<winLocalAppData>', [localAppData])
      replaceToken('<winLocalAppDataLow>', [localAppDataLow])
      replaceToken('<winDocuments>', docCandidates)
      replaceToken('<winPublic>', [winPublic])
      replaceToken('<winProgramData>', [programData])
      replaceToken('<winDir>', [winDir])
      replaceToken('<xdgData>', [xdgData])
      replaceToken('<xdgConfig>', [xdgConfig])
      replaceToken('<osUserName>', [osUserName])
      replaceToken('<storeUserId>', ['*'])
      if (game.steamId) {
        replaceToken('<storeGameId>', [String(game.steamId)])
      }

      if (expandedList.some((s) => s.includes('<base>'))) {
        const dirNames = game.installDirs.length > 0 ? game.installDirs : [game.name]
        const bases: string[] = []
        for (const sr of steamRoots) {
          for (const dn of dirNames) {
            bases.push(path.join(sr, 'steamapps', 'common', dn))
          }
        }
        replaceToken('<base>', bases)
      }

      if (expandedList.some((s) => s.includes('<root>'))) {
        replaceToken('<root>', steamRoots)
      }

      if (expandedList.some((s) => s.includes('<'))) continue

      for (const exp of expandedList) {
        for (const m of resolvePatternMatches(exp)) {
          if (!forbiddenRootsSet.has(path.resolve(m.fullPath).toLowerCase())) {
            matchedPaths.push(m)
          }
        }
      }
    }

    if (matchedPaths.length > 0) {
      const computed = computeSyncRootAndIgnores(matchedPaths, forbiddenRootsSet)
      if (computed) {
        rawDetected.push({
          name: game.name,
          searchTitle: game.name,
          steamId: game.steamId,
          localPath: computed.localPath,
          ignoredPaths: computed.ignoredPaths,
          source: 'ludusavi',
          emulatorName: null,
          systemName: 'PC',
        })
      }
    }
  }

  // ============================================================================
  // ESCÁNER DE EMULADORES (COMPATIBILIDAD CON EMUVAULT Y EMUATLAS)
  // ============================================================================
  const emuDetected = scanEmulatorSavesWithEmuAtlasAndEmuVault({
    home,
    appData,
    localAppData,
    xdgData,
    xdgConfig,
    docCandidates,
  })
  rawDetected.push(...emuDetected)

  // Cargar caché local de carátulas de SteamGridDB
  const sgdbCachePath = path.join(app.getPath('userData'), 'steamgriddb-cache.json')
  let sgdbCache: Record<string, { coverUrl: string | null; thumbUrl: string | null }> = {}
  try {
    if (fs.existsSync(sgdbCachePath)) {
      sgdbCache = JSON.parse(fs.readFileSync(sgdbCachePath, 'utf-8')) || {}
    }
  } catch {
    sgdbCache = {}
  }

  const results: DetectedGameSaveItem[] = []
  const batchSize = 8
  for (let i = 0; i < rawDetected.length; i += batchSize) {
    const batch = rawDetected.slice(i, i + batchSize)
    const batchResolved = await Promise.all(
      batch.map(async (item) => {
        const cover = await fetchSteamGridDbCoverForGame(
          item.searchTitle || item.name,
          item.steamId,
          sgdbCache
        )
        return {
          id: `${item.name}-${item.localPath}`,
          name: item.name,
          steamId: item.steamId,
          localPath: item.localPath,
          ignoredPaths: item.ignoredPaths,
          coverUrl: cover.coverUrl,
          thumbUrl: cover.thumbUrl,
          source: item.source,
          emulatorName: item.emulatorName,
          systemName: item.systemName,
        }
      })
    )
    results.push(...batchResolved)
  }

  try {
    fs.writeFileSync(sgdbCachePath, JSON.stringify(sgdbCache, null, 2), 'utf-8')
  } catch {
    // ignore
  }

  results.sort((a, b) => a.name.localeCompare(b.name))
  return results
}

function normalizeGameMatchKey(raw: string): string {
  return (raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase()
}

function inferEmulatorFromSyncMeta(sync: SyncMetadata): string | null {
  if (sync.emulatorName) return sync.emulatorName
  const n = (sync.name || '').toLowerCase()
  if (n.includes('(wii u)') || n.includes('cemu')) return 'Cemu'
  if (n.includes('(switch)') || n.includes('eden') || n.includes('yuzu') || n.includes('ryujinx')) return 'Switch'
  if (n.includes('(3ds)') || n.includes('azahar') || n.includes('citra')) return 'Azahar'
  if (n.includes('(gamecube)') || n.includes('dolphin')) return 'Dolphin'
  if (n.includes('(ps2)') || n.includes('pcsx2')) return 'PCSX2'
  if (n.includes('(psp)') || n.includes('ppsspp')) return 'PPSSPP'
  if (n.includes('(ps3)') || n.includes('rpcs3')) return 'RPCS3'
  if (n.includes('(ps1)') || n.includes('duckstation')) return 'DuckStation'
  if (n.includes('(gba)') || n.includes('mgba')) return 'mGBA'
  if (n.includes('(nds)') || n.includes('melonds')) return 'melonDS'
  if (n.includes('(snes)') || n.includes('snes9x')) return 'Snes9x'
  if (n.includes('retroarch')) return 'RetroArch'
  return null
}

async function findAutoSavePathsForSyncs(
  syncs: SyncMetadata[]
): Promise<Record<string, AutoDetectedSaveMatch>> {
  const matches: Record<string, AutoDetectedSaveMatch> = {}
  const targetSyncs = syncs.filter((s) => Boolean(s.isGameSave))
  if (targetSyncs.length === 0) return matches

  const home = os.homedir()
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
  const localAppDataLow = path.join(home, 'AppData', 'LocalLow')
  const winPublic = process.env.PUBLIC || 'C:\\Users\\Public'
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData'
  const winDir = process.env.WINDIR || 'C:\\Windows'
  const osUserName = os.userInfo().username
  const xdgData = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share')
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config')

  const docCandidates = [
    path.join(home, 'Documents'),
    path.join(home, 'Documentos'),
    path.join(home, 'OneDrive', 'Documents'),
    path.join(home, 'OneDrive', 'Documentos'),
  ].filter((p) => fs.existsSync(p))

  const steamRoots = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'D:\\SteamLibrary',
    'E:\\SteamLibrary',
    'F:\\SteamLibrary',
    path.join(home, '.steam', 'steam'),
    path.join(home, '.local', 'share', 'Steam'),
  ].filter((p) => fs.existsSync(p))

  for (const sr of [...steamRoots]) {
    const vdf = path.join(sr, 'steamapps', 'libraryfolders.vdf')
    if (fs.existsSync(vdf)) {
      try {
        const content = fs.readFileSync(vdf, 'utf-8')
        const vdfMatches = content.matchAll(/"path"\s+"([^"]+)"/g)
        for (const m of vdfMatches) {
          const libPath = m[1].replace(/\\\\/g, '\\')
          if (fs.existsSync(libPath) && !steamRoots.includes(libPath)) {
            steamRoots.push(libPath)
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // 1. Escanear emuladores en esta PC (sin llamadas de red a SteamGridDB)
  const emuDetected = scanEmulatorSavesWithEmuAtlasAndEmuVault({
    home,
    appData,
    localAppData,
    xdgData,
    xdgConfig,
    docCandidates,
  })

  for (const sync of targetSyncs) {
    const syncKey = normalizeGameMatchKey(sync.name)
    if (!syncKey) continue
    const wantedEmu = inferEmulatorFromSyncMeta(sync)?.toLowerCase() || ''

    const candidates = emuDetected.filter((item) => {
      const k1 = normalizeGameMatchKey(item.name)
      const k2 = normalizeGameMatchKey(item.searchTitle)
      return k1 === syncKey || k2 === syncKey
    })

    if (candidates.length > 0) {
      const best =
        (wantedEmu
          ? candidates.find((c) => (c.emulatorName || '').toLowerCase().includes(wantedEmu))
          : null) || candidates[0]

      matches[sync.id] = {
        syncId: sync.id,
        localPath: best.localPath,
        ignoredPaths: best.ignoredPaths,
        emulatorName: best.emulatorName,
        systemName: best.systemName,
        matchType: 'exact-save',
      }
    }
  }

  // 2. Para los que faltan, buscar en Ludusavi Manifest filtrando solo los juegos pendientes
  const remainingForLudusavi = targetSyncs.filter((s) => !matches[s.id])
  if (remainingForLudusavi.length > 0) {
    try {
      const games = await ensureLudusaviManifestGames()
      const currentOs = process.platform === 'linux' ? 'linux' : 'windows'

      const forbiddenRootsSet = new Set(
        [
          home,
          appData,
          localAppData,
          localAppDataLow,
          winPublic,
          programData,
          winDir,
          xdgData,
          xdgConfig,
          path.join(home, 'Saved Games'),
          ...docCandidates,
          ...docCandidates.map((d) => path.join(d, 'My Games')),
          ...steamRoots,
        ].map((p) => path.resolve(p).toLowerCase())
      )

      const resolveExistingPattern = (pat: string): string | null => {
        const clean = pat
          .replace(/<home>/g, home)
          .replace(/<winAppData>/g, appData)
          .replace(/<winLocalAppData>/g, localAppData)
          .replace(/<winLocalAppDataLow>/g, localAppDataLow)
          .replace(/<winDocuments>/g, docCandidates[0] || path.join(home, 'Documents'))
          .replace(/<winPublic>/g, winPublic)
          .replace(/<winProgramData>/g, programData)
          .replace(/<winDir>/g, winDir)
          .replace(/<osUserName>/g, osUserName)
          .replace(/<xdgData>/g, xdgData)
          .replace(/<xdgConfig>/g, xdgConfig)

        if (clean.includes('<')) return null
        const noGlob = clean.split('*')[0].split('?')[0].replace(/[\\/]+$/, '')
        if (!noGlob) return null
        const resolved = path.resolve(noGlob)
        if (forbiddenRootsSet.has(resolved.toLowerCase())) return null
        if (fs.existsSync(resolved)) {
          try {
            return fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved
          } catch {
            return null
          }
        }
        return null
      }

      const resolveConcreteLudusaviPath = (pat: string): string | null => {
        if (pat.includes('*') || pat.includes('?')) return null
        const clean = pat
          .replace(/<home>/g, home)
          .replace(/<winAppData>/g, appData)
          .replace(/<winLocalAppData>/g, localAppData)
          .replace(/<winLocalAppDataLow>/g, localAppDataLow)
          .replace(/<winDocuments>/g, docCandidates[0] || path.join(home, 'Documents'))
          .replace(/<winPublic>/g, winPublic)
          .replace(/<winProgramData>/g, programData)
          .replace(/<winDir>/g, winDir)
          .replace(/<osUserName>/g, osUserName)
          .replace(/<xdgData>/g, xdgData)
          .replace(/<xdgConfig>/g, xdgConfig)

        if (clean.includes('<')) return null
        const resolved = path.resolve(clean)
        if (forbiddenRootsSet.has(resolved.toLowerCase())) return null
        const parent = path.dirname(resolved)
        if (fs.existsSync(parent)) {
          return resolved
        }
        return null
      }

      for (const sync of remainingForLudusavi) {
        const syncKey = normalizeGameMatchKey(sync.name)
        const game = games.find((g) => normalizeGameMatchKey(g.name) === syncKey)
        if (!game) continue

        // Primero verificar si el juego tiene carpeta de save existente o está instalado en Steam
        let foundExisting: string | null = null
        let concreteFallback: string | null = null

        const isGameInstalledInSteam = game.installDirs.some((dirName) =>
          steamRoots.some((sr) => fs.existsSync(path.join(sr, 'steamapps', 'common', dirName)))
        )

        for (const f of game.files) {
          if (f.osList.length > 0 && !f.osList.includes(currentOs) && !f.osList.includes('dos')) {
            continue
          }
          if (f.tags.length > 0 && !f.tags.includes('save')) continue
          if (f.pattern.includes('<registry>') || f.pattern.startsWith('HKEY_')) continue

          const existing = resolveExistingPattern(f.pattern)
          if (existing) {
            foundExisting = existing
            break
          }
          if (!concreteFallback && isGameInstalledInSteam) {
            concreteFallback = resolveConcreteLudusaviPath(f.pattern)
          }
        }

        if (foundExisting) {
          matches[sync.id] = {
            syncId: sync.id,
            localPath: foundExisting,
            matchType: 'exact-save',
          }
        } else if (concreteFallback) {
          matches[sync.id] = {
            syncId: sync.id,
            localPath: concreteFallback,
            matchType: 'ludusavi-path',
          }
        }
      }
    } catch {
      // ignore manifest lookup errors
    }
  }

  // 3. Fallback para emuladores con carpeta compartida instalada en esta PC aunque aún no exista el save del juego
  const remainingForEmuRoot = targetSyncs.filter((s) => !matches[s.id])
  if (remainingForEmuRoot.length > 0) {
    const emuSaveRoots: Array<{ keys: string[]; dirs: string[] }> = [
      {
        keys: ['retroarch'],
        dirs: [
          'D:\\Emulation\\saves\\retroarch\\saves',
          'C:\\Emulation\\saves\\retroarch\\saves',
          path.join(appData, 'RetroArch', 'saves'),
          path.join(home, 'Emulation', 'saves', 'retroarch', 'saves'),
          path.join(xdgConfig, 'retroarch', 'saves'),
        ],
      },
      {
        keys: ['dolphin', 'gamecube'],
        dirs: [
          'D:\\Emulation\\saves\\dolphin\\User\\GC\\USA\\Card A',
          'C:\\Emulation\\saves\\dolphin\\User\\GC\\USA\\Card A',
          ...docCandidates.map((d) => path.join(d, 'Dolphin Emulator', 'GC', 'USA', 'Card A')),
          path.join(appData, 'Dolphin Emulator', 'GC', 'USA', 'Card A'),
        ],
      },
      {
        keys: ['pcsx2', 'ps2'],
        dirs: [
          'D:\\Emulation\\saves\\pcsx2\\memcards',
          'C:\\Emulation\\saves\\pcsx2\\memcards',
          ...docCandidates.map((d) => path.join(d, 'PCSX2', 'memcards')),
          path.join(appData, 'PCSX2', 'memcards'),
        ],
      },
      {
        keys: ['duckstation', 'ps1'],
        dirs: [
          'D:\\Emulation\\saves\\duckstation\\memcards',
          ...docCandidates.map((d) => path.join(d, 'DuckStation', 'memcards')),
          path.join(appData, 'DuckStation', 'memcards'),
        ],
      },
      {
        keys: ['ppsspp', 'psp'],
        dirs: [
          'D:\\Emulation\\saves\\ppsspp\\PSP\\SAVEDATA',
          ...docCandidates.map((d) => path.join(d, 'PPSSPP', 'PSP', 'SAVEDATA')),
          path.join(appData, 'PPSSPP', 'PSP', 'SAVEDATA'),
        ],
      },
      {
        keys: ['mgba', 'gba'],
        dirs: [
          'D:\\Emulation\\saves\\mgba',
          path.join(appData, 'mGBA', 'saves'),
        ],
      },
      {
        keys: ['melonds', 'nds'],
        dirs: [
          'D:\\Emulation\\saves\\melonds',
          path.join(appData, 'melonDS', 'saves'),
        ],
      },
      {
        keys: ['snes9x', 'snes'],
        dirs: [
          'D:\\Emulation\\saves\\snes9x',
          ...docCandidates.map((d) => path.join(d, 'Snes9x', 'Saves')),
        ],
      },
    ]

    for (const sync of remainingForEmuRoot) {
      const emu = inferEmulatorFromSyncMeta(sync)?.toLowerCase()
      if (!emu) continue
      const entry = emuSaveRoots.find((r) => r.keys.some((k) => emu.includes(k)))
      if (!entry) continue
      const existingDir = entry.dirs.find((d) => fs.existsSync(d))
      if (existingDir) {
        matches[sync.id] = {
          syncId: sync.id,
          localPath: path.resolve(existingDir),
          emulatorName: sync.emulatorName || inferEmulatorFromSyncMeta(sync),
          systemName: sync.systemName || null,
          matchType: 'emulator-root',
        }
      }
    }
  }

  return matches
}

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
let tray: Tray | null = null
let trayMenuWin: BrowserWindow | null = null
let isQuitting = false
let rcloneService: RcloneSyncService | null = null

function resolveAppIconPath(): string {
  const publicDir = process.env.VITE_PUBLIC || path.join(__dirname, '../dist')
  const icoPath = path.join(publicDir, 'app-icon.ico')
  const pngPath = path.join(publicDir, 'app-icon.png')
  if (process.platform === 'win32' && fs.existsSync(icoPath)) {
    return icoPath
  }
  return pngPath
}

function getAppIconDataUrl(): string {
  try {
    const publicDir = process.env.VITE_PUBLIC || path.join(__dirname, '../dist')
    const pngPath = path.join(publicDir, 'app-icon.png')
    if (fs.existsSync(pngPath)) {
      const buf = fs.readFileSync(pngPath)
      return `data:image/png;base64,${buf.toString('base64')}`
    }
  } catch {
    // ignore
  }
  return ''
}

function showMainWindow() {
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }
  if (win.isMinimized()) {
    win.restore()
  }
  win.show()
  win.focus()
}

function quitAppCompletely() {
  isQuitting = true
  try {
    if (trayMenuWin && !trayMenuWin.isDestroyed()) {
      trayMenuWin.destroy()
      trayMenuWin = null
    }
  } catch {
    // ignore
  }
  try {
    if (tray) {
      tray.destroy()
      tray = null
    }
  } catch {
    // ignore
  }
  try {
    if (win && !win.isDestroyed()) {
      win.destroy()
      win = null
    }
  } catch {
    // ignore
  }
  app.quit()
  app.exit(0)
}

function handleTrayMenuAction(action: string) {
  const iconPath = resolveAppIconPath()
  if (trayMenuWin && !trayMenuWin.isDestroyed()) {
    trayMenuWin.hide()
  }

  if (action === 'open') {
    showMainWindow()
  } else if (action === 'pushAll') {
    if (win && !win.isDestroyed()) {
      win.webContents.send('tray:action', 'pushAll')
      if (Notification.isSupported()) {
        new Notification({
          title: 'SyncSeinen',
          body: 'Iniciando Push a todas tus sincronizaciones en segundo plano...',
          icon: iconPath,
        }).show()
      }
    }
  } else if (action === 'pullAll') {
    if (win && !win.isDestroyed()) {
      win.webContents.send('tray:action', 'pullAll')
      if (Notification.isSupported()) {
        new Notification({
          title: 'SyncSeinen',
          body: 'Iniciando Pull a todas tus sincronizaciones en segundo plano...',
          icon: iconPath,
        }).show()
      }
    }
  } else if (action === 'quit') {
    quitAppCompletely()
  }
}

function buildTrayMenuHtml(initialTheme: 'liquid' | 'flat-red', iconDataUrl: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<style>
  * {
    box-sizing: border-box;
    user-select: none;
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  html, body {
    width: 100%;
    height: 100%;
    background: transparent;
    overflow: hidden;
  }
  .menu-card {
    width: 100%;
    height: 100%;
    border-radius: 18px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  /* Tema Actual: Liquid Glass */
  body.theme-liquid .menu-card {
    background: linear-gradient(155deg, rgba(12, 20, 38, 0.96), rgba(7, 11, 24, 0.98));
    border: 1px solid rgba(56, 189, 248, 0.28);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.18);
    color: #f8fafc;
  }
  /* Tema Negro y Rojo Plano */
  body.theme-flat-red .menu-card {
    background: #121215;
    border: 1px solid #dc2626;
    color: #fafafa;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 8px 9px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  body.theme-flat-red .header {
    border-bottom: 1px solid #27272a;
  }
  .header img {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    object-fit: cover;
  }
  .header-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .header-sub {
    font-size: 10px;
    color: #94a3b8;
  }
  body.theme-flat-red .header-sub {
    color: #a1a1aa;
  }
  .items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 6px;
  }
  .item-btn {
    width: 100%;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.03);
    color: #e2e8f0;
    border-radius: 11px;
    padding: 8px 11px;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 9px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }
  body.theme-flat-red .item-btn {
    background: #18181c;
    border-color: #27272a;
    color: #f4f4f5;
  }
  body.theme-liquid .item-btn:hover {
    background: rgba(56, 189, 248, 0.18);
    border-color: rgba(56, 189, 248, 0.4);
    color: #ffffff;
  }
  body.theme-flat-red .item-btn:hover {
    background: #dc2626;
    border-color: #ef4444;
    color: #ffffff;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  body.theme-liquid .dot-open { background: #38bdf8; }
  body.theme-liquid .dot-push { background: #34d399; }
  body.theme-liquid .dot-pull { background: #818cf8; }
  body.theme-liquid .dot-quit { background: #fb7185; }

  body.theme-flat-red .dot-open,
  body.theme-flat-red .dot-push,
  body.theme-flat-red .dot-pull,
  body.theme-flat-red .dot-quit {
    background: #ef4444;
  }
  body.theme-flat-red .item-btn:hover .dot {
    background: #ffffff;
  }
  .sep {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 2px 4px;
  }
  body.theme-flat-red .sep {
    background: #27272a;
  }
  body.theme-liquid .item-quit:hover {
    background: rgba(244, 63, 94, 0.22);
    border-color: rgba(251, 113, 133, 0.45);
    color: #fecdd3;
  }
</style>
</head>
<body class="${initialTheme === 'flat-red' ? 'theme-flat-red' : 'theme-liquid'}">
  <div class="menu-card">
    <div class="header">
      ${iconDataUrl ? `<img src="${iconDataUrl}" alt="SyncSeinen" />` : ''}
      <div>
        <div class="header-title">SyncSeinen</div>
        <div class="header-sub">Menú rápido en segundo plano</div>
      </div>
    </div>
    <div class="items">
      <button class="item-btn" onclick="trigger('open')">
        <span class="dot dot-open"></span>
        <span>Abrir la aplicación</span>
      </button>
      <button class="item-btn" onclick="trigger('pushAll')">
        <span class="dot dot-push"></span>
        <span>Hacer push a todo</span>
      </button>
      <button class="item-btn" onclick="trigger('pullAll')">
        <span class="dot dot-pull"></span>
        <span>Hacer pull a todo</span>
      </button>
      <div class="sep"></div>
      <button class="item-btn item-quit" onclick="trigger('quit')">
        <span class="dot dot-quit"></span>
        <span>Cerrarla por completo</span>
      </button>
    </div>
  </div>
  <script>
    function trigger(action) {
      if (window.syncApi && window.syncApi.triggerTrayMenuAction) {
        window.syncApi.triggerTrayMenuAction(action);
      }
    }
    window.setTrayTheme = function(t) {
      document.body.className = t === 'flat-red' ? 'theme-flat-red' : 'theme-liquid';
    };
  </script>
</body>
</html>`
}

function ensureTrayMenuWindow(): BrowserWindow {
  if (trayMenuWin && !trayMenuWin.isDestroyed()) {
    return trayMenuWin
  }

  const cfg = loadConfig()
  const initialTheme = cfg.theme === 'flat-red' ? 'flat-red' : 'liquid'
  const iconDataUrl = getAppIconDataUrl()

  trayMenuWin = new BrowserWindow({
    width: 246,
    height: 236,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const html = buildTrayMenuHtml(initialTheme, iconDataUrl)
  trayMenuWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  trayMenuWin.on('blur', () => {
    if (trayMenuWin && !trayMenuWin.isDestroyed()) {
      trayMenuWin.hide()
    }
  })

  return trayMenuWin
}

function updateTrayMenuWindowTheme(theme: 'liquid' | 'flat-red') {
  if (trayMenuWin && !trayMenuWin.isDestroyed()) {
    trayMenuWin.webContents
      .executeJavaScript(`window.setTrayTheme && window.setTrayTheme(${JSON.stringify(theme)})`)
      .catch(() => {})
  }
}

function showCustomTrayMenu() {
  const menuWin = ensureTrayMenuWindow()
  const cfg = loadConfig()
  const currentTheme = cfg.theme === 'flat-red' ? 'flat-red' : 'liquid'
  updateTrayMenuWindowTheme(currentTheme)

  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const workArea = display.workArea
  const menuWidth = 246
  const menuHeight = 236

  let x = Math.round(cursor.x - menuWidth / 2)
  let y = Math.round(cursor.y - menuHeight - 10)

  if (x < workArea.x + 8) x = workArea.x + 8
  if (x + menuWidth > workArea.x + workArea.width - 8) {
    x = workArea.x + workArea.width - menuWidth - 8
  }
  if (y < workArea.y + 8) {
    y = Math.min(cursor.y + 10, workArea.y + workArea.height - menuHeight - 8)
  }

  menuWin.setPosition(x, y, false)
  menuWin.show()
  menuWin.focus()
}

function createTray() {
  if (tray) return

  const iconPath = resolveAppIconPath()
  const iconImg = nativeImage.createFromPath(iconPath)
  tray = new Tray(iconImg)
  tray.setToolTip('SyncSeinen')

  ensureTrayMenuWindow()

  // Al dar clic izquierdo o derecho en el icono de la bandeja del sistema, abrir el menú tematizado
  tray.on('click', () => {
    showCustomTrayMenu()
  })
  tray.on('right-click', () => {
    showCustomTrayMenu()
  })
}

function createWindow() {
  const iconPath = resolveAppIconPath()

  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 940,
    minHeight: 660,
    title: 'SyncSeinen',
    icon: iconPath,
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  // Al cerrar con la X, respetar la preferencia del usuario: quedarse en segundo plano o cerrarse por completo
  win.on('close', (event) => {
    if (!isQuitting) {
      const cfg = loadConfig()
      const behavior = cfg.closeBehavior || 'tray'
      if (behavior === 'tray') {
        event.preventDefault()
        win?.hide()
      } else {
        event.preventDefault()
        quitAppCompletely()
      }
    }
  })

  rcloneService = new RcloneSyncService((progress) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('sync:progress', progress)
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  isQuitting = true
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })
}

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  showMainWindow()
})

app.setName('SyncSeinen')
if (process.platform === 'win32') {
  app.setAppUserModelId('SyncSeinen')
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  ipcMain.on('tray-menu:action', (_e, action: string) => {
    handleTrayMenuAction(action)
  })

  ipcMain.handle('config:get', async () => {
    const cfg = loadConfig()
    cfg.appVersion = app.getVersion()
    try {
      cfg.rcloneVersion = await rcloneService!.getVersion()
    } catch {
      // ignorar
    }
    return cfg
  })

  ipcMain.handle('config:setDeviceName', async (_e, name: string) => {
    const cfg = loadConfig()
    cfg.deviceName = name.trim() || cfg.deviceName
    saveConfig(cfg)
    return cfg
  })

  ipcMain.handle(
    'config:setPreferences',
    async (
      _e,
      prefs: {
        viewMode?: 'grid' | 'list'
        theme?: 'liquid' | 'flat-red'
        closeBehavior?: 'tray' | 'quit'
      }
    ) => {
      const cfg = loadConfig()
      if (prefs.viewMode) cfg.viewMode = prefs.viewMode
      if (prefs.theme) {
        cfg.theme = prefs.theme
        updateTrayMenuWindowTheme(prefs.theme)
      }
      if (prefs.closeBehavior) cfg.closeBehavior = prefs.closeBehavior
      saveConfig(cfg)
      return cfg
    }
  )

  ipcMain.handle('update:check', async () => {
    return await checkGitHubUpdates()
  })

  ipcMain.handle(
    'update:downloadAndInstall',
    async (_e, params: { downloadUrl: string; assetName: string }) => {
      await downloadAndApplyUpdate(params.downloadUrl, params.assetName, (ev) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('update:progress', ev)
        }
      })
      return true
    }
  )

  ipcMain.handle('dialog:pickCoverImage', async () => {
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar imagen de carátula para la sincronización',
      filters: [
        {
          name: 'Imágenes',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'],
        },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]

    const img = nativeImage.createFromPath(filePath)
    if (img.isEmpty()) {
      // Fallback: leer directamente como base64 si nativeImage no reconoce algún formato como webp
      const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'jpeg'
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const rawBuf = fs.readFileSync(filePath)
      return `data:${mime};base64,${rawBuf.toString('base64')}`
    }

    const size = img.getSize()
    const maxWidth = 640
    const resized =
      size.width > maxWidth
        ? img.resize({ width: maxWidth, quality: 'good' })
        : img

    const jpegBuf = resized.toJPEG(82)
    return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
  })

  ipcMain.handle('cover:searchOnline', async (_e, query: string) => {
    const cleanQuery = (query || '').trim()
    if (!cleanQuery) return []

    const ddgHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      Referer: 'https://duckduckgo.com/',
    }

    const encoded = encodeURIComponent(cleanQuery)
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encoded}&iax=images&ia=images`, {
      headers: ddgHeaders,
    })
    if (!tokenRes.ok) {
      throw new Error(`No se pudo conectar con DuckDuckGo Images (HTTP ${tokenRes.status})`)
    }
    const tokenHtml = await tokenRes.text()
    const vqdMatch = tokenHtml.match(/vqd=['"]?([\d-]+)['"]?/)
    if (!vqdMatch || !vqdMatch[1]) {
      throw new Error('No se pudo obtener el token de búsqueda de DuckDuckGo Images.')
    }

    const vqd = vqdMatch[1]
    const apiRes = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encoded}&vqd=${vqd}&f=,,,,,&p=1`,
      { headers: ddgHeaders }
    )
    if (!apiRes.ok) {
      throw new Error(`Error al consultar resultados en DuckDuckGo Images (HTTP ${apiRes.status})`)
    }

    const data = (await apiRes.json()) as {
      results?: Array<{
        title?: string
        image?: string
        thumbnail?: string
        width?: number
        height?: number
      }>
    }

    const rawResults = Array.isArray(data.results) ? data.results : []
    return rawResults
      .filter((item) => item && (item.thumbnail || item.image))
      .slice(0, 60)
      .map((item, idx) => ({
        id: `${idx}-${item.thumbnail || item.image}`,
        title: item.title || cleanQuery,
        thumbnail: item.thumbnail || item.image || '',
        image: item.image || item.thumbnail || '',
        width: item.width || 0,
        height: item.height || 0,
      }))
  })

  const downloadImageAsDataUrl = async (params: {
    imageUrl?: string | null
    thumbnailUrl?: string | null
  }): Promise<string> => {
    const fetchImageBuffer = async (url: string): Promise<{ buf: Buffer; contentType: string }> => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 9000)
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const arrayBuf = await res.arrayBuffer()
        const buf = Buffer.from(arrayBuf)
        if (buf.length < 128) {
          throw new Error('Imagen vacía o inválida')
        }
        return {
          buf,
          contentType: res.headers.get('content-type') || 'image/jpeg',
        }
      } finally {
        clearTimeout(timer)
      }
    }

    const convertBufferToDataUrl = (buf: Buffer, contentType: string): string | null => {
      const img = nativeImage.createFromBuffer(buf)
      if (!img.isEmpty()) {
        const size = img.getSize()
        const maxWidth = 640
        const resized =
          size.width > maxWidth ? img.resize({ width: maxWidth, quality: 'good' }) : img
        const jpegBuf = resized.toJPEG(82)
        return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
      }
      if (contentType.includes('image/')) {
        const cleanMime = contentType.split(';')[0].trim()
        return `data:${cleanMime};base64,${buf.toString('base64')}`
      }
      return null
    }

    const urlsToTry = [params.imageUrl, params.thumbnailUrl].filter((u): u is string =>
      Boolean(u && u.trim())
    )

    let lastErr: unknown = null
    for (const targetUrl of urlsToTry) {
      try {
        const { buf, contentType } = await fetchImageBuffer(targetUrl)
        const dataUrl = convertBufferToDataUrl(buf, contentType)
        if (dataUrl) return dataUrl
      } catch (err) {
        lastErr = err
      }
    }

    throw new Error(
      lastErr instanceof Error
        ? `No se pudo descargar la imagen seleccionada: ${lastErr.message}`
        : 'No se pudo descargar la imagen seleccionada.'
    )
  }

  ipcMain.handle(
    'cover:downloadOnline',
    async (_e, params: { imageUrl: string; thumbnailUrl?: string }) => {
      return await downloadImageAsDataUrl(params)
    }
  )

  ipcMain.handle('games:scanSaves', async () => {
    return await scanInstalledGameSavesOnPc()
  })

  ipcMain.handle('games:findAutoSavePaths', async (_e, syncs: SyncMetadata[]) => {
    return await findAutoSavePathsForSyncs(syncs || [])
  })

  ipcMain.handle(
    'games:createSaveSync',
    async (
      _e,
      params: {
        provider: CloudProvider
        name: string
        localPath: string
        ignoredPaths?: string[]
        coverUrl?: string | null
        thumbUrl?: string | null
        emulatorName?: string | null
        systemName?: string | null
      }
    ) => {
      const provider: CloudProvider = params.provider || 'gdrive'
      const safeFolderName =
        params.name
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
          .replace(/\s+/g, ' ')
          .trim() || 'GameSave'

      const driveFolderPath = `${GAME_SAVES_ROOT_FOLDER}/${safeFolderName}`

      let coverImage: string | null = null
      if (params.coverUrl || params.thumbUrl) {
        try {
          coverImage = await downloadImageAsDataUrl({
            imageUrl: params.coverUrl,
            thumbnailUrl: params.thumbUrl,
          })
        } catch {
          coverImage = null
        }
      }

      const meta = await rcloneService!.createSyncAndInitialPush({
        provider,
        name: params.name.trim(),
        driveFolderPath,
        driveFolderName: safeFolderName,
        localPath: params.localPath,
        ignoredPaths: params.ignoredPaths || [],
        coverImage,
        isGameSave: true,
        emulatorName: params.emulatorName || null,
        systemName: params.systemName || null,
      })

      return {
        meta,
        config: loadConfig(),
      }
    }
  )

  ipcMain.handle('auth:login', async (_e, provider: CloudProvider = 'gdrive') => {
    const cfg = await rcloneService!.loginWithRclone(provider)
    return cfg
  })

  ipcMain.handle('auth:cancelLogin', async () => {
    rcloneService?.cancelLogin()
    return loadConfig()
  })

  ipcMain.handle('auth:logout', async (_e, provider: CloudProvider = 'gdrive') => {
    return await rcloneService!.logout(provider)
  })

  ipcMain.handle('dialog:pickLocalFolder', async () => {
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar carpeta en esta computadora',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('shell:openLocalPath', async (_e, folderPath: string) => {
    if (folderPath && fs.existsSync(folderPath)) {
      await shell.openPath(folderPath)
    }
  })

  ipcMain.handle(
    'drive:listFolders',
    async (_e, parentPath = '', provider: CloudProvider = 'gdrive') => {
      return await rcloneService!.listDriveFolders(parentPath, provider)
    }
  )

  ipcMain.handle(
    'drive:createFolder',
    async (_e, name: string, parentPath = '', provider: CloudProvider = 'gdrive') => {
      return await rcloneService!.createDriveFolder(name, parentPath, provider)
    }
  )

  ipcMain.handle('sync:listMetadatas', async () => {
    return await rcloneService!.listSyncMetadatas()
  })

  ipcMain.handle(
    'sync:create',
    async (
      _e,
      params: {
        provider?: CloudProvider
        name: string
        driveFolderPath: string
        driveFolderName: string
        localPath: string
        ignoredPaths?: string[]
        coverImage?: string | null
        isGameSave?: boolean
      }
    ) => {
      const meta = await rcloneService!.createSyncAndInitialPush(params)
      return {
        meta,
        config: loadConfig(),
      }
    }
  )

  ipcMain.handle(
    'sync:updateCoverImage',
    async (_e, syncId: string, coverImage: string | null) => {
      const meta = await rcloneService!.updateCoverImage(syncId, coverImage)
      return {
        meta,
        config: loadConfig(),
      }
    }
  )

  ipcMain.handle(
    'local:listFolderContents',
    async (_e, rootPath: string, relSubPath = '') => {
      return rcloneService!.listLocalFolderContents(rootPath, relSubPath)
    }
  )

  ipcMain.handle(
    'drive:listSyncFolderContents',
    async (_e, driveFolderPath: string, relSubPath = '', provider: CloudProvider = 'gdrive') => {
      return await rcloneService!.listRemoteSyncFolderContents(
        driveFolderPath,
        relSubPath,
        provider
      )
    }
  )

  ipcMain.handle(
    'sync:updateIgnoredPaths',
    async (_e, syncId: string, ignoredPaths: string[]) => {
      const meta = await rcloneService!.updateIgnoredPaths(syncId, ignoredPaths)
      return {
        meta,
        config: loadConfig(),
      }
    }
  )

  ipcMain.handle('sync:assignLocalFolder', async (_e, syncId: string, localPath: string) => {
    const cfg = loadConfig()
    cfg.localMappings[syncId] = {
      ...(cfg.localMappings[syncId] || {}),
      localPath,
    }
    saveConfig(cfg)
    return cfg
  })

  ipcMain.handle('sync:unlinkLocalFolder', async (_e, syncId: string) => {
    const cfg = loadConfig()
    delete cfg.localMappings[syncId]
    saveConfig(cfg)
    return cfg
  })

  ipcMain.handle('sync:deleteMetadata', async (_e, syncId: string) => {
    await rcloneService!.deleteSyncMetadata(syncId)
    return loadConfig()
  })

  ipcMain.handle('sync:push', async (_e, syncId: string) => {
    const meta = await rcloneService!.pushSync(syncId)
    return {
      meta,
      config: loadConfig(),
    }
  })

  ipcMain.handle('sync:pull', async (_e, syncId: string) => {
    const meta = await rcloneService!.pullSync(syncId)
    return {
      meta,
      config: loadConfig(),
    }
  })

  ipcMain.handle('sync:pushAll', async (_e, provider?: CloudProvider) => {
    const cfg = loadConfig()
    const allMetas = await rcloneService!.listSyncMetadatas()
    const targetMetas = provider
      ? allMetas.filter((m) => (m.provider || 'gdrive') === provider)
      : allMetas
    let processedCount = 0

    for (const meta of targetMetas) {
      const mapping = cfg.localMappings[meta.id]
      if (mapping && mapping.localPath && fs.existsSync(mapping.localPath)) {
        await rcloneService!.pushSync(meta.id)
        processedCount++
      }
    }

    return {
      metas: await rcloneService!.listSyncMetadatas(),
      config: loadConfig(),
      processedCount,
    }
  })

  ipcMain.handle('sync:pullAll', async (_e, provider?: CloudProvider) => {
    const cfg = loadConfig()
    const allMetas = await rcloneService!.listSyncMetadatas()
    const targetMetas = provider
      ? allMetas.filter((m) => (m.provider || 'gdrive') === provider)
      : allMetas
    let processedCount = 0

    for (const meta of targetMetas) {
      const mapping = cfg.localMappings[meta.id]
      if (mapping && mapping.localPath) {
        await rcloneService!.pullSync(meta.id)
        processedCount++
      }
    }

    return {
      metas: await rcloneService!.listSyncMetadatas(),
      config: loadConfig(),
      processedCount,
    }
  })
})
