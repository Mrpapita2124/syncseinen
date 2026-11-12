# 🔄 SyncSeinen

**SyncSeinen** es una aplicación de escritorio multiplataforma (**Windows** y **Linux**) con interfaz **Liquid Glass** (Modo Oscuro) diseñada para sincronizar carpetas de forma sencilla, rápida y controlada entre múltiples dispositivos utilizando **Google Drive** y el motor **rclone** integrado.

---

## ✨ Características Principales

- 💎 **Interfaz Liquid Glass (Modo Oscuro):** Diseño translúcido con efectos de refracción, bordes especulares y visualización conmutable entre **Cuadrícula de Cartas (`Cartas`)** y **Lista en Filas (`Filas`)**.
- 🖼️ **Carátulas Sincronizadas en la Metadata:** Puedes asignarle una imagen de portada (carátula) a cada sincronización. La imagen se optimiza e incrusta directamente dentro de `_SyncSeinen_Metadata`, por lo que **todos tus dispositivos verán la misma carátula automáticamente**.
- 🙈 **Exclusión Selectiva de Archivos y Carpetas (Ignorar en Push y Pull):**
  - Explorador visual integrado para seleccionar qué archivos o subcarpetas no deseas sincronizar.
  - Los elementos marcados como ignorados no se suben durante el **Push** ni se sobrescriben o eliminan durante el **Pull** (su existencia local se respeta intacta).
- 🔔 **Actualizaciones Automáticas en Segundo Plano:**
  - Al iniciar la aplicación, **SyncSeinen** comprueba silenciosamente en segundo plano si existe una nueva versión en **GitHub Releases**.
  - Si hay una actualización disponible, aparece un botón de notificación en la barra superior que muestra las notas de la versión extraídas directamente de GitHub y permite descargar, instalar y reiniciar automáticamente a la nueva versión con un solo clic.
- 🚀 **Inicio de sesión en 1 clic (Sin configurar APIs):** Utiliza el motor oficial de **rclone** integrado para autorizar tu cuenta de Google Drive directamente desde el navegador, sin necesidad de crear proyectos en Google Cloud Console ni gestionar claves OAuth.
- 🗂️ **Separación limpia entre Archivos y Metadata:**
  - Los archivos reales de tus carpetas se guardan directamente en la carpeta de Google Drive que tú elijas.
  - En tu Google Drive se crea automáticamente una carpeta dedicada llamada `_SyncSeinen_Metadata` que **únicamente almacena archivos ligeros `.json`** con los metadatos de cada sincronización (nombre, ruta remota, carátula, rutas ignoradas, conteo de archivos y último dispositivo que subió cambios).
- ⚡ **Control Total (`Pull` / `Push` individual y global):**
  - Botones individuales de **Pull** y **Push** por cada carpeta vinculada.
  - Botones globales de **Pull a todos** y **Push a todos** para actualizar todas tus carpetas vinculadas de una sola vez.
- 🏎️ **Aceleración de transferencia con `rclone`:** Configurado con transferencia paralela (`--transfers 16`, `--checkers 32`, `--fast-list`, bloques de `64M` y pacer optimizado) para máxima velocidad de subida y bajada.
- 📊 **Progreso en tiempo real:** Barra de progreso integrada tanto en el cuadro de creación como en la barra superior general (puedes minimizar el cuadro modal con la `X` sin interrumpir la subida).

---

## 🆕 Novedades de la Versión 1.1.0

- **Interfaz Liquid Glass (Dark Mode exclusivo):** Rediseño visual con acabado de cristal líquido oscuro y eliminación del modo claro para una estética uniforme.
- **Carátulas en Sincronizaciones:** Soporte para elegir y cambiar imágenes de carátula sincronizadas entre dispositivos a través de `_SyncSeinen_Metadata`.
- **Vista en Cartas y Filas:** Selector rápido para alternar entre cuadrícula de tarjetas con portada o vista compacta en filas.
- **Ignorar Archivos y Carpetas:** Selector interactivo de rutas locales y remotas para excluir archivos o directorios tanto en `Push` como en `Pull` sin borrarlos.
- **Auto-Actualizador integrado con GitHub Releases:** Verificación en segundo plano al abrir la app, visor de cambios (*changelog*) en ventana modal e instalación + reinicio automático.

---

## 🔄 Flujo de Trabajo

1. **Dispositivo 1 crea la sincronización:**
   - Eliges un nombre, una carátula opcional, seleccionas la carpeta local en tu computadora, escoges (o creas) la carpeta destino en tu Google Drive y opcionalmente marcas archivos a ignorar.
   - Al confirmar, **SyncSeinen** sube los archivos a la carpeta indicada y registra la metadata en `_SyncSeinen_Metadata`.
2. **Dispositivo 2 detecta las sincronizaciones:**
   - Al iniciar sesión con la misma cuenta de Google Drive en otro dispositivo, la aplicación lee automáticamente `_SyncSeinen_Metadata` y muestra las sincronizaciones disponibles junto con sus carátulas y reglas de exclusión.
3. **Asignación de directorio local:**
   - En el Dispositivo 2 seleccionas en qué carpeta de esa computadora deseas guardar los archivos y ejecutas el primer **Pull**.
4. **Sincronización continua (`Pull` y `Push`):**
   - Con ambos dispositivos vinculados, cualquiera de los dos puede hacer **Push** al terminar de trabajar o **Pull** para recibir los últimos archivos subidos por el otro dispositivo.

---

## 📦 Descarga e Instalación (Releases)

En la sección de [**Releases**](https://github.com/Mrpapita2124/syncseinen/releases) encontrarás dos versiones listas para usar en Windows (64 bits):

1. **`SyncSeinen-Portable.exe`:** Ejecutable portable en un solo archivo. Solo ábrelo para iniciar el programa sin instalar nada.
2. **`SyncSeinen-win-x64.zip`:** Versión comprimida desempaquetada (arranque instantáneo al descomprimir y ejecutar `SyncSeinen.exe`).

---

## 🛠️ Desarrollo y Compilación desde Código Fuente

### Requisitos previos
- [Node.js](https://nodejs.org/) (v18 o superior)
- Git

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/Mrpapita2124/syncseinen.git
cd syncseinen
npm install
```

### 2. Ejecutar en modo desarrollo
```bash
npm run dev
```

### 3. Compilar ejecutables
- **En Windows (Portable `.exe` y carpeta desempaquetada):**
  ```bash
  npm run build:win
  ```
- **En Linux (`AppImage`):**
  ```bash
  npm run build:linux
  ```

> **Nota sobre `rclone`:** Si el binario de `rclone` no está presente en `resources/bin/` ni instalado en el `PATH` del sistema operativo, **SyncSeinen** descarga automáticamente el binario oficial de `rclone` para tu plataforma (Windows o Linux) la primera vez que inicias sesión.

---

## 🔒 Privacidad y Seguridad

- Tus credenciales y tokens de sesión (`rclone.conf`) y el mapeo de rutas locales (`syncseinen-config.json`) se almacenan exclusivamente de forma local en el directorio de datos de usuario de tu sistema operativo (`%APPDATA%\sync-seinen` en Windows o `~/.config/sync-seinen` en Linux).
- Ningún token ni dato personal se guarda dentro del repositorio.
