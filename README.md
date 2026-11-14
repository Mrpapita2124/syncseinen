# 🔄 SyncSeinen

**SyncSeinen** es una aplicación de escritorio diseñada para sincronizar carpetas de forma sencilla, rápida y controlada entre múltiples dispositivos utilizando **Google Drive** y el motor **rclone** integrado.

---

## ✨ Características Principales

- 🎨 **Dos Temas Visuales (**`Liquid Glass`** y **`Negro y Rojo Plano`**):**
  - **Liquid Glass:** Diseño translúcido con efectos de refracción y luces ambientales.
  - **Negro y Rojo Plano:** Estética de colores sólidos planos en negro mate (`#09090b` / `#121215`) y acentos en rojo intenso (`#dc2626` / `#ef4444`).
- 🌐 **Buscador Integrado de Imágenes Online (DuckDuckGo Images) + Subida Local:**
  - Al agregar o cambiar la carátula de cualquier sincronización, se abre un mini buscador de imágenes en internet mediante la API de **DuckDuckGo Images**; basta con escribir el nombre para ver y seleccionar una imagen al instante o pulsar **Subir foto local** para elegir un archivo de tu computadora.
  - La carátula se optimiza e incrusta dentro de `_SyncSeinen_Metadata`, por lo que **todos tus dispositivos ven la misma portada automáticamente**.
- 🖥️ **Ejecución en Segundo Plano (*System Tray*) y Menú Rápido Tematizado:**
  - Desde el botón de configuración (**engrane** arriba a la derecha) puedes elegir si al cerrar la ventana con la `X` la aplicación **se queda minimizada en segundo plano** en la bandeja del sistema o **se cierra por completo**.
  - Al hacer clic sobre el icono de **SyncSeinen** en la bandeja del sistema se despliega un menú rápido tematizado con las opciones:
    - **Abrir la aplicación**
    - **Hacer push a todo**
    - **Hacer pull a todo**
    - **Cerrarla por completo**
- 📁 **Creación Automática de Subcarpeta con el Nombre de tu Carpeta Local:**
  - Al elegir la ruta destino en Google Drive, puedes crear y añadir automáticamente una subcarpeta con el mismo nombre de la carpeta seleccionada en tu PC con un solo clic.
- 🙈 **Exclusión Selectiva de Archivos y Carpetas (Ignorar en Push y Pull):**
  - Explorador visual integrado para seleccionar qué archivos o subcarpetas no deseas sincronizar.
  - Los elementos marcados como ignorados no se suben durante el **Push** ni se sobrescriben o eliminan durante el **Pull** (su existencia local se respeta intacta).
- 🔔 **Actualizaciones Automáticas en Segundo Plano:**
  - Al iniciar la aplicación, **SyncSeinen** comprueba silenciosamente en segundo plano si existe una nueva versión en **GitHub Releases**.
  - Si hay una actualización disponible, aparece un botón de notificación en la barra superior que muestra las notas de la versión extraídas directamente de GitHub y permite descargar, instalar y reiniciar automáticamente a la nueva versión con un solo clic.
- 🚀 **Inicio de sesión en 1 clic (Sin configurar APIs):** Utiliza el motor oficial de **rclone** integrado para autorizar tu cuenta de Google Drive directamente desde el navegador, sin necesidad de crear proyectos en Google Cloud Console ni gestionar claves OAuth.
- ⚡ **Control Total (`Pull` / `Push` individual y global) y Vistas en `Cartas` o `Filas`:**
  - Alterna en cualquier momento entre la vista de cuadrícula de **Cartas** o lista en **Filas**.
  - Botones individuales de **Pull** y **Push** por carpeta y botones globales de **Pull a todos** y **Push a todos**.

---

## 🆕 Novedades de la Versión 1.2.0

- **Mini Buscador de Carátulas Online (DuckDuckGo Images):** Búsqueda instantánea de imágenes desde internet al crear o editar la carátula de una sincronización, manteniendo a un lado el botón **Subir foto local**.
- **Modo en Segundo Plano (*System Tray*) con Menú Rápido Tematizado:** Al minimizarse a la bandeja del sistema, hacer clic izquierdo o derecho en el icono abre un menú personalizado (sincronizado con el tema activo) para abrir la app, hacer *Push a todo*, hacer *Pull a todo* o cerrarla por completo.
- **Menú de Configuración (Engrane) y Nuevo Tema `Negro y Rojo Plano`:** Nuevo menú desplegable arriba a la derecha que permite configurar el comportamiento al cerrar la ventana (**Quedarse en segundo plano** vs. **Cerrarse por completo**) y alternar entre el tema **Liquid Glass** y el nuevo tema **Negro y Rojo Plano**.
- **Nuevo Icono Oficial e Identificador `SyncSeinen`:** Nuevo icono oficial integrado en el ejecutable, ventana principal y bandeja del sistema, e identificador de ventana y proceso simplificado a **SyncSeinen**.
- **Subcarpeta Automática en Google Drive:** Opción rápida para crear y añadir automáticamente una subcarpeta en Google Drive con el nombre de la carpeta local de la PC.

---

## 🔄 Flujo de Trabajo

1. **Dispositivo 1 crea la sincronización:**
   - Eliges un nombre, buscas una carátula online (o subes una local), seleccionas la carpeta local en tu computadora, escoges (o creas automáticamente) la carpeta destino en tu Google Drive y opcionalmente marcas archivos a ignorar.
   - Al confirmar, **SyncSeinen** sube los archivos a la carpeta indicada y registra la metadata en `_SyncSeinen_Metadata`.
2. **Dispositivo 2 detecta las sincronizaciones:**
   - Al iniciar sesión con la misma cuenta de Google Drive en otro dispositivo, la aplicación lee automáticamente `_SyncSeinen_Metadata` y muestra las sincronizaciones disponibles junto con sus carátulas y reglas de exclusión.
3. **Asignación de directorio local:**
   - En el Dispositivo 2 seleccionas en qué carpeta de esa computadora deseas guardar los archivos y ejecutas el primer **Pull**.
4. **Sincronización continua (`Pull` y `Push`):**
   - Con ambos dispositivos vinculados, cualquiera de los dos puede hacer **Push** al terminar de trabajar o **Pull** para recibir los últimos archivos subidos por el otro dispositivo (incluso directamente desde el menú rápido de la bandeja del sistema).

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
