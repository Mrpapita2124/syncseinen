# 🔄 SyncSeinen

**SyncSeinen** es una aplicación de escritorio diseñada para sincronizar carpetas de forma sencilla, rápida y controlada entre múltiples dispositivos utilizando **Google Drive**, **Dropbox** y **OneDrive** mediante el motor **rclone** integrado.

---

## ✨ Características Principales

- ☁️ **Soporte Multi-Nube (**`Google Drive`**, **`Dropbox`** y **`OneDrive`**):**
  - Vincula una, dos o las tres nubes al mismo tiempo desde la pantalla inicial o desde el menú de configuración.
  - Al iniciar sesión en un servicio, éste queda marcado como **Sesión iniciada**, permitiéndote seguir vinculando otros servicios antes de pasar al panel o continuar con al menos un servicio activo.
  - La vista principal divide las sincronizaciones por proveedor con una cabecera limpia en línea (`(icono) Servicio -------- Pull · Push`) para ejecutar **Pull** o **Push** sobre todas las carpetas de ese servicio de manera independiente.
- 🎮 **Menú de Configuración Sobrepuesto (Estilo Pausa):**
  - Al pulsar el botón de **engrane** arriba a la derecha se despliega un menú sobrepuesto centrado sobre la pantalla:
    - **Servicios en la nube en vista de filas:** Conecta o desconecta cuentas de **Google Drive**, **Dropbox** y **OneDrive** en cualquier momento.
    - **Selector visual de temas con muestras de color:** Botones dedicados que muestran los colores de cada tema (**Cristal Líquido** con degradado azul/morado y **Negro y Rojo** con cuadrado dividido diagonalmente en dos triángulos rectángulos negro y rojo).
    - **Comportamiento al cerrar la ventana:** Elige entre minimizarse a la bandeja del sistema o cerrarse por completo.
    - **Identificador de dispositivo:** Personaliza el nombre con el que esta PC registra cada **Push**.
- 🎨 **Dos Temas Visuales (**`Cristal Líquido`** y **`Negro y Rojo Plano`**):**
  - **Cristal Líquido:** Diseño translúcido con efectos de refracción y luces ambientales en tonos azules y morados.
  - **Negro y Rojo Plano:** Estética de colores sólidos planos en negro mate (`#09090b` / `#121215`) y acentos en rojo intenso (`#dc2626` / `#ef4444`).
- 🌐 **Buscador Integrado de Imágenes Online (DuckDuckGo Images) + Subida Local:**
  - Al agregar o cambiar la carátula de cualquier sincronización, se abre un mini buscador de imágenes en internet mediante **DuckDuckGo Images**; basta con escribir el nombre para seleccionar una imagen al instante o pulsar **Subir foto local**.
  - La carátula se optimiza e incrusta dentro de `_SyncSeinen_Metadata` en la nube correspondiente, por lo que **todos tus dispositivos ven la misma portada automáticamente**.
- 🖥️ **Ejecución en Segundo Plano (*System Tray*) y Menú Rápido Tematizado:**
  - Al hacer clic sobre el icono de **SyncSeinen** en la bandeja del sistema se despliega un menú rápido tematizado con las opciones:
    - **Abrir la aplicación**
    - **Hacer push a todo**
    - **Hacer pull a todo**
    - **Cerrarla por completo**
- 📁 **Creación Automática de Subcarpeta con el Nombre de tu Carpeta Local:**
  - Al elegir la ruta destino en tu nube (**Google Drive**, **Dropbox** o **OneDrive**), puedes crear y añadir automáticamente una subcarpeta con el mismo nombre de la carpeta seleccionada en tu PC con un solo clic.
- 🙈 **Exclusión Selectiva de Archivos y Carpetas (Ignorar en Push y Pull):**
  - Explorador visual integrado para seleccionar qué archivos o subcarpetas no deseas sincronizar.
  - Los elementos marcados como ignorados no se suben durante el **Push** ni se sobrescriben o eliminan durante el **Pull** (su existencia local se respeta intacta).
- 🔔 **Actualizaciones Automáticas en Segundo Plano:**
  - Al iniciar la aplicación, **SyncSeinen** comprueba silenciosamente en segundo plano si existe una nueva versión en **GitHub Releases** y permite descargar, instalar y reiniciar automáticamente con un solo clic.

---

## 🆕 Novedades de la Versión 1.3.0

- **Compatibilidad con Dropbox y Microsoft OneDrive (además de Google Drive):**
  - Soporte completo para crear, vincular, listar carpetas, ignorar rutas y sincronizar (`Push` / `Pull`) en **Google Drive**, **Dropbox** y **OneDrive**.
  - Resolución automática de unidades en **OneDrive Personal** (descartando unidades fantasma `b!...` de la *Bóveda Personal / Personal Vault* que provocaban el error `ObjectHandle is Invalid` y excluyendo automáticamente las carpetas protegidas del Almacén personal).
  - Flujo de autenticación OAuth no interactivo con **rclone** que abre una única pestaña en el navegador y limpia cualquier configuración parcial si el usuario cancela el inicio de sesión.
- **Pantalla Inicial Multi-Servicio:**
  - Permite iniciar sesión en uno o varios servicios sin cambiar forzosamente de vista tras el primer inicio de sesión, marcando cada servicio conectado y habilitando el botón **Ir a las sincronizaciones** en cuanto al menos un servicio está vinculado.
- **Menú de Configuración Sobrepuesto (Tipo Pausa de Videojuego):**
  - Sustituye el antiguo menú desplegable por un panel modal sobrepuesto desde donde se pueden gestionar las sesiones de todos los servicios en una **vista de filas**.
  - Nuevo **selector de temas por botones con muestra visual de color** (degradado azul/morado para **Cristal Líquido** y cuadrado partido en dos triángulos rectángulos negro y rojo para **Negro y Rojo**).
- **Cabeceras de Servicio Limpias en la Vista de Sincronizaciones:**
  - Cada servicio activo agrupa sus carpetas bajo una barra en línea minimalista con su icono, nombre del servicio, línea divisoria y botones rápidos de **Pull** y **Push** para toda esa sección.

---

## 🕓 Historial de Versiones Recientes

### Versión 1.2.0
- **Mini Buscador de Carátulas Online (DuckDuckGo Images)** y subida local.
- **Modo en Segundo Plano (*System Tray*) con Menú Rápido Tematizado**.
- **Nuevo Tema `Negro y Rojo Plano`** e icono oficial `SyncSeinen`.
- **Subcarpeta Automática** con el nombre de la carpeta local de la PC.

---

## 🔄 Flujo de Trabajo

1. **Vincula tus servicios en la nube:**
   - Inicia sesión en **Google Drive**, **Dropbox** y/o **OneDrive**. Puedes agregar más servicios en cualquier momento desde el menú de configuración (engrane).
2. **Dispositivo 1 crea la sincronización:**
   - Eliges en qué servicio en la nube guardarla, asignas un nombre, buscas una carátula online (o subes una local), seleccionas la carpeta local en tu computadora, escoges (o creas automáticamente) la carpeta destino en la nube y opcionalmente marcas archivos a ignorar.
   - Al confirmar, **SyncSeinen** sube los archivos y registra la metadata en `_SyncSeinen_Metadata` dentro de ese servicio.
3. **Dispositivo 2 detecta las sincronizaciones:**
   - Al iniciar sesión con las mismas cuentas en otro dispositivo, la aplicación lee automáticamente `_SyncSeinen_Metadata` de cada nube conectada y agrupa las sincronizaciones por servicio.
4. **Sincronización continua (`Pull` y `Push`):**
   - Ejecuta **Pull** o **Push** por carpeta individual, por servicio completo (desde la cabecera de cada nube) o para todos los servicios desde el menú rápido de la bandeja del sistema.

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

---

## 🔒 Privacidad y Seguridad

- Tus credenciales y tokens de sesión (`rclone.conf`) y el mapeo de rutas locales (`syncseinen-config.json`) se almacenan exclusivamente de forma local en el directorio de datos de usuario de tu sistema operativo (`%APPDATA%\sync-seinen` en Windows o `~/.config/sync-seinen` en Linux).
- Ningún token ni dato personal se guarda dentro del repositorio.
