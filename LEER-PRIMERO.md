# Menú Petit Roquefort — MVP

Prototipo de **consulta**. No hay pedidos, no hay cuenta, no se envía nada a
ningún servidor. Sirve para probar funcionalidad, diseño y navegación.

**125 productos · 18 categorías · 5 grupos.** Datos tomados del menú impreso;
los precios están cerrados.

---

## Para verlo

Abre `index.html` con doble clic. Funciona sin servidor: los datos se cargan
como `<script>`, no con `fetch`, precisamente para que puedas previsualizar en
local antes de subir nada.

---

## Para agregar una foto

Tres pasos, un solo archivo que editar.

**1.** Copia la imagen a `img/platillos/`
**2.** Nómbrala con el id del platillo, en `.jpg`

```
img/platillos/chilaquiles.jpg
img/platillos/toast-salmon.jpg
img/platillos/extra-huevo.jpg
```

**3.** Agrega el id a la lista de `data/fotos.js`

```js
window.FOTOS = [
  "chilaquiles",
  "toast-salmon",
];
```

Los 125 ids están en `ids-platillos.md`, ordenados por grupo y categoría.

**Un platillo sin foto propia no queda vacío.** Usa automáticamente la imagen
representativa de su categoría (`img/categorias/`) y en el detalle muestra la
etiqueta "Imagen representativa". El listado marca con un ícono de cámara los
que sí tienen foto real.

### Formato

**1200 × 1200 px (cuadrada), JPG calidad 80, menos de 250 KB.** El hero del
detalle usa `aspect-ratio: 1/1`, así que recorta desde el centro si la imagen
no es cuadrada.

### Otros formatos

```js
window.FOTOS = [
  "chilaquiles",
  { id: "latte", ext: "webp" },
];
```

---

## Las 18 imágenes de categoría

Las que están en `img/categorias/` son **provisionales**: SVG de color con el
nombre de la categoría. Existen para que el prototipo funcione completo desde
el primer momento.

Para reemplazarlas por fotos reales, guarda el `.jpg` con el mismo nombre,
borra el `.svg`, y cambia la extensión en la función `imagen()` de
`assets/js/menu.js`.

---

## Estructura

```
index.html              Aplicación completa
404.html                Página de error, mismo lenguaje visual
assets/css/menu.css     Estilos
assets/js/menu.js       Navegación, detalle, estimado
data/menu.json          Fuente canónica de los 125 productos
data/menu-data.js       Misma data envuelta para el navegador
data/fotos.js           ← el único archivo que editas al agregar fotos
img/platillos/          ← aquí van las fotos reales
img/categorias/         18 imágenes de respaldo (provisionales)
ids-platillos.md        Tabla de referencia: platillo → id
```

El sprite de iconos va embebido al inicio del `<body>` en ambos HTML. Son
iconos de Lucide (lucide.dev), licencia ISC. Van embebidos y no por CDN para
que el sitio funcione sin conexión y sin peticiones extra.

Si corriges un dato, edita `data/menu.json` y replica el cambio en
`data/menu-data.js` (es el mismo objeto precedido por `window.MENU = `).

---

## Cómo funciona

**Navegación.** Flechas izquierda y derecha recorren las 18 categorías en
orden, cruzando grupos. Los puntos indican la posición; el sobretítulo muestra
el grupo con su ícono.

**Dos formas de agregar.** El botón `+` de la tarjeta suma sin salir del
listado. Tocar la tarjeta abre el detalle, donde eliges cantidad y agregas
desde el botón inferior.

**21 productos abren hoja de opciones** porque tienen presentación (sopas,
jugos, vinos, brunch, tocino) o extras con precio. Los otros 104 se suman con
un toque.

**Estimado.** Subtotal más tres totales con 10 %, 15 % y 20 % de propina,
visibles a la vez. Se guarda en `localStorage` bajo `pr-estimado-v2`, así que
sobrevive a recargas. Para cambiar los porcentajes, edita la constante
`PROPINAS` al inicio de `assets/js/menu.js`.

**Flecha de scroll.** Aparece cuando hay contenido abajo. Usa umbrales
distintos según el contexto: `UMBRAL_LISTA = 28` px en el listado y
`UMBRAL_DETALLE = 200` px en el detalle, porque el hero cuadrado hace que toda
ficha desborde un poco y no vale la pena anunciarlo.

---

## Accesibilidad

Áreas táctiles de 44 px o más en todos los controles. Foco visible con
`:focus-visible`. Tecla Escape cierra hoja, detalle y estimado en ese orden.
El foco vuelve al elemento de origen al cerrar. Los cambios en el estimado se
anuncian por `aria-live`. Contraste verificado: texto principal 17.4:1,
secundario 5.5:1, aquamarina sobre blanco 5.5:1. Se respeta
`prefers-reduced-motion`.

---

## Aún no incluido a propósito

Sin `.nojekyll`, sin workflow de GitHub Actions, sin manifest ni service
worker. Eso se agrega cuando las fotos disponibles estén cargadas y el menú se
dé por cerrado.

El `<meta name="robots" content="noindex">` está puesto a propósito mientras
sea prototipo. Quítalo cuando el menú vaya a ser público.
