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
const GITHUB_REPO = 'Mrpapita2124/syncseinen'

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

function hasRcloneRemoteConfigured(): boolean {
  const confPath = getRcloneConfigPath()
  if (!fs.existsSync(confPath)) return false
  try {
    const content = fs.readFileSync(confPath, 'utf-8')
    return content.includes(`[${REMOTE_NAME}]`) && content.includes('token')
  } catch {
    return false
  }
}

function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  const defaultConfig: AppConfig = {
    deviceName:
      os.hostname() || (process.platform === 'linux' ? 'Dispositivo-Linux' : 'Dispositivo-Windows'),
    isConnected: hasRcloneRemoteConfigured(),
    localMappings: {},
  }
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw)
      return {
        ...defaultConfig,
        ...parsed,
        isConnected: hasRcloneRemoteConfigured(),
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
  private metadataFolderEnsured = false
  private metadatasCache: Map<string, SyncMetadata> = new Map()
  private onProgressCallback?: (event: SyncProgressEvent) => void

  constructor(onProgress?: (event: SyncProgressEvent) => void) {
    this.onProgressCallback = onProgress
  }

  /**
   * Flags de aceleración para que rclone opere a máxima velocidad con Google Drive:
   * - Mayor paralelismo en transferencias y verificadores
   * - Bloques de subida de 64MB (en vez de 8MB por defecto)
   * - Pacer optimizado para ráfagas rápidas de archivos pequeños
   */
  private getSpeedFlags(): string[] {
    return [
      '--fast-list',
      '--transfers',
      '16',
      '--checkers',
      '32',
      '--drive-chunk-size',
      '64M',
      '--drive-pacer-min-sleep',
      '10ms',
      '--drive-pacer-burst',
      '200',
      '--buffer-size',
      '32M',
    ]
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

  /**
   * Inicia sesión con Google Drive mediante rclone sin necesidad de Google Cloud Console ni API Keys propias.
   * rclone abre el navegador automáticamente con su cliente OAuth integrado.
   */
  public async loginWithRclone(): Promise<AppConfig> {
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

    // Eliminar configuración previa si estaba incompleta
    try {
      await this.runRclone(['config', 'delete', REMOTE_NAME])
    } catch {
      // ignorar
    }

    await new Promise<void>((resolve, reject) => {
      const args = [
        'config',
        'create',
        REMOTE_NAME,
        'drive',
        'scope',
        'drive',
        'config_is_local',
        'true',
        '--config',
        confPath,
      ]

      const child = spawn(bin, args, { windowsHide: true })
      this.activeAuthProcess = child

      let stderrOutput = ''

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stderrOutput += text
        // Si rclone imprime un enlace http://127.0.0.1:53682/auth y no pudo abrir el navegador en algún entorno Linux, lo abrimos
        const match = text.match(/http:\/\/127\.0\.0\.1:\d+\/auth\S*/)
        if (match && match[0]) {
          shell.openExternal(match[0]).catch(() => {})
        }
      })

      child.on('error', (err) => {
        this.activeAuthProcess = null
        reject(err)
      })

      child.on('close', (code) => {
        this.activeAuthProcess = null
        if (code === 0 && hasRcloneRemoteConfigured()) {
          resolve()
        } else {
          reject(
            new Error(
              stderrOutput.trim() ||
                'Se canceló o no se completó el inicio de sesión con Google Drive en el navegador.'
            )
          )
        }
      })
    })

    const cfg = loadConfig()
    cfg.isConnected = true
    cfg.rcloneVersion = await this.getVersion()
    saveConfig(cfg)
    return cfg
  }

  public cancelLogin(): void {
    if (this.activeAuthProcess) {
      try {
        this.activeAuthProcess.kill()
      } catch {
        // ignorar
      }
      this.activeAuthProcess = null
    }
  }

  public async logout(): Promise<AppConfig> {
    this.cancelLogin()
    try {
      await this.runRclone(['config', 'delete', REMOTE_NAME])
    } catch {
      // ignorar
    }
    const confPath = getRcloneConfigPath()
    if (fs.existsSync(confPath)) {
      try {
        fs.unlinkSync(confPath)
      } catch {
        // ignorar
      }
    }
    this.metadataFolderEnsured = false
    this.metadatasCache.clear()
    const cfg = loadConfig()
    cfg.isConnected = false
    saveConfig(cfg)
    return cfg
  }

  /**
   * Asegura que exista la carpeta dedicada _SyncSeinen_Metadata en Google Drive.
   * En esta carpeta NUNCA se guardan los archivos sincronizados del usuario, solo los JSON de metadata.
   */
  public async ensureMetadataFolder(): Promise<void> {
    if (this.metadataFolderEnsured) return
    await this.runRclone(['mkdir', `${REMOTE_NAME}:${METADATA_FOLDER_NAME}`])
    this.metadataFolderEnsured = true
  }

  public async listDriveFolders(parentPath = ''): Promise<DriveFolderItem[]> {
    const cleanParent = parentPath.replace(/^\/+|\/+$/g, '')
    const remoteTarget = cleanParent ? `${REMOTE_NAME}:${cleanParent}` : `${REMOTE_NAME}:`

    const { stdout } = await this.runRclone([
      'lsjson',
      remoteTarget,
      '--dirs-only',
      '--no-modtime',
      '--no-mimetype',
      '--fast-list',
      '--drive-pacer-min-sleep',
      '10ms',
      '--drive-pacer-burst',
      '200',
    ])

    const items: Array<{ Name: string; IsDir: boolean }> = JSON.parse(stdout || '[]')
    return items
      .filter((item) => item.IsDir && item.Name !== METADATA_FOLDER_NAME)
      .map((item) => ({
        name: item.Name,
        path: cleanParent ? `${cleanParent}/${item.Name}` : item.Name,
        parentPath: cleanParent,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  public async createDriveFolder(name: string, parentPath = ''): Promise<DriveFolderItem> {
    const cleanName = name.trim().replace(/^\/+|\/+$/g, '')
    const cleanParent = parentPath.replace(/^\/+|\/+$/g, '')
    const fullPath = cleanParent ? `${cleanParent}/${cleanName}` : cleanName

    await this.runRclone(['mkdir', `${REMOTE_NAME}:${fullPath}`])

    return {
      name: cleanName,
      path: fullPath,
      parentPath: cleanParent,
    }
  }

  /**
   * Lee todos los archivos JSON de metadata desde la carpeta dedicada _SyncSeinen_Metadata en Google Drive.
   */
  public async listSyncMetadatas(): Promise<SyncMetadata[]> {
    if (!hasRcloneRemoteConfigured()) return []

    const tempMetaDir = path.join(os.tmpdir(), 'syncseinen-metadata-cache')
    if (fs.existsSync(tempMetaDir)) {
      fs.rmSync(tempMetaDir, { recursive: true, force: true })
    }
    fs.mkdirSync(tempMetaDir, { recursive: true })

    try {
      await this.runRclone([
        'copy',
        `${REMOTE_NAME}:${METADATA_FOLDER_NAME}`,
        tempMetaDir,
        '--include',
        'sync-*.json',
        ...this.getSpeedFlags(),
      ])
      this.metadataFolderEnsured = true
    } catch {
      // Si la carpeta aún no existe en una cuenta nueva, la creamos
      await this.ensureMetadataFolder()
    }

    const files = fs.readdirSync(tempMetaDir).filter((f) => f.startsWith('sync-') && f.endsWith('.json'))
    const metadatas: SyncMetadata[] = []
    this.metadatasCache.clear()

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(tempMetaDir, file), 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed && parsed.id) {
          const driveFolderPath = parsed.driveFolderPath || parsed.driveFolderName || parsed.name
          const driveFolderName =
            parsed.driveFolderName || driveFolderPath.split('/').filter(Boolean).pop() || driveFolderPath

          const metaItem: SyncMetadata = {
            id: parsed.id,
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
        console.error(`Error leyendo archivo de metadata ${file}:`, err)
      }
    }

    metadatas.sort((a, b) => {
      const dateA = a.lastPushedAt || a.createdAt
      const dateB = b.lastPushedAt || b.createdAt
      return dateB.localeCompare(dateA)
    })

    return metadatas
  }

  public async saveSyncMetadataToDrive(meta: SyncMetadata): Promise<SyncMetadata> {
    const fileName = `sync-${meta.id}.json`
    const tempFile = path.join(os.tmpdir(), `${fileName}-${Date.now()}`)

    fs.writeFileSync(tempFile, JSON.stringify(meta, null, 2), 'utf-8')
    try {
      await this.runRclone([
        'copyto',
        tempFile,
        `${REMOTE_NAME}:${METADATA_FOLDER_NAME}/${fileName}`,
        '--drive-pacer-min-sleep',
        '10ms',
      ])
      this.metadataFolderEnsured = true
      this.metadatasCache.set(meta.id, meta)
    } finally {
      try {
        fs.unlinkSync(tempFile)
      } catch {
        // ignorar
      }
    }
    return meta
  }

  public async deleteSyncMetadata(syncId: string): Promise<void> {
    const fileName = `sync-${syncId}.json`
    try {
      await this.runRclone(['deletefile', `${REMOTE_NAME}:${METADATA_FOLDER_NAME}/${fileName}`])
    } catch (err) {
      console.error('Error borrando metadata en Drive:', err)
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
    relSubPath = ''
  ): Promise<FolderEntryItem[]> {
    const cleanBase = driveFolderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const cleanRel = relSubPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const fullRemote = [cleanBase, cleanRel].filter(Boolean).join('/')
    const remoteTarget = fullRemote ? `${REMOTE_NAME}:${fullRemote}` : `${REMOTE_NAME}:`

    try {
      const { stdout } = await this.runRclone([
        'lsjson',
        remoteTarget,
        '--no-modtime',
        '--no-mimetype',
        '--fast-list',
        '--drive-pacer-min-sleep',
        '10ms',
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
   * - En Push: los archivos/carpetas ignorados NO se suben a Google Drive.
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
    operation: 'push' | 'pull'
    source: string
    destination: string
    ignoredPaths?: string[]
  }): Promise<void> {
    const bin = await this.ensureRcloneBinary()
    const confPath = getRcloneConfigPath()
    const tempExcludeFile = this.createTempExcludeFile(params.ignoredPaths || [])

    const args = [
      'sync',
      params.source,
      params.destination,
      '--create-empty-src-dirs',
      ...this.getSpeedFlags(),
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
                  ? 'Sincronizando archivos hacia Google Drive con rclone...'
                  : 'Descargando archivos desde Google Drive con rclone...',
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
      throw new Error('No se encontró la metadata de esta sincronización en Google Drive.')
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
      throw new Error('No se encontró la metadata de esta sincronización en Google Drive.')
    }

    meta.coverImage = coverImage
    await this.saveSyncMetadataToDrive(meta)
    return meta
  }

  public async createSyncAndInitialPush(params: {
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
    ignoredPaths?: string[]
    coverImage?: string | null
  }): Promise<SyncMetadata> {
    const cfg = loadConfig()
    const syncId = crypto.randomUUID()
    const now = new Date().toISOString()
    const cleanIgnored = Array.from(
      new Set(
        (params.ignoredPaths || [])
          .map((p) => p.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
          .filter(Boolean)
      )
    )

    const newMeta: SyncMetadata = {
      id: syncId,
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
   * PUSH: Usa rclone sync para subir el contenido de la carpeta local a la carpeta elegida de Google Drive,
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
      throw new Error('No se encontró la metadata de esta sincronización en Google Drive.')
    }

    const effectiveIgnored = Array.from(
      new Set([...(meta.ignoredPaths || []), ...(mapping.ignoredPaths || [])])
    )
    meta.ignoredPaths = effectiveIgnored

    const fileCount = this.countLocalFiles(mapping.localPath, mapping.localPath, effectiveIgnored)
    const remoteDest = meta.driveFolderPath
      ? `${REMOTE_NAME}:${meta.driveFolderPath}`
      : `${REMOTE_NAME}:`

    this.emitProgress({
      syncId,
      syncName: meta.name,
      operation: 'push',
      phase: 'Iniciando Push acelerado con rclone hacia Google Drive...',
      current: 5,
      total: 100,
    })

    await this.runRcloneSyncWithProgress({
      syncId,
      syncName: meta.name,
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
      phase: 'Actualizando metadata en _SyncSeinen_Metadata...',
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
   * PULL: Usa rclone sync para descargar los archivos de la carpeta de Google Drive hacia el directorio local
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
      throw new Error('No se encontró la metadata de la sincronización en Google Drive.')
    }

    const effectiveIgnored = Array.from(
      new Set([...(meta.ignoredPaths || []), ...(mapping.ignoredPaths || [])])
    )

    const remoteSource = meta.driveFolderPath
      ? `${REMOTE_NAME}:${meta.driveFolderPath}`
      : `${REMOTE_NAME}:`

    this.emitProgress({
      syncId,
      syncName: meta.name,
      operation: 'pull',
      phase: 'Iniciando Pull acelerado con rclone desde Google Drive...',
      current: 5,
      total: 100,
    })

    await this.runRcloneSyncWithProgress({
      syncId,
      syncName: meta.name,
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

  ipcMain.handle(
    'cover:downloadOnline',
    async (_e, params: { imageUrl: string; thumbnailUrl?: string }) => {
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

      // Intentar primero con la imagen completa; si falla o bloquea hotlinking, usar el thumbnail de DuckDuckGo/Bing
      const urlsToTry = [params.imageUrl, params.thumbnailUrl].filter(
        (u): u is string => Boolean(u && u.trim())
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
  )

  ipcMain.handle('auth:login', async () => {
    const cfg = await rcloneService!.loginWithRclone()
    return cfg
  })

  ipcMain.handle('auth:cancelLogin', async () => {
    rcloneService?.cancelLogin()
    return loadConfig()
  })

  ipcMain.handle('auth:logout', async () => {
    return await rcloneService!.logout()
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

  ipcMain.handle('drive:listFolders', async (_e, parentPath = '') => {
    return await rcloneService!.listDriveFolders(parentPath)
  })

  ipcMain.handle('drive:createFolder', async (_e, name: string, parentPath = '') => {
    return await rcloneService!.createDriveFolder(name, parentPath)
  })

  ipcMain.handle('sync:listMetadatas', async () => {
    return await rcloneService!.listSyncMetadatas()
  })

  ipcMain.handle(
    'sync:create',
    async (
      _e,
      params: {
        name: string
        driveFolderPath: string
        driveFolderName: string
        localPath: string
        ignoredPaths?: string[]
        coverImage?: string | null
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
    async (_e, driveFolderPath: string, relSubPath = '') => {
      return await rcloneService!.listRemoteSyncFolderContents(driveFolderPath, relSubPath)
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

  ipcMain.handle('sync:pushAll', async () => {
    const cfg = loadConfig()
    const allMetas = await rcloneService!.listSyncMetadatas()
    let processedCount = 0

    for (const meta of allMetas) {
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

  ipcMain.handle('sync:pullAll', async () => {
    const cfg = loadConfig()
    const allMetas = await rcloneService!.listSyncMetadatas()
    let processedCount = 0

    for (const meta of allMetas) {
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
