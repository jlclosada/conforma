# Conforma

Herramientas para comprobar que un sistema de facturación cumple **Verifactu** (RD 1007/2023 y Orden HAC/1177/2024).

> Estado: **fase A** — motor de verificación y `verifactu-lint`. Diseño completo en las notas del proyecto.

## verifactu-lint

Verifica en local, sin enviar nada a ningún servidor, los registros de facturación que genera tu programa:

- **Huella SHA-256** de altas, anulaciones y eventos, probada con los **vectores oficiales de la AEAT**. Si no cuadra, muestra la cadena exacta usada para el cálculo.
- **Encadenamiento**: enlace con el registro anterior, reinicios de cadena, fechas que retroceden, altas duplicadas y anulaciones.
- **Formatos**: NIF (con letra o dígito de control), número de serie, fechas, importes, tipo de factura y tipo de huella.
- **Esquemas XSD oficiales** de la AEAT (incluidos en el paquete, validación local con libxml2 en WebAssembly).
- **Código QR**: URL del servicio de cotejo, parámetros, codificación, los códigos de error de la AEAT (1001–2006), coherencia con el registro y nivel de corrección M.
- **QR en la factura PDF**: dibuja la factura en memoria, localiza el QR y comprueba el tamaño (30–40 mm), el margen en blanco (2 mm, recomendado 6), que esté en la primera página y sea el primer QR, la posición, y los textos «QR tributario:» encima y «VERI*FACTU» debajo con letra no menor que el resto.

```bash
pnpm install && pnpm build
node packages/cli/dist/cli.js examples/lote-correcto.xml
node packages/cli/dist/cli.js examples/lote-correcto.xml --qr examples/factura-incorrecta.pdf
node packages/cli/dist/cli.js examples/lote-manipulado.xml --qr factura.png --entorno pruebas
```

Salida legible, `--json` o `--sarif` (para GitHub code scanning). Código de salida `1` si hay hallazgos críticos o altos: se puede usar en integración continua.

## Web: verifactu-lint en el navegador

`apps/web` es la misma verificación en una página: arrastras los XML y la factura PDF y todo se calcula en el navegador (motor, libxml2, zxing y pdf.js en WebAssembly, sin CDN). Ningún fichero sale del equipo.

```bash
pnpm --filter @conforma/web dev     # http://localhost:5173
pnpm --filter @conforma/web build   # estático en apps/web/dist
```

## Paquetes

| Paquete | Qué es |
|---|---|
| `packages/core` (`@conforma/core`) | Motor puro en TypeScript: huella, lectura de XML, reglas, QR y XSD. Funciona en Node y (salvo el XSD con ficheros locales) en el navegador. |
| `packages/cli` (`verifactu-lint`) | Línea de comandos. |
| `apps/web` | Página que verifica en el navegador. |

## Desarrollo

Requiere Node 22 y pnpm.

```bash
pnpm install
pnpm build
pnpm test      # vectores oficiales, lotes de ejemplo, QR, NIF, XSD, maquetación y CLI
node scripts/generar-facturas-ejemplo.mjs   # regenera las facturas PDF de ejemplo
```

## Fuentes oficiales

- AEAT · *Detalle de las especificaciones técnicas para generación de la huella o hash de los registros de facturación* (v0.1.2, 27/08/2024)
- AEAT · *Detalle de las especificaciones técnicas del código QR de la factura y de la URL del servicio de cotejo* (v0.5.0, 10/12/2025)
- AEAT · Esquemas `SuministroLR.xsd`, `SuministroInformacion.xsd`, `EventosSIF.xsd` y `SistemaFacturacion.wsdl` (copiados en `packages/core/schemas`; el import de `xmldsig-core-schema.xsd` apunta a la copia local)

## Licencia

[Apache-2.0](LICENSE). Los esquemas XSD y WSDL de `packages/core/schemas` son documentos públicos de la AEAT; `xmldsig-core-schema.xsd` es del W3C.

## Aviso

Verificación técnica automática. No es una homologación de la AEAT ni sustituye al asesoramiento fiscal o legal.
