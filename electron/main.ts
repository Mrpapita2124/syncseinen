import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } from 'electron'
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
let rcloneService: RcloneSyncService | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 940,
    minHeight: 660,
    title: 'SyncSeinen — Sincronización Multi-Dispositivo con Google Drive (Rclone)',
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()

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
    async (_e, prefs: { viewMode?: 'grid' | 'list' }) => {
      const cfg = loadConfig()
      if (prefs.viewMode) cfg.viewMode = prefs.viewMode
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
