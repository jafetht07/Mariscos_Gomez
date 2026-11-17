# Mariscos Gómez
> Sistema de inventario, facturación y créditos para un negocio de mariscos, con sincronización opcional en Firestore.

## Español

### ¿Qué es?

Mariscos Gómez es una aplicación web de tipo SPA para administrar un negocio de venta de mariscos: inventario de productos, facturación con impresión de comprobantes en PDF, ventas a crédito con abonos y reportes de ventas y cartera. Está construida con HTML, CSS y JavaScript sin frameworks ni paso de compilación, y funciona de dos maneras: con persistencia local en `localStorage` o sincronizada entre dispositivos mediante Firebase Firestore.

Por su alcance y por detalles del código (usuarios de prueba, credenciales embebidas, interfaz solo en español), se trata de un proyecto académico o prototipo funcional, no de un producto listo para producción.

### Características

- **Inicio de sesión local** con tres usuarios definidos en el código y sesión recordada en `localStorage`.
- **Panel de control** con indicadores: productos registrados, productos con stock bajo (menos de 10 unidades), facturas emitidas, ventas acumuladas y créditos activos.
- **Inventario**: alta, edición y eliminación de productos; búsqueda por nombre o categoría; paginación de 12 productos por página; alerta visual de stock bajo; precio de costo y margen visibles solo para el usuario administrador (`Tuko`).
- **Facturación**: selección de productos con validación de stock, cantidades decimales según la unidad (Kg, Paquete, Pza, Caja, Bolsa), descuento en colones, datos del cliente y generación de un comprobante PDF en formato de ticket de 80 mm con jsPDF.
- **Venta a crédito**: al marcar la casilla correspondiente se registra el crédito con plazo en días, fecha de vencimiento, saldo y estado.
- **Facturación a precio de costo**: el administrador puede emitir una factura usando el costo en lugar del precio de venta (marcada como `COSTO` en la interfaz y en los datos).
- **Gestión de créditos**: tabla con filtros por cliente, factura y estado (pendiente, vencido, pagado), registro de abonos con historial, notas y usuario que registró cada pago.
- **Reportes de ventas**: filtro por rango de fechas, resumen del período (total vendido, cantidad de facturas, promedio), detalle paginado, reimpresión de factura, eliminación con restauración de stock y exportación a PDF y Excel.
- **Reportes de créditos**: filtros por fecha y estado, totales (monto otorgado, cobrado y saldo), top 5 de clientes con mayor deuda, conteo por estado y exportación a PDF y Excel.
- **Mantenimiento** (solo para `Tuko`): monitor de uso de `localStorage`, estimación de rendimiento, alertas automáticas, archivado de facturas de más de seis meses a Excel, respaldo completo, optimización (elimina productos duplicados y recorta campos), borrado de facturas de más de tres meses y límites configurables (entre 100 y 10 000 facturas).
- **Sincronización con Firestore** en tiempo real para productos, facturas y créditos, con carga inicial combinada (local + remoto), escrituras por lotes y modo de respaldo local cuando no hay conexión.
- **Tema claro y oscuro** persistente y atajo de teclado `F2` para ir a facturación.

### Stack técnico

| Componente | Uso |
|---|---|
| HTML5 + CSS3 | Interfaz de una sola página; estilos propios en `styles.css` (sin framework) |
| JavaScript (ES6, sin módulos) | Lógica dividida en archivos que comparten variables globales |
| Firebase 9.22.0 (compat) + Firestore | Sincronización en la nube y listeners en tiempo real |
| jsPDF 2.5.1 + jsPDF-AutoTable 3.5.28 | Comprobantes de 80 mm y reportes en PDF |
| SheetJS (xlsx) 0.18.5 | Exportación a Excel |
| Lucide | Iconografía |
| `localStorage` | Persistencia local y caché de datos remotos |

Todas las dependencias externas se cargan por CDN; no hay `package.json` ni proceso de build.

### Estructura del proyecto

```
Mariscos_Gomez/
├── index.html               # Estructura de la SPA, login, secciones y navegación
├── styles.css               # Estilos, temas claro/oscuro y diseño responsive
├── state.js                 # Variables globales, usuarios y estado persistido
├── ui.js                    # Alertas, pestañas, monitor de almacenamiento
├── auth.js                  # Login, logout y sesión automática
├── products.js              # CRUD de productos, búsqueda y paginación
├── invoice.js               # Carrito, factura, PDF y registro de créditos
├── credits.js               # Créditos, abonos e historial de pagos
├── reports.js               # Reportes de ventas y de créditos
├── maintenance.js           # Respaldo, archivado, optimización y límites
├── app.js                   # Inicialización, dashboard y event listeners
└── firebase-integration.js  # Firestore: carga, listeners, escrituras y parches
```

### Módulos

| Archivo | Rol |
|---|---|
| `state.js` | Define el estado compartido: lista de usuarios, usuario actual, arreglos de productos, facturas y créditos, contadores de IDs, paginación y configuración de mantenimiento. Se carga primero. |
| `ui.js` | Utilidades de interfaz: `showAlert`, navegación entre secciones (`showTab`), cálculo y visualización del uso de `localStorage` sobre un límite de 5120 KB. |
| `auth.js` | Valida usuario y contraseña contra el objeto `users`, guarda la sesión en `localStorage`, controla el cierre de sesión, la sesión automática al recargar y la visibilidad de la sección de mantenimiento. |
| `products.js` | CRUD del inventario, búsqueda, paginación, validaciones de precio y stock, y edición en modal. Restringe el precio de costo y el margen al usuario `Tuko`. |
| `invoice.js` | Arma el carrito, calcula subtotal, descuento y total, descuenta stock, genera el número de factura `FAC-AAAA-T<timestamp>`, crea el PDF de 80 mm y registra el crédito cuando la venta es a plazos. |
| `credits.js` | Actualiza estados (pendiente/vencido/pagado), muestra la tabla de créditos, permite registrar abonos y consultar el historial de pagos y reimprimir la factura. |
| `reports.js` | Estadísticas generales, reportes de ventas por fecha con reimpresión y eliminación (restaura stock), reportes de créditos con top de deudores y exportaciones a PDF/Excel. |
| `maintenance.js` | Diagnóstico de almacenamiento y rendimiento, archivado y borrado de facturas antiguas, respaldo completo en Excel, optimización de datos y configuración de límites. |
| `app.js` | Actualiza los KPI del panel, inicializa el sistema tras el login y registra todos los event listeners del documento; programa la actualización periódica del monitor y del panel. |
| `firebase-integration.js` | Inicializa Firebase, carga y escucha las colecciones `products`, `invoices` y `credits`, envía cambios con `set`/`batch`, expone `syncWithFirebase`, `migrateToFirebase` y funciones de limpieza total, y envuelve funciones existentes para sincronizar sin crear bucles. |

### Cómo ejecutarlo

1. Descarga o clona la carpeta del proyecto.
2. Sirve los archivos con un servidor estático (no lo abras con `file://`, porque Firebase y algunos CDN requieren HTTP):

   ```bash
   python -m http.server 5500
   ```

3. Abre `http://localhost:5500` en el navegador.
4. Inicia sesión con uno de los usuarios definidos en `state.js`. Los nombres de usuario aparecen en la pantalla de login.
5. Si no hay conexión o Firebase falla, la aplicación sigue funcionando con los datos guardados en `localStorage`.

> Los usuarios y contraseñas están escritos en `state.js`; si publicas el proyecto, cámbialos antes de usarlo con datos reales.

### Datos y configuración

**Persistencia local** (`localStorage`):

| Clave | Contenido |
|---|---|
| `mariscos_products` | Arreglo de productos |
| `mariscos_next_id` | Siguiente ID de producto |
| `mariscos_invoices` | Historial de facturas |
| `mariscos_credits` | Créditos y abonos |
| `mariscos_next_credit_id` | Siguiente ID de crédito |
| `mariscos_maintenance_config` | Límite de facturas y limpieza automática |
| `current_user` | Usuario con sesión activa |
| `mariscos_theme` | Tema claro u oscuro |

**Modelo de datos principal**:

- Producto: `id`, `name`, `category`, `price`, `costPrice`, `stock`, `unit`, `createdAt`.
- Factura: `number`, `date`, `time`, `fullDateTime`, `client {name, phone, address}`, `items[]`, `subtotal`, `discount`, `total`, `totalCost`, `user`, `isCredit`.
- Crédito: `id`, `invoiceNumber`, `client`, `totalAmount`, `paidAmount`, `balance`, `saleDate`, `dueDate`, `status`, `notes`, `payments[]`, `createdBy`.

**Firebase**: se usa únicamente **Cloud Firestore** (sin Firebase Auth). La configuración del proyecto está al inicio de `firebase-integration.js`, y las colecciones son `products`, `invoices` y `credits`, con el ID del documento tomado del ID o número interno. El repositorio incluye la configuración del proyecto del autor; no se reproduce aquí. Si vas a reutilizar el código, crea tu propio proyecto, reemplaza esa configuración y restringe las reglas de Firestore, ya que el acceso no está protegido por autenticación.

### Notas y limitaciones

- La autenticación es solo del lado del cliente: usuario y contraseña están en texto plano en `state.js`, y cualquiera con acceso al código puede leerlos.
- Firestore no usa Firebase Auth; la seguridad depende exclusivamente de las reglas del proyecto.
- El control de acceso por rol es visual: el costo de los productos y la sección de mantenimiento se ocultan, pero los datos siguen en el cliente.
- El almacenamiento local tiene un límite práctico cercano a 5 MB; el sistema lo monitorea y ofrece limpieza, pero no reemplaza una base de datos.
- Los precios se formatean en colones costarricenses (`es-CR`); no hay soporte multi-moneda ni impuestos.
- La interfaz está únicamente en español y el PDF tiene un ancho fijo de 80 mm.
- Eliminar una factura restaura el stock, pero no revierte automáticamente un crédito asociado.
- El número de factura depende de la marca de tiempo, por lo que no es consecutivo.

---

## English

### What is it?

Mariscos Gómez is a single-page web application for running a seafood business: product inventory, invoicing with PDF receipts, credit sales with installment payments, and sales and receivables reports. It is built with plain HTML, CSS, and JavaScript, with no framework or build step, and works in two modes: local persistence through `localStorage`, or synchronized across devices with Firebase Firestore.

Given its scope and code details (demo users, embedded credentials, Spanish-only interface), it is an academic project or working prototype rather than a production-ready product.

### Features

- **Local login** with three users defined in code and the session remembered in `localStorage`.
- **Dashboard** with KPIs: registered products, low-stock products (fewer than 10 units), issued invoices, accumulated sales, and active credits.
- **Inventory**: create, edit, and delete products; search by name or category; pagination of 12 items per page; low-stock warning; cost price and margin visible only to the admin user (`Tuko`).
- **Invoicing**: product selection with stock validation, decimal quantities by unit (Kg, Pack, Piece, Box, Bag), discount in colones, customer details, and an 80 mm PDF receipt generated with jsPDF.
- **Credit sales**: checking the credit option records the sale with a term in days, due date, balance, and status.
- **Cost-price invoicing**: the admin can issue an invoice at cost instead of sale price (flagged as `COSTO` in the UI and in the data).
- **Credit management**: table with filters by customer, invoice, and status (pending, overdue, paid), installment registration with history, notes, and the user who recorded each payment.
- **Sales reports**: date-range filter, period summary (total sold, invoice count, average), paginated detail, invoice reprint, deletion with stock restoration, and PDF/Excel export.
- **Credit reports**: filters by date and status, totals (granted, collected, outstanding), top 5 debtors, counts by status, and PDF/Excel export.
- **Maintenance** (only for `Tuko`): `localStorage` usage monitor, performance estimate, automatic alerts, archiving invoices older than six months to Excel, full backup, optimization (removes duplicate products and trims fields), deletion of invoices older than three months, and configurable limits (100 to 10,000 invoices).
- **Firestore synchronization** in real time for products, invoices, and credits, with a merged initial load (local + remote), batched writes, and local fallback when offline.
- **Light and dark theme** persisted locally, plus an `F2` shortcut to open invoicing.

### Tech stack

| Component | Purpose |
|---|---|
| HTML5 + CSS3 | Single-page interface; custom styles in `styles.css` (no framework) |
| JavaScript (ES6, no modules) | Logic split across files sharing global variables |
| Firebase 9.22.0 (compat) + Firestore | Cloud sync and real-time listeners |
| jsPDF 2.5.1 + jsPDF-AutoTable 3.5.28 | 80 mm receipts and PDF reports |
| SheetJS (xlsx) 0.18.5 | Excel export |
| Lucide | Icons |
| `localStorage` | Local persistence and remote data cache |

All external dependencies load from CDNs; there is no `package.json` or build process.

### Project structure

```
Mariscos_Gomez/
├── index.html               # SPA structure, login, sections, and navigation
├── styles.css               # Styles, light/dark themes, responsive layout
├── state.js                 # Global variables, users, and persisted state
├── ui.js                    # Alerts, tabs, storage monitor
├── auth.js                  # Login, logout, and auto-login
├── products.js              # Product CRUD, search, and pagination
├── invoice.js               # Cart, invoice, PDF, and credit creation
├── credits.js               # Credits, payments, and payment history
├── reports.js               # Sales and credit reports
├── maintenance.js           # Backup, archiving, optimization, and limits
├── app.js                   # Initialization, dashboard, and event listeners
└── firebase-integration.js  # Firestore: loading, listeners, writes, and patches
```

### Modules

| File | Role |
|---|---|
| `state.js` | Defines shared state: user list, current user, product/invoice/credit arrays, ID counters, pagination, and maintenance settings. Loaded first. |
| `ui.js` | UI helpers: `showAlert`, section navigation (`showTab`), and calculation/display of `localStorage` usage against a 5120 KB limit. |
| `auth.js` | Validates username and password against the `users` object, stores the session in `localStorage`, handles logout, auto-login on reload, and maintenance-section visibility. |
| `products.js` | Inventory CRUD, search, pagination, price/stock validation, and modal editing. Restricts cost price and margin to the `Tuko` user. |
| `invoice.js` | Builds the cart, computes subtotal, discount, and total, deducts stock, generates invoice numbers as `FAC-YYYY-T<timestamp>`, creates the 80 mm PDF, and records a credit when the sale is on terms. |
| `credits.js` | Updates statuses (pending/overdue/paid), renders the credit table, records installments, and shows payment history and invoice reprints. |
| `reports.js` | General statistics, date-filtered sales reports with reprint and deletion (restores stock), credit reports with top debtors, and PDF/Excel exports. |
| `maintenance.js` | Storage and performance diagnostics, archiving and deletion of old invoices, full Excel backup, data optimization, and limit configuration. |
| `app.js` | Refreshes dashboard KPIs, initializes the system after login, registers all document event listeners, and schedules periodic monitor/dashboard updates. |
| `firebase-integration.js` | Initializes Firebase, loads and listens to `products`, `invoices`, and `credits`, writes changes via `set`/`batch`, exposes `syncWithFirebase`, `migrateToFirebase`, and full-cleanup helpers, and wraps existing functions to sync without loops. |

### How to run

1. Download or clone the project folder.
2. Serve the files with a static server (do not open with `file://`, since Firebase and some CDNs require HTTP):

   ```bash
   python -m http.server 5500
   ```

3. Open `http://localhost:5500` in a browser.
4. Log in with one of the users defined in `state.js`. Usernames are shown on the login screen.
5. If there is no connection or Firebase fails, the app keeps working with the data stored in `localStorage`.

> Usernames and passwords are written in `state.js`; change them before using the project with real data.

### Data and configuration

**Local persistence** (`localStorage`):

| Key | Content |
|---|---|
| `mariscos_products` | Product array |
| `mariscos_next_id` | Next product ID |
| `mariscos_invoices` | Invoice history |
| `mariscos_credits` | Credits and payments |
| `mariscos_next_credit_id` | Next credit ID |
| `mariscos_maintenance_config` | Invoice limit and auto-cleanup |
| `current_user` | Logged-in user |
| `mariscos_theme` | Light or dark theme |

**Main data model**:

- Product: `id`, `name`, `category`, `price`, `costPrice`, `stock`, `unit`, `createdAt`.
- Invoice: `number`, `date`, `time`, `fullDateTime`, `client {name, phone, address}`, `items[]`, `subtotal`, `discount`, `total`, `totalCost`, `user`, `isCredit`.
- Credit: `id`, `invoiceNumber`, `client`, `totalAmount`, `paidAmount`, `balance`, `saleDate`, `dueDate`, `status`, `notes`, `payments[]`, `createdBy`.

**Firebase**: only **Cloud Firestore** is used (no Firebase Auth). The project configuration sits at the top of `firebase-integration.js`, and the collections are `products`, `invoices`, and `credits`, keyed by the internal ID or invoice number. The repository ships the author's own project configuration; it is not reproduced here. If you reuse the code, create your own project, replace that configuration, and tighten the Firestore rules, because access is not protected by authentication.

### Notes and limitations

- Authentication is client-side only: username and password are plain text in `state.js`, readable by anyone with access to the code.
- Firestore does not use Firebase Auth; security depends entirely on the project's rules.
- Role-based access control is visual: product cost and the maintenance section are hidden, but the data remains on the client.
- Local storage has a practical limit near 5 MB; the app monitors it and offers cleanup, but it is not a database replacement.
- Prices are formatted in Costa Rican colones (`es-CR`); there is no multi-currency or tax support.
- The interface is Spanish-only, and the PDF uses a fixed 80 mm width.
- Deleting an invoice restores stock but does not automatically reverse an associated credit.
- Invoice numbers rely on timestamps, so they are not sequential.

---

Autor / Author: Jafeth — GitHub: [@jafetht07](https://github.com/jafetht07)
