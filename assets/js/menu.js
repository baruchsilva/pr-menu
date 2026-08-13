/* ============================================================
   Petit Roquefort — Menú web (MVP)
   Consulta únicamente. No envía datos a ningún servidor.
   ============================================================ */
(function () {
  "use strict";

  var MENU = window.MENU;
  var FOTOS = window.FOTOS || [];
  var STORE = "pr-estimado-v2";

  var PROPINAS = [10, 15, 20];
  var UMBRAL_LISTA = 28;     /* px restantes para mostrar la flecha en el listado */
  var UMBRAL_DETALLE = 200;  /* en el detalle solo si queda un bloque real por leer */

  /* Índice de fotos reales: id -> ruta. Un id ausente usa la imagen de categoría. */
  var fotoDe = {};
  FOTOS.forEach(function (f) {
    if (typeof f === "string") fotoDe[f] = "img/platillos/" + f + ".webp";
    else if (f && f.id) fotoDe[f.id] = "img/platillos/" + f.id + "." + (f.ext || "jpg");
  });

  var ICO_GRUPO = {
    desayunos: "i-egg",
    comida: "i-sandwich",
    "cafe-bebidas": "i-coffee",
    barra: "i-beer",
    extras: "i-circleplus"
  };

  var $ = function (id) { return document.getElementById(id); };
  var elMenu = $("scMenu"), elDet = $("scDet"), elEst = $("scEst");
  var elCn = $("catnav"), elLs = $("list"), elQ = $("q");
  var elHint = $("hint"), elBd = $("badge"), elAviso = $("aviso");
  var elOvs = $("ovs"), elSh = $("sheet");

  var cats = MENU.categorias.slice().sort(function (a, b) { return a.orden - b.orden; });
  var ci = 0, cart = cargar(), detId = null, detQty = 1, ultimoFoco = null;

  /* ---------- Utilidades ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function mxn(n) { return "$" + n.toLocaleString("es-MX"); }
  function ico(n, cl) {
    return '<svg class="ic ' + (cl || "") + '" aria-hidden="true"><use href="#' + n + '"/></svg>';
  }
  function prod(id) {
    for (var i = 0; i < MENU.productos.length; i++) if (MENU.productos[i].id === id) return MENU.productos[i];
    return null;
  }
  function cat(id) {
    for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i];
    return null;
  }
  function grupo(gid) {
    for (var i = 0; i < MENU.grupos.length; i++) if (MENU.grupos[i].id === gid) return MENU.grupos[i];
    return { id: gid, nombre: "" };
  }
  function prodsDe(cid) {
    return MENU.productos.filter(function (p) { return p.categoria === cid; });
  }
  function imagen(p) {
    if (fotoDe[p.id]) return fotoDe[p.id];
    if (p.categoria === "extras") return "img/categorias/extras.webp";
    return "img/categorias/" + p.categoria + ".svg";
  }
  function cargar() {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { return []; }
  }
  function guardar() {
    try { localStorage.setItem(STORE, JSON.stringify(cart)); } catch (e) { /* modo privado */ }
  }
  /* El contenedor .app nunca debe desplazarse: si algo lo mueve, se corrige */
  var elApp = document.querySelector(".app");
  function fijarApp() {
    if (elApp.scrollLeft !== 0) elApp.scrollLeft = 0;
    if (elApp.scrollTop !== 0) elApp.scrollTop = 0;
  }
  elApp.addEventListener("scroll", fijarApp, { passive: true });

  function anunciar(txt) {
    elAviso.textContent = "";
    setTimeout(function () { elAviso.textContent = txt; }, 40);
  }

  /* ---------- Extras: resuelve nombre y precio contra el catálogo ---------- */
  function extrasDe(p) {
    if (!p.extras || !p.extras.length) return [];
    return p.extras.map(function (e) {
      var base = null;
      for (var i = 0; i < MENU.modificadores.catalogo.length; i++) {
        if (MENU.modificadores.catalogo[i].id === e.ref) { base = MENU.modificadores.catalogo[i]; break; }
      }
      base = base || {};
      var precio = e.precio !== undefined ? e.precio : base.precio;
      return {
        ref: e.ref,
        nombre: e.nombre || base.nombre || e.ref,
        rango: Array.isArray(precio) ? precio : null,
        precio: Array.isArray(precio) ? precio[0] : precio
      };
    }).filter(function (e) { return typeof e.precio === "number"; });
  }
  function necesitaHoja(p) {
    return Array.isArray(p.precios) || extrasDe(p).length > 0;
  }

  /* ---------- Estimado ---------- */
  function clave(id, v, ex) { return id + "|" + (v || "") + "|" + ex.slice().sort().join(","); }
  function precioLinea(l) {
    var p = prod(l.id), base = 0;
    if (l.v && Array.isArray(p.precios)) {
      for (var i = 0; i < p.precios.length; i++) if (p.precios[i].nombre === l.v) base = p.precios[i].precio;
    } else base = p.precio || 0;
    extrasDe(p).forEach(function (e) { if (l.ex.indexOf(e.ref) > -1) base += e.precio; });
    return base;
  }
  function totalItems() { return cart.reduce(function (a, l) { return a + l.q; }, 0); }
  function subtotal() { return cart.reduce(function (a, l) { return a + precioLinea(l) * l.q; }, 0); }
  function qtyDe(id) {
    return cart.filter(function (l) { return l.id === id; }).reduce(function (a, l) { return a + l.q; }, 0);
  }
  function agregar(id, v, ex, q) {
    var k = clave(id, v, ex), linea = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].k === k) linea = cart[i];
    if (linea) linea.q += q;
    else cart.push({ k: k, id: id, v: v || null, ex: ex, q: q });
    sync();
    anunciar(prod(id).nombre + " agregado. " + totalItems() + " en el estimado.");
  }
  function quitarUno(id) {
    var ls = cart.filter(function (l) { return l.id === id; });
    if (!ls.length) return;
    var l = ls[ls.length - 1];
    l.q--;
    if (l.q <= 0) cart = cart.filter(function (x) { return x.k !== l.k; });
    sync();
    anunciar(prod(id).nombre + " quitado. " + totalItems() + " en el estimado.");
  }
  function cambiar(k, d) {
    var l = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].k === k) l = cart[i];
    if (!l) return;
    l.q += d;
    if (l.q <= 0) cart = cart.filter(function (x) { return x.k !== k; });
    sync();
  }
  function sync() {
    guardar();
    elBd.textContent = totalItems() || "";
    var s = elLs.scrollTop;
    renderMenu();
    elLs.scrollTop = s;
    if (!elEst.classList.contains("off")) renderEstimado();
  }

  /* ---------- Flecha de scroll ---------- */
  function revisarHint(el, btn, umbral) {
    if (!el || !btn) return;
    btn.classList.toggle("hide", el.scrollHeight - el.scrollTop - el.clientHeight < umbral);
  }

  /* ---------- Listado ---------- */
  function precioHTML(p) {
    if (Array.isArray(p.precios)) {
      return p.precios.map(function (v) {
        return '<span class="pz">' + mxn(v.precio) + "<small>" + esc(v.nombre) + "</small></span>";
      }).join(" &nbsp; ");
    }
    return '<span class="pz">' + mxn(p.precio) + "</span>";
  }

  function itemHTML(p) {
    var q = qtyDe(p.id), mini = p.categoria === "extras";
    var h = '<article class="item' + (mini ? " mini" : "") + '" data-abrir="' + p.id + '">';
    h += '<div class="info"><p class="nm">' + esc(p.nombre) + (fotoDe[p.id] ? ico("i-camera", "xs") : "") + "</p>";
    if (p.descripcion) h += '<p class="ds">' + esc(p.descripcion) + "</p>";
    h += precioHTML(p) + '</div><div class="ctl"><span class="qn">' + (q ? "x" + q : "") + "</span>";
    if (q) {
      h += '<div class="step"><button type="button" data-menos="' + p.id + '" aria-label="Quitar uno de ' + esc(p.nombre) + '">' +
        ico("i-minus", "sm") + '</button><button type="button" data-mas="' + p.id + '" aria-label="Agregar uno de ' + esc(p.nombre) + '">' +
        ico("i-plus", "sm") + "</button></div>";
    } else {
      h += '<div class="step solo"><button type="button" data-mas="' + p.id + '" aria-label="Agregar ' + esc(p.nombre) + '">' +
        ico("i-plus", "sm") + "</button></div>";
    }
    return h + "</div></article>";
  }

  function renderMenu() {
    var t = elQ.value.trim().toLowerCase();

    if (t) {
      elCn.innerHTML = '<div class="cnm"><span class="g">' + ico("i-search", "xs") +
        'Búsqueda</span><span class="c">' + esc(elQ.value) + "</span></div>";
      var bloques = cats.map(function (c) {
        var hits = prodsDe(c.id).filter(function (p) {
          return (p.nombre + " " + (p.descripcion || "")).toLowerCase().indexOf(t) > -1;
        });
        if (!hits.length) return "";
        return '<p class="cnote" style="background:none;padding:4px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:11px;color:var(--teal);margin:10px 0 6px">' +
          esc(c.nombre) + "</p>" + hits.map(itemHTML).join("");
      }).filter(Boolean);
      elLs.innerHTML = bloques.length ? bloques.join("")
        : '<p class="empty">No encontramos platillos con <strong>' + esc(elQ.value) +
          "</strong>.<br>Prueba con otra palabra.</p>";
      requestAnimationFrame(function () { revisarHint(elLs, elHint, UMBRAL_LISTA); });
      return;
    }

    var c = cats[ci], g = grupo(c.grupo);
    elCn.innerHTML =
      '<button type="button" class="arw" id="pv"' + (ci === 0 ? " disabled" : "") + ' aria-label="Categoría anterior">' + ico("i-left") + "</button>" +
      '<span class="cnm"><span class="g">' + ico(ICO_GRUPO[c.grupo] || "i-circleplus", "xs") + esc(g.nombre) +
      '</span><span class="c">' + esc(c.nombre) + "</span></span>" +
      '<button type="button" class="arw" id="nx"' + (ci === cats.length - 1 ? " disabled" : "") + ' aria-label="Categoría siguiente">' + ico("i-right") + "</button>";

    var dots = '<div class="dots" aria-hidden="true">' + cats.map(function (x, i) {
      return '<span class="dot' + (i === ci ? " on" : "") + '"></span>';
    }).join("") + "</div>";

    elLs.innerHTML = dots +
      (c.nota ? '<p class="cnote">' + ico("i-circleplus", "xs") + esc(c.nota) + "</p>" : "") +
      prodsDe(c.id).map(itemHTML).join("");
    requestAnimationFrame(function () { revisarHint(elLs, elHint, UMBRAL_LISTA); });
  }

  /* ---------- Detalle ---------- */
  function abrirDetalle(id) {
    detId = id; detQty = 1;
    ultimoFoco = document.activeElement;
    var p = prod(id), c = cat(p.categoria), ex = extrasDe(p);

    var h = '<div class="dwrap"><div class="dscroll" id="dsc">';
    h += '<div class="dhero"><img src="' + imagen(p) + '" alt="' + esc(p.nombre) + '" id="dimg">' +
      (fotoDe[p.id] ? "" : '<span class="dgen">' + ico("i-imgoff", "xs") + "Imagen representativa</span>") + "</div>";
    h += '<div class="dbody"><p class="dcat">' + ico(ICO_GRUPO[c.grupo] || "i-circleplus", "xs") + esc(c.nombre) + "</p>";
    h += '<div class="dtop"><h2 id="det-titulo">' + esc(p.nombre) + "</h2>";
    h += '<span class="dpz">' + (Array.isArray(p.precios) ? mxn(p.precios[0].precio) + "<small>desde</small>" : mxn(p.precio)) + "</span></div>";
    h += p.descripcion ? '<p class="ddesc">' + esc(p.descripcion) + "</p>"
      : '<p class="ddesc na">Este platillo no trae descripción en el menú.</p>';
    if (p.categoria === "extras") {
      h += '<p class="ddesc libre">Se puede pedir solo o junto con cualquier platillo del menú.</p>';
    }
    if (Array.isArray(p.precios)) {
      h += '<div class="dext"><h3>Presentaciones</h3>' + p.precios.map(function (v) {
        return '<div class="er"><span>' + esc(v.nombre) + "</span><b>" + mxn(v.precio) + "</b></div>";
      }).join("") + "</div>";
    }
    if (ex.length) {
      h += '<div class="dext"><h3>Extras disponibles</h3>' + ex.map(function (e) {
        return '<div class="er"><span>' + esc(e.nombre) + "</span><b>+" +
          (e.rango ? "$" + e.rango.join(" / $") : mxn(e.precio)) + "</b></div>";
      }).join("") + "</div>";
    }
    h += "</div></div>";
    h += '<button type="button" class="dback" id="db" aria-label="Volver al menú">' + ico("i-left", "lg") + "</button>";
    h += '<button type="button" class="hint hide" id="dhint" aria-label="Ver más contenido">' + ico("i-down", "sm") + "</button></div>";
    h += '<div class="dfoot"><div class="dstep">' +
      '<button type="button" data-paso="-1" aria-label="Menos">' + ico("i-minus", "sm") + "</button>" +
      '<span id="dq" aria-live="polite">1</span>' +
      '<button type="button" data-paso="1" aria-label="Más">' + ico("i-plus", "sm") + "</button></div>" +
      '<button type="button" class="dadd" id="da">' + ico("i-basket", "sm") + "Agregar al estimado</button></div>";

    elDet.innerHTML = h;
    elDet.classList.remove("off");
    fijarApp();
    elDet.querySelector("#db").focus({ preventScroll: true });

    var ds = $("dsc"), hb = $("dhint"), im = $("dimg");
    var chequear = function () { revisarHint(ds, hb, UMBRAL_DETALLE); };
    ds.addEventListener("scroll", chequear);
    if (im.complete) requestAnimationFrame(chequear);
    else im.addEventListener("load", function () { requestAnimationFrame(chequear); });
    if (window.ResizeObserver) new ResizeObserver(chequear).observe(ds);
  }
  function cerrarDetalle() {
    elDet.classList.add("off");
    if (ultimoFoco) ultimoFoco.focus({ preventScroll: true });
  }

  /* ---------- Estimado ---------- */
  function renderEstimado() {
    var h = '<div class="ehead"><button type="button" class="eback" id="eb" aria-label="Volver al menú">' +
      ico("i-left", "lg") + '</button><h2>Mi estimado</h2></div><div class="ebody">';

    if (!cart.length) {
      h += '<p class="empty">Tu estimado está vacío.<br>Toca <strong>+</strong> en cualquier platillo para irlo armando.</p></div>';
      elEst.innerHTML = h;
      elEst.classList.remove("off");
      fijarApp();
      elEst.querySelector("#eb").focus({ preventScroll: true });
      return;
    }

    var s = subtotal();
    h += cart.map(function (l) {
      var p = prod(l.id), meta = [];
      if (l.v) meta.push(l.v);
      extrasDe(p).forEach(function (e) { if (l.ex.indexOf(e.ref) > -1) meta.push("+ " + e.nombre); });
      return '<div class="line"><div class="li"><p class="ln">' + esc(p.nombre) + "</p>" +
        (meta.length ? '<p class="lm">' + esc(meta.join(" · ")) + "</p>" : "") + "</div>" +
        '<div class="lq"><button type="button" data-q="-1" data-k="' + esc(l.k) + '" aria-label="Quitar uno de ' + esc(p.nombre) + '">' +
        ico("i-minus", "xs") + "</button><span>" + l.q + "</span>" +
        '<button type="button" data-q="1" data-k="' + esc(l.k) + '" aria-label="Agregar uno de ' + esc(p.nombre) + '">' +
        ico("i-plus", "xs") + "</button></div>" +
        '<span class="lp">' + mxn(precioLinea(l) * l.q) + "</span></div>";
    }).join("");

    h += '<div class="tot"><div class="row sub"><span class="lbl">Subtotal</span><span class="val">' + mxn(s) + "</span></div>";
    PROPINAS.forEach(function (t) {
      var v = Math.round(s * t / 100);
      h += '<div class="row hi"><span class="lbl">Con ' + t + "% de propina" +
        '<span class="tn">propina ' + mxn(v) + "</span></span>" +
        '<span class="val">' + mxn(s + v) + "</span></div>";
    });
    h += "</div>";

    h += '<p class="disc">Estimado informativo, calculado con los precios del menú impreso. ' +
      "No es una orden ni una cuenta: no se envía nada al restaurante. La propina es voluntaria " +
      "y la defines tú al pagar.</p>";
    h += '<button type="button" class="rst" id="rst">' + ico("i-trash", "sm") + "Vaciar estimado</button></div>";

    elEst.innerHTML = h;
    elEst.classList.remove("off");
  }

  /* ---------- Hoja de opciones ---------- */
  function abrirHoja(id, q) {
    var p = prod(id), ex = extrasDe(p);
    var h = '<div class="shh"><h3 id="hoja-titulo">' + esc(p.nombre) +
      '</h3><button type="button" class="close" data-cerrar aria-label="Cerrar">' + ico("i-x", "sm") + "</button></div><div class=\"shb\">";
    if (Array.isArray(p.precios)) {
      h += '<div class="og"><p>Elige presentación</p>';
      p.precios.forEach(function (v, i) {
        h += '<label class="opt"><input type="radio" name="vv" value="' + esc(v.nombre) + '"' + (i === 0 ? " checked" : "") +
          '><span class="on2">' + esc(v.nombre) + '</span><span class="op">' + mxn(v.precio) + "</span></label>";
      });
      h += "</div>";
    }
    if (ex.length) {
      h += '<div class="og"><p>Extras (opcional)</p>';
      ex.forEach(function (e) {
        h += '<label class="opt"><input type="checkbox" name="ee" value="' + esc(e.ref) + '">' +
          '<span class="on2">' + esc(e.nombre) + (e.rango ? " (porción menor)" : "") + "</span>" +
          '<span class="op">+' + mxn(e.precio) + "</span></label>";
      });
      h += "</div>";
    }
    h += '<button type="button" class="conf" data-ok="' + p.id + '" data-q="' + (q || 1) + '">' +
      ico("i-basket", "sm") + "Agregar al estimado</button></div>";
    elSh.innerHTML = h;
    elOvs.classList.add("open");
    fijarApp();
    elSh.querySelector(".close").focus({ preventScroll: true });
  }
  function cerrarHoja() {
    elOvs.classList.remove("open");
    elSh.innerHTML = "";
  }

  /* ---------- Eventos ---------- */
  elLs.addEventListener("scroll", function () { revisarHint(elLs, elHint, UMBRAL_LISTA); });
  elHint.addEventListener("click", function () {
    elLs.scrollBy({ top: elLs.clientHeight * 0.78, behavior: "smooth" });
  });

  elLs.addEventListener("click", function (e) {
    var mas = e.target.closest("[data-mas]");
    if (mas) {
      e.stopPropagation();
      var p = prod(mas.dataset.mas);
      return necesitaHoja(p) ? abrirHoja(p.id, 1) : agregar(p.id, null, [], 1);
    }
    var menos = e.target.closest("[data-menos]");
    if (menos) { e.stopPropagation(); return quitarUno(menos.dataset.menos); }
    var it = e.target.closest("[data-abrir]");
    if (it) abrirDetalle(it.dataset.abrir);
  });

  elCn.addEventListener("click", function (e) {
    if (e.target.closest("#pv") && ci > 0) { ci--; renderMenu(); elLs.scrollTop = 0; }
    if (e.target.closest("#nx") && ci < cats.length - 1) { ci++; renderMenu(); elLs.scrollTop = 0; }
  });

  elDet.addEventListener("click", function (e) {
    if (e.target.closest("#db")) return cerrarDetalle();
    if (e.target.closest("#dhint")) {
      var ds = $("dsc");
      return ds.scrollBy({ top: ds.clientHeight * 0.7, behavior: "smooth" });
    }
    var paso = e.target.closest("[data-paso]");
    if (paso) {
      detQty = Math.max(1, detQty + parseInt(paso.dataset.paso, 10));
      $("dq").textContent = detQty;
      return;
    }
    if (e.target.closest("#da")) {
      var p = prod(detId);
      if (necesitaHoja(p)) abrirHoja(detId, detQty);
      else { agregar(detId, null, [], detQty); cerrarDetalle(); }
    }
  });

  elEst.addEventListener("click", function (e) {
    if (e.target.closest("#eb")) { elEst.classList.add("off"); $("bskt").focus({ preventScroll: true }); return; }
    var q = e.target.closest("[data-q]");
    if (q) return cambiar(q.dataset.k, parseInt(q.dataset.q, 10));
    if (e.target.closest("#rst")) { cart = []; sync(); anunciar("Estimado vaciado."); }
  });

  $("bskt").addEventListener("click", function () { renderEstimado(); });

  elSh.addEventListener("click", function (e) {
    if (e.target.closest("[data-cerrar]")) return cerrarHoja();
    var ok = e.target.closest("[data-ok]");
    if (ok) {
      var v = elSh.querySelector('input[name="vv"]:checked');
      var ex = [].map.call(elSh.querySelectorAll('input[name="ee"]:checked'), function (i) { return i.value; });
      agregar(ok.dataset.ok, v ? v.value : null, ex, parseInt(ok.dataset.q, 10));
      cerrarHoja();
      cerrarDetalle();
    }
  });
  elOvs.addEventListener("click", function (e) { if (e.target === elOvs) cerrarHoja(); });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (elOvs.classList.contains("open")) cerrarHoja();
    else if (!elDet.classList.contains("off")) cerrarDetalle();
    else if (!elEst.classList.contains("off")) elEst.classList.add("off");
  });

  var t;
  elQ.addEventListener("input", function () {
    clearTimeout(t);
    t = setTimeout(renderMenu, 140);
  });

  /* ---------- Arranque ---------- */
  elBd.textContent = totalItems() || "";
  renderMenu();
})();
