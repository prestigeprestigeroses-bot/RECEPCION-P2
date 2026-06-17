let scrollBloqueado = false;
let scrollX = 0;
let scrollY = 0;

function bloquearScroll() {
  scrollX = window.scrollX;
  scrollY = window.scrollY;
  scrollBloqueado = true;
}

function restaurarScroll() {
  if (!scrollBloqueado) return;
  scrollBloqueado = false;
}

/////////////////////// CLAVE ///////////////////////////////

const CLAVE = "123"; // cámbiala

function pedirAcceso() {
  const guardado = localStorage.getItem("acceso_ok");

  if (guardado === "true") return true;

  const intento = prompt("Ingrese contraseña:");

  if (intento === CLAVE) {
    localStorage.setItem("acceso_ok", "true");
    return true;
  }

  alert("Acceso denegado");
  location.reload();
  return false;
}

/////////////////////// CLAVE ////////////////////////////////

let viajeActivo = "";
let cacheDetalle = [];
let autoRefreshTimer = null;
let escaneando = false;
let ultimoAcumulado = null;
let mostrandoRegistrosHistoricos = false;
let timerOcultarRegistrosHistoricos = null;
let timerRefrescoPostEscaneo = null;
let timerRefrescoConsultaGeneral = null;
let resumenGeneralOperando = false;
let sincronizandoOffline = false;

let duplicadosSesionActual = 0;
let erroresSesionActual = 0;


const modalYaRegistrados = document.getElementById("modal-ya-registrados");
const modalYaRegistradosBody = document.getElementById("modal-ya-registrados-body");
const cerrarModalYaRegistrados = document.getElementById("cerrar-modal-ya-registrados");

let cacheYaRegistrados = [];

const cardErrores = document.getElementById("card-errores");
const cardYaRegistrados = document.getElementById("card-ya-registrados");

const finalizarBtn = document.getElementById("finalizar-viaje-btn");
const verRegistrosViajeBtn = document.getElementById("ver-registros-viaje-btn");
const ocultarRegistrosViajeBtn = document.getElementById("ocultar-registros-viaje-btn");

const barcodeVisible = document.getElementById("barcode-visible");
const cardDuplicados = document.getElementById("card-duplicados");
const formInput = document.getElementById("form");
const statusBar = document.getElementById("status-bar");
const internetStatus = document.getElementById("internet-status");
const resumenVariedadBody = document.getElementById("resumen-variedad-body");
const viajeActivoLabel = document.getElementById("viaje-activo-label");
const totalEscaneados = document.getElementById("total-escaneados");
const totalDuplicados = document.getElementById("total-duplicados");
const totalErrores = document.getElementById("total-errores");
const totalAcumuladoGeneral = document.getElementById("total-acumulado-general");
const barcodeInput = document.getElementById("barcode");
window.barcodeInput = barcodeInput;
const pivotBody = document.getElementById("pivot-body");
const detalleBody = document.getElementById("detalle-body");
const yaRegistradosLista = document.getElementById("ya-registrados-lista");
const resumenVariedadGlobalBox = document.getElementById("resumen-variedad-global-box");
const nombreVariedadGlobal = document.getElementById("nombre-variedad-global");
const totalTabacosVariedadGlobal = document.getElementById("total-tabacos-variedad-global");
const totalTallosVariedadGlobal = document.getElementById("total-tallos-variedad-global");

const contadorGeneralBd = document.getElementById("contador-general-bd");
const contadorTallosGeneralBd = document.getElementById("contador-tallos-general-bd");
const bloqueGeneralSelect = document.getElementById("bloque-general-select");
const variedadGeneralSelect = document.getElementById("variedad-general-select");
const variedadGlobalSelect = document.getElementById("variedad-global-select");
const generalBloqueBody = document.getElementById("general-bloque-body");
const generalBloqueDetalleBody = document.getElementById("general-bloque-detalle-body");
const totalTabacosFiltro = document.getElementById("total-tabacos-filtro");
const totalTallosFiltro = document.getElementById("total-tallos-filtro");

const btnToggleDetalleFiltro = document.getElementById("btnToggleDetalleFiltro");
const detalleFiltroBox = document.getElementById("detalleFiltroBox");
const btnToggleUltimosRegistros = document.getElementById("btnToggleUltimosRegistros");
const ultimosRegistrosBox = document.getElementById("ultimosRegistrosBox");

function detalleFiltroEstaAbierto() {
  return !!detalleFiltroBox?.classList.contains("open");
}

function ultimosRegistrosEstaVisible() {
  return !ultimosRegistrosBox || !ultimosRegistrosBox.classList.contains("collapsed-panel");
}

async function cargarDetalleFiltroActual() {
  if (!detalleFiltroEstaAbierto()) return;

  const variedadGlobalSeleccionada = variedadGlobalSelect?.value || "";
  if (variedadGlobalSeleccionada) {
    await cargarDetalleGeneralPorVariedadGlobal(variedadGlobalSeleccionada);
    return;
  }

  const bloque = bloqueGeneralSelect?.value || "";
  const variedad = variedadGeneralSelect?.value || "";
  if (bloque) {
    await cargarDetalleGeneralPorBloque(bloque, variedad);
  }
}

if (btnToggleDetalleFiltro && detalleFiltroBox) {
  btnToggleDetalleFiltro.addEventListener("click", async () => {
    const isOpen = detalleFiltroBox.classList.toggle("open");
    btnToggleDetalleFiltro.textContent = isOpen ? "Ocultar detalle" : "Mostrar detalle";

    if (isOpen) {
      await cargarDetalleFiltroActual();
    }
  });
}

if (btnToggleUltimosRegistros && ultimosRegistrosBox) {
  btnToggleUltimosRegistros.addEventListener("click", () => {
    const isHidden = ultimosRegistrosBox.classList.toggle("collapsed-panel");
    btnToggleUltimosRegistros.textContent = isHidden ? "Mostrar" : "Ocultar";
  });
}


function setText(el, value) {
  if (el) el.textContent = value;
}

function setHTML(el, value) {
  if (el) el.innerHTML = value;
}

async function fetchConTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function esErrorTimeout(error) {
  return error?.name === "AbortError";
}

function programarRefrescoPostEscaneo() {
  if (timerRefrescoPostEscaneo) {
    clearTimeout(timerRefrescoPostEscaneo);
  }

  timerRefrescoPostEscaneo = setTimeout(() => {
    timerRefrescoPostEscaneo = null;

    conservarPosicionPantalla(async () => {
      await refrescarResumenDesdeBD();
      await refrescarPivot();
      await cargarContadorGeneralBD();
      programarRefrescoConsultaGeneral();
    });
  }, 900);
}

function programarRefrescoConsultaGeneral(delay = 700) {
  if (timerRefrescoConsultaGeneral) {
    clearTimeout(timerRefrescoConsultaGeneral);
  }

  timerRefrescoConsultaGeneral = setTimeout(async () => {
    timerRefrescoConsultaGeneral = null;
    await refrescarConsultaGeneralActual();
  }, delay);
}

async function refrescarConsultaGeneralActual() {
  const bloqueSeleccionado = bloqueGeneralSelect?.value || "";
  const variedadSeleccionada = variedadGeneralSelect?.value || "";
  const variedadGlobalSeleccionada = variedadGlobalSelect?.value || "";

  await Promise.all([
    cargarContadorGeneralBD(),
    cargarBloquesGenerales(),
    cargarVariedadesGlobales()
  ]);

  if (variedadGlobalSeleccionada) {
    if (variedadGlobalSelect) {
      variedadGlobalSelect.value = variedadGlobalSeleccionada;
    }

    await cargarResumenGeneralPorVariedadGlobal(variedadGlobalSeleccionada);
    if (detalleFiltroEstaAbierto()) {
      await cargarDetalleGeneralPorVariedadGlobal(variedadGlobalSeleccionada);
    }
    return;
  }

  if (bloqueSeleccionado) {
    if (bloqueGeneralSelect) {
      bloqueGeneralSelect.value = bloqueSeleccionado;
    }

    await cargarVariedadesGeneralesPorBloque(bloqueSeleccionado, variedadSeleccionada);

    if (variedadGeneralSelect) {
      variedadGeneralSelect.value = variedadSeleccionada;
    }

    await cargarResumenGeneralPorBloque(bloqueSeleccionado, variedadSeleccionada);
    if (detalleFiltroEstaAbierto()) {
      await cargarDetalleGeneralPorBloque(bloqueSeleccionado, variedadSeleccionada);
    }
  }
}

function agregarRegistroProcesadoVisual(data, resultado) {
  if (!data || !["OK", "REREGISTRADO"].includes(resultado)) return;

  quitarRegistroPendienteVisual(data.barcode);

  const row = {
    fecha: new Date().toISOString(),
    viaje: viajeActivo,
    barcode: data.barcode || "",
    tipo: data.tipo || "",
    serial: data.serial || "",
    bloque: data.bloque || "",
    variedad: data.variedad || "",
    tamano: data.tamano || "",
    tallos: data.tallos || "",
    etapa: data.etapa || "Ingreso",
    form: data.form || formInput?.value?.trim() || "",
    resultado,
    observacion: data.observacion || "",
    barcode_origen: data.barcode_origen || null,
  };

  cacheDetalle.unshift(row);

  if (!mostrandoRegistrosHistoricos) {
    renderDetalle(cacheDetalle);
    refrescarResumenPorVariedad();
  }
}

function agregarRegistroPendienteVisual(barcode, viajeRegistro) {
  if (viajeRegistro !== viajeActivo || mostrandoRegistrosHistoricos) return;

  const codigo = normalizarBarcode(barcode);
  if (!codigo) return;

  const yaExiste = cacheDetalle.some((row) => normalizarBarcode(row.barcode) === codigo);
  if (yaExiste) return;

  const datos = obtenerDatosOfflinePorBarcode(codigo);

  cacheDetalle.unshift({
    fecha: new Date().toISOString(),
    viaje: viajeRegistro,
    barcode: codigo,
    tipo: datos.tipo || "",
    serial: datos.serial || "",
    bloque: datos.bloque || "Procesando",
    variedad: datos.variedad || "Procesando",
    tamano: datos.tamano || "",
    tallos: datos.tallos || "",
    etapa: "Ingreso",
    form: formInput?.value?.trim() || "",
    resultado: "PROCESANDO",
    observacion: "Procesando registro..."
  });

  renderDetalle(cacheDetalle);
}

function quitarRegistroPendienteVisual(barcode) {
  const codigo = normalizarBarcode(barcode);
  if (!codigo) return;

  const antes = cacheDetalle.length;
  cacheDetalle = cacheDetalle.filter((row) => {
    return !(row.resultado === "PROCESANDO" && normalizarBarcode(row.barcode) === codigo);
  });

  if (antes !== cacheDetalle.length && !mostrandoRegistrosHistoricos) {
    renderDetalle(cacheDetalle);
  }
}

function actualizarRegistroPendienteVisual(barcode, observacion) {
  const codigo = normalizarBarcode(barcode);
  const row = cacheDetalle.find((item) => {
    return item.resultado === "PROCESANDO" && normalizarBarcode(item.barcode) === codigo;
  });

  if (!row) return;

  row.observacion = observacion;

  if (!mostrandoRegistrosHistoricos) {
    renderDetalle(cacheDetalle);
  }
}

function quitarRegistroVisualPorBarcode(barcode) {
  const codigo = normalizarBarcode(barcode);
  cacheDetalle = cacheDetalle.filter((row) => normalizarBarcode(row.barcode) !== codigo);

  if (!mostrandoRegistrosHistoricos) {
    renderDetalle(cacheDetalle);
    refrescarResumenPorVariedad();
  }
}

function quitarRegistroVisualPorGrupo(data) {
  const index = cacheDetalle.findIndex((row) => {
    if (!["OK", "REREGISTRADO", "OFFLINE"].includes(row.resultado)) return false;

    return String(row.bloque || "") === String(data.bloque || "") &&
      String(row.variedad || "") === String(data.variedad || "") &&
      String(row.tamano || "") === String(data.tamano || "") &&
      Number(row.tallos || 0) === Number(data.tallos || 0) &&
      String(row.form || "") === String(data.form || "") &&
      String(row.etapa || "Ingreso") === String(data.etapa || "Ingreso") &&
      String(row.tipo || "") === String(data.tipo || "");
  });

  if (index >= 0) {
    const eliminado = cacheDetalle.splice(index, 1)[0];

    if (!mostrandoRegistrosHistoricos) {
      renderDetalle(cacheDetalle);
      refrescarResumenPorVariedad();
    }

    return eliminado;
  }

  refrescarResumenPorVariedad();
  return null;
}

function normalizarBarcode(valor) {
  return String(valor || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .trim();
}
// =====================================================
// BASE LOCAL OFFLINE - INDEXEDDB
// Guarda registros cuando no hay internet
// =====================================================

const OFFLINE_DB_NAME = "poscosecha_offline_db";
const OFFLINE_DB_VERSION = 2;
const OFFLINE_STORE = "registros_pendientes";

function abrirDBOffline() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        const store = db.createObjectStore(OFFLINE_STORE, {
          keyPath: "id",
          autoIncrement: true
        });

        store.createIndex("estado", "estado", { unique: false });
        store.createIndex("barcode", "barcode", { unique: false });
        store.createIndex("viaje", "viaje", { unique: false });
        store.createIndex("created_at_local", "created_at_local", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function guardarRegistroOffline(payload) {
  const db = await abrirDBOffline();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_STORE);

    const registro = {
      ...payload,
      estado: "PENDIENTE",
      created_at_local: new Date().toISOString()
    };

    const request = store.add(registro);

    request.onsuccess = () => resolve({
      ...registro,
      id: request.result
    });
    request.onerror = () => reject(request.error);
  });
}

async function obtenerRegistrosOfflinePendientes() {
  const db = await abrirDBOffline();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readonly");
    const store = tx.objectStore(OFFLINE_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const data = request.result || [];
      resolve(data.filter((x) => x.estado === "PENDIENTE"));
    };

    request.onerror = () => reject(request.error);
  });
}

async function obtenerRegistrosOfflinePendientesPorViaje(viaje) {
  const pendientes = await obtenerRegistrosOfflinePendientes();
  const viajeTexto = String(viaje || "").trim();

  return pendientes.filter((item) => String(item.viaje || "").trim() === viajeTexto);
}

async function contarRegistrosOfflinePendientes(viaje) {
  const pendientes = await obtenerRegistrosOfflinePendientesPorViaje(viaje);
  return pendientes.length;
}

async function eliminarRegistroOffline(id) {
  const db = await abrirDBOffline();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function existeRegistroOfflinePendiente(barcode) {
  const pendientes = await obtenerRegistrosOfflinePendientes();

  const codigo = normalizarBarcode(barcode);

  return pendientes.some((item) => {
    return normalizarBarcode(item.barcode) === codigo;
  });
}

function agregarRegistroOfflineVisual(payload) {
  const row = {
    fecha: new Date().toISOString(),
    barcode: payload.barcode,
    bloque: "Pendiente",
    variedad: "Pendiente de sincronizar",
    tamano: "",
    tallos: "",
    form: payload.form || "",
    resultado: "OFFLINE",
    observacion: "Guardado localmente. Pendiente de sincronización."
  };

  cacheDetalle.unshift(row);
  renderDetalle(cacheDetalle);
}
const TIPOS_CACHE_KEY = "poscosecha_tipos_cache";

function obtenerTiposCache() {
  try {
    return JSON.parse(localStorage.getItem(TIPOS_CACHE_KEY) || "{}");
  } catch (err) {
    return {};
  }
}

function guardarTiposCache(data) {
  const cache = {};

  (data || []).forEach((row) => {
    const tipo = String(row.tipo || "").toUpperCase().trim();
    if (!tipo) return;
    cache[tipo] = row;
  });

  localStorage.setItem(TIPOS_CACHE_KEY, JSON.stringify(cache));
}

async function cargarCatalogoTiposOffline() {
  try {
    const res = await fetch("/api/tipos-variedad");
    if (!res.ok) return;

    const json = await res.json();
    if (!json.ok || !Array.isArray(json.data)) return;

    guardarTiposCache(json.data);
  } catch (err) {
    console.warn("No se pudo actualizar el catalogo offline de tipos:", err);
  }
}

function obtenerDatosOfflinePorBarcode(barcode) {
  const codigo = normalizarBarcode(barcode);
  const tipo = codigo.slice(0, 2);
  const serial = codigo.slice(2);
  const datos = obtenerTiposCache()[tipo] || {};

  return {
    tipo,
    serial,
    bloque: datos.bloque || "Pendiente",
    variedad: datos.variedad || "Pendiente de sincronizar",
    tamano: datos.tamano || "",
    tallos: datos.tallos || "",
  };
}

function crearFilaOfflineVisual(registro) {
  const datos = obtenerDatosOfflinePorBarcode(registro.barcode);

  return {
    id_offline: registro.id,
    fecha: registro.created_at_local || new Date().toISOString(),
    viaje: registro.viaje || viajeActivo,
    barcode: registro.barcode,
    tipo: datos.tipo,
    serial: datos.serial,
    bloque: datos.bloque,
    variedad: datos.variedad,
    tamano: datos.tamano,
    tallos: datos.tallos,
    form: registro.form || "",
    resultado: "LOCAL",
    observacion: "Guardado localmente. Enviando a la base de datos."
  };
}

function agregarRegistroOfflineVisual(registro) {
  const row = crearFilaOfflineVisual(registro);
  const yaExiste = cacheDetalle.some((item) => {
    if (row.id_offline && item.id_offline === row.id_offline) return true;

    return normalizarBarcode(item.barcode) === normalizarBarcode(row.barcode) &&
      ["OFFLINE", "LOCAL"].includes(item.resultado);
  });

  if (!yaExiste) {
    cacheDetalle.unshift(row);
  }

  renderDetalle(cacheDetalle);
  refrescarResumenPorVariedad();
}

async function pintarPendientesOfflineDelViaje() {
  if (!viajeActivo) return [];

  const pendientes = await obtenerRegistrosOfflinePendientesPorViaje(viajeActivo);
  let filasOffline = pendientes
    .sort((a, b) => new Date(b.created_at_local || 0) - new Date(a.created_at_local || 0))
    .map(crearFilaOfflineVisual);

  const barcodesOffline = new Set(filasOffline.map((row) => normalizarBarcode(row.barcode)));
  const detalleServidor = cacheDetalle
    .filter((row) => {
      if (!["OFFLINE", "LOCAL"].includes(row.resultado)) return true;
      return barcodesOffline.has(normalizarBarcode(row.barcode));
    })
    .filter((row) => !["OFFLINE", "LOCAL"].includes(row.resultado));
  const barcodesServidor = new Set(detalleServidor.map((row) => normalizarBarcode(row.barcode)));

  filasOffline = filasOffline.filter((row) => {
    return !barcodesServidor.has(normalizarBarcode(row.barcode));
  });

  cacheDetalle = [
    ...filasOffline,
    ...detalleServidor
  ];

  if (!mostrandoRegistrosHistoricos) {
    renderDetalle(cacheDetalle);
    refrescarResumenPorVariedad();
  }

  return pendientes;
}

async function actualizarTotalesConPendientesOffline(baseTotalActual = null, baseAcumuladoActual = null) {
  if (!viajeActivo) return;

  const pendientes = await contarRegistrosOfflinePendientes(viajeActivo);

  if (baseTotalActual !== null) {
    const base = Number(baseTotalActual || 0);
    const actualPantalla = Number(totalEscaneados?.textContent || 0);
    const total = sincronizandoOffline
      ? Math.max(base, actualPantalla)
      : base + pendientes;

    setText(totalEscaneados, total);
  }

  if (baseAcumuladoActual !== null) {
    const base = Number(baseAcumuladoActual || 0);
    const actualPantalla = Number(totalAcumuladoGeneral?.textContent || 0);
    const total = sincronizandoOffline
      ? Math.max(base, actualPantalla)
      : base + pendientes;

    setAcumuladoSeguro(total);
  }
}

function contarRegistrosValidosDelViaje(data = []) {
  return data.filter((row) => {
    return ["OK", "REREGISTRADO", "OFFLINE", "LOCAL"].includes(row.resultado);
  }).length;
}

async function recalcularTotalesViajeDesdeDetalle() {
  if (!viajeActivo) return;

  try {
    const res = await fetch(`/api/viajes/${encodeURIComponent(viajeActivo)}/detalle`);
    const json = res.ok ? await res.json() : { data: [] };
    const detalleBD = Array.isArray(json.data) ? json.data : [];
    const pendientes = await obtenerRegistrosOfflinePendientesPorViaje(viajeActivo);
    const barcodesBD = new Set(detalleBD.map((row) => normalizarBarcode(row.barcode)));
    const detalleOffline = pendientes
      .map(crearFilaOfflineVisual)
      .filter((row) => !barcodesBD.has(normalizarBarcode(row.barcode)));

    cacheDetalle = [
      ...detalleOffline,
      ...detalleBD
    ];

    const totalReal = contarRegistrosValidosDelViaje(cacheDetalle);
    setText(totalEscaneados, totalReal);
    setAcumuladoSeguro(totalReal);

    if (!mostrandoRegistrosHistoricos) {
      renderDetalle(cacheDetalle);
      refrescarResumenPorVariedad();
    }
  } catch (err) {
    console.error("Error recalculando totales reales del viaje:", err);
  }
}

async function sincronizarRegistrosOffline() {
  if (sincronizandoOffline) return;

  const pendientes = await obtenerRegistrosOfflinePendientes();

  if (!pendientes.length) {
    return;
  }

  sincronizandoOffline = true;
  setStatus(`Sincronizando ${pendientes.length} registros pendientes...`, "warn");

  let sincronizados = 0;
  let fallidos = 0;

  for (const item of pendientes) {
    try {
      const res = await fetchConTimeout("/api/escanear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          barcode: item.barcode,
          viaje: item.viaje,
          form: item.form || ""
        })
      }, 12000);

      const json = await res.json();

      if (res.ok && json.ok !== false) {
        await eliminarRegistroOffline(item.id);
        sincronizados += 1;

        if (json.resultado === "YA_REGISTRADO") {
          agregarYaRegistradoPanel(json.data || {}, item.barcode);
        }
      } else {
        fallidos += 1;
        console.warn("No se pudo sincronizar:", item, json);
      }

    } catch (err) {
      fallidos += 1;
      console.warn("Sin internet todavía. Pendiente:", item.barcode);
      break;
    }
  }

  sincronizandoOffline = false;

  if (sincronizados > 0) {
    setStatus(`Sincronizados ${sincronizados} registros pendientes`, "ok");

    await conservarPosicionPantalla(async () => {
      await refrescarResumen();
      await refrescarPivot();

      if (!mostrandoRegistrosHistoricos) {
        await refrescarDetalle();
      }

      await pintarPendientesOfflineDelViaje();

      await refrescarResumenDesdeBD();
      await recalcularTotalesViajeDesdeDetalle();
      await cargarContadorGeneralBD();
      programarRefrescoConsultaGeneral(200);
    });
  }

  if (fallidos > 0) {
    await pintarPendientesOfflineDelViaje();
    await actualizarTotalesConPendientesOffline();
    setStatus(`Quedan registros pendientes por sincronizar`, "warn");
  }

  const quedanPendientes = await obtenerRegistrosOfflinePendientes();
  if (quedanPendientes.length && navigator.onLine) {
    setTimeout(() => {
      sincronizarRegistrosOffline();
    }, 500);
  }
}
function setAcumuladoSeguro(valor) {
  if (valor !== ultimoAcumulado) {
    ultimoAcumulado = valor;
    setText(totalAcumuladoGeneral, valor);
  }
}

function focusBarcodeSeguro() {
  if (!barcodeInput) return;
  if (!puedeRecuperarFoco()) return;

  const activo = document.activeElement;
  const tag = activo?.tagName?.toLowerCase();

  if (tag === "select" || tag === "textarea") return;

  if (tag === "input" && activo !== barcodeInput) return;

  try {
    barcodeInput.focus({
      preventScroll: true
    });
  } catch (e) {
    // Evita focus sin preventScroll porque puede mover la pantalla.
  }
}

function focusBarcodeSinScroll() {
  focusBarcodeSeguro();
}

function recuperarLectorDespuesDeControl(control) {
  setTimeout(() => {
    try {
      control?.blur?.();
    } catch (e) {
      // Si el control ya no existe, solo intenta recuperar el lector.
    }

    activarLectorAutomatico(8, 120);
  }, 80);
}

function activarLectorAutomatico(intentos = 8, intervalo = 180) {
  let intentosHechos = 0;

  const intentar = () => {
    intentosHechos += 1;
    focusBarcodeSeguro();

    if (document.activeElement === barcodeInput || intentosHechos >= intentos) {
      return;
    }

    setTimeout(intentar, intervalo);
  };

  intentar();
}

function conservarPosicionPantalla(fn) {
  bloquearScroll();

  return Promise.resolve(fn())
    .finally(() => {
      restaurarScroll();
    });
}

function setStatus(texto, tipo = "neutral") {
  if (!statusBar) return;
  statusBar.textContent = texto;
  statusBar.className = `status-bar status-${tipo}`;
}
function pintarDuplicadosYErrores() {
  setText(totalDuplicados, duplicadosSesionActual);
  setText(totalErrores, erroresSesionActual);
  actualizarAlertasResumen(duplicadosSesionActual, erroresSesionActual);
}

function agregarYaRegistradoPanel(data = {}, fallbackBarcode = "") {
  const barcode = data.barcode || fallbackBarcode;
  const codigo = normalizarBarcode(barcode);

  if (!codigo) return;

  const yaExiste = cacheYaRegistrados.some((item) => {
    return normalizarBarcode(item.barcode) === codigo;
  });

  if (yaExiste) return;

  cacheYaRegistrados.unshift({
    fecha: new Date().toISOString(),
    barcode,
    tipo: data.tipo || "",
    serial: data.serial || "",
    variedad: data.variedad || "",
    bloque: data.bloque || "",
    tamano: data.tamano || "",
    tallos: data.tallos || "",
    resultado: "YA_REGISTRADO",
    observacion: data.observacion || "El barcode ya existe en registros"
  });

  cacheYaRegistrados = cacheYaRegistrados.slice(0, 50);
  duplicadosSesionActual += 1;
  pintarDuplicadosYErrores();
  renderYaRegistrados();
}

function mantenerFoco() {
  // No se usa foco forzado.
}

function guardarEstadoUI() {
  localStorage.setItem("viajeActivoUI", viajeActivo || "");
  localStorage.setItem("bloqueGeneralUI", bloqueGeneralSelect?.value || "");
  localStorage.setItem("variedadGeneralUI", variedadGeneralSelect?.value || "");
}

function restaurarEstadoUI() {
  return {
    viajeGuardado: localStorage.getItem("viajeActivoUI") || "",
    bloqueGuardado: localStorage.getItem("bloqueGeneralUI") || "",
    variedadGuardada: localStorage.getItem("variedadGeneralUI") || ""
  };
}

function actualizarAlertasResumen(duplicados, errores) {
  if (cardDuplicados) {
    cardDuplicados.classList.toggle("alerta-duplicados", Number(duplicados || 0) > 0);
  }

  if (cardErrores) {
    cardErrores.classList.toggle("alerta-errores", Number(errores || 0) > 0);
  }
}

function limpiarResumenViaje() {
  duplicadosSesionActual = 0;
erroresSesionActual = 0;
cacheYaRegistrados = [];
  setText(totalEscaneados, 0);
  setText(totalDuplicados, 0);
  setText(totalErrores, 0);
  setText(totalAcumuladoGeneral, 0);
  ultimoAcumulado = null;
  setText(viajeActivoLabel, "Sin viaje");

  actualizarAlertasResumen(0, 0);

  if (resumenVariedadBody) {
    resumenVariedadBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">Sin registros por variedad.</td>
      </tr>
    `;
  }

  if (pivotBody) {
    pivotBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">Sin datos para mostrar.</td>
      </tr>
    `;
  }

  if (detalleBody) {
    detalleBody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-row">Sin registros todavía.</td>
      </tr>
    `;
  }

  if (yaRegistradosLista) {
    yaRegistradosLista.innerHTML = `<div class="ya-registrado-item">Sin novedades.</div>`;
  }

  cacheDetalle = [];
}

function limpiarConsultaGeneral() {
  limpiarTotalesVariedadGlobal();

  setHTML(generalBloqueBody, `
    <tr>
      <td colspan="9" class="empty-row">Selecciona un bloque o variedad para consultar.</td>
    </tr>
  `);
  limpiarTotalesResumenGeneral();

  setHTML(generalBloqueDetalleBody, `
    <tr>
      <td colspan="13" class="empty-row">Sin datos para mostrar.</td>
    </tr>
  `);
}

async function cargarContadorGeneralBD() {
  try {
    const res = await fetch("/api/general/contador");

    if (!res.ok) {
      console.error("Error cargando contador general BD: HTTP", res.status);
      return;
    }

    const json = await res.json();
    if (!json.ok) return;

    setText(contadorGeneralBd, json.total ?? 0);
    setText(contadorTallosGeneralBd, json.total_tallos ?? 0);
  } catch (err) {
    console.error("Error cargando contador general BD:", err);
  }
}

async function cargarBloquesGenerales() {
  if (!bloqueGeneralSelect) return;

  try {
    const res = await fetch("/api/general/bloques");
    if (!res.ok) return;

    const json = await res.json();
    if (!json.ok) return;

    const seleccionado = bloqueGeneralSelect.value || "";
    bloqueGeneralSelect.innerHTML = `<option value="">Seleccionar bloque</option>`;

    json.data.forEach((bloque) => {
      const option = document.createElement("option");
      option.value = String(bloque);
      option.textContent = String(bloque);

      if (String(bloque) === String(seleccionado)) {
        option.selected = true;
      }

      bloqueGeneralSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Error cargando bloques generales:", err);
  }
}
async function cargarVariedadesGlobales() {
  if (!variedadGlobalSelect) return;

  try {
    const res = await fetch("/api/general/variedades");
    if (!res.ok) return;

    const json = await res.json();
    if (!json.ok) return;

    const seleccionada = variedadGlobalSelect.value || "";

    variedadGlobalSelect.innerHTML = `
      <option value="">Seleccionar variedad general</option>
    `;

    json.data.forEach((variedad) => {
      const option = document.createElement("option");
      option.value = variedad;
      option.textContent = variedad;

      if (String(variedad) === String(seleccionada)) {
        option.selected = true;
      }

      variedadGlobalSelect.appendChild(option);
    });

  } catch (err) {
    console.error("Error cargando variedades globales:", err);
  }
}

async function cargarVariedadesGeneralesPorBloque(bloque, variedadSeleccionada = "") {
  if (!variedadGeneralSelect) return;

  if (!bloque) {
    variedadGeneralSelect.innerHTML = `<option value="">Seleccionar variedad</option>`;
    return;
  }

  try {
    const res = await fetch(`/api/general/bloque/${encodeURIComponent(bloque)}/variedades`);
    if (!res.ok) return;

    const json = await res.json();

    variedadGeneralSelect.innerHTML = `<option value="">Seleccionar variedad</option>`;

    if (!json.ok) return;

    json.data.forEach((variedad) => {
      const option = document.createElement("option");
      option.value = variedad;
      option.textContent = variedad;

      if (variedadSeleccionada && variedadSeleccionada === variedad) {
        option.selected = true;
      }

      variedadGeneralSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Error cargando variedades por bloque:", err);
  }
}

function renderResumenGeneralFiltro(rows) {
  if (!generalBloqueBody) return;
  if (resumenGeneralOperando) return;

  generalBloqueBody.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const tallos = Number(row.tallos || 0);

    tr.innerHTML = `
      <td>${row.bloque ?? ""}</td>
      <td>${row.variedad ?? ""}</td>
      <td>${row.tamano ?? ""}</td>
      <td>${row.tallos ?? ""}</td>
      <td>${row.etapa ?? ""}</td>
      <td>${row.form || "-"}</td>
      <td class="cell-green" data-general-tabacos>${row.tabacos ?? 0}</td>
      <td class="cell-blue" data-general-suma>${row.suma_tallos ?? 0}</td>
      <td>
        <button
          class="btn-add-general"
          data-bloque="${row.bloque ?? ""}"
          data-variedad="${row.variedad ?? ""}"
          data-tamano="${row.tamano ?? ""}"
          data-tallos="${tallos}"
          data-etapa="${row.etapa || "Ingreso"}"
          data-form="${row.form || ""}"
          title="Agregar un registro igual"
        >+</button>

        <button
          class="btn-remove-general"
          data-bloque="${row.bloque ?? ""}"
          data-variedad="${row.variedad ?? ""}"
          data-tamano="${row.tamano ?? ""}"
          data-tallos="${tallos}"
          data-etapa="${row.etapa || "Ingreso"}"
          data-form="${row.form || ""}"
          title="Quitar un registro igual"
        >-</button>
      </td>
    `;

    generalBloqueBody.appendChild(tr);
  });

  conectarBotonesResumenGeneral();
  actualizarTotalesResumenGeneral();
}

function ajustarFilaResumenGeneral(btn, delta) {
  const tr = btn.closest("tr");
  if (!tr) return;

  const tabacosCell = tr.querySelector("[data-general-tabacos]");
  const sumaCell = tr.querySelector("[data-general-suma]");
  const tallos = Number(btn.dataset.tallos || 0);

  if (tabacosCell) {
    tabacosCell.textContent = Math.max(0, Number(tabacosCell.textContent || 0) + delta);
  }

  if (sumaCell) {
    sumaCell.textContent = Math.max(0, Number(sumaCell.textContent || 0) + (delta * tallos));
  }

  actualizarTotalesResumenGeneral();
}

function actualizarTotalesResumenGeneral() {
  if (!generalBloqueBody) return;

  let totalTabacos = 0;
  let totalTallos = 0;

  generalBloqueBody.querySelectorAll("tr").forEach((tr) => {
    const tabacosCell = tr.querySelector("[data-general-tabacos]");
    const sumaCell = tr.querySelector("[data-general-suma]");

    if (!tabacosCell || !sumaCell) return;

    totalTabacos += Number(tabacosCell.textContent || 0);
    totalTallos += Number(sumaCell.textContent || 0);
  });

  setText(totalTabacosFiltro, totalTabacos);
  setText(totalTallosFiltro, totalTallos);
}

function limpiarTotalesResumenGeneral() {
  setText(totalTabacosFiltro, 0);
  setText(totalTallosFiltro, 0);
}

function datosResumenGeneralDesdeBoton(btn) {
  return {
    bloque: btn.dataset.bloque,
    variedad: btn.dataset.variedad,
    tamano: btn.dataset.tamano,
    tallos: Number(btn.dataset.tallos || 0),
    etapa: btn.dataset.etapa || "Ingreso",
    form: btn.dataset.form || "",
    tipo: "",
    scope: "general"
  };
}

function conectarBotonesResumenGeneral() {
  if (!generalBloqueBody) return;

  generalBloqueBody.querySelectorAll(".btn-add-general").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (resumenGeneralOperando) return;
      resumenGeneralOperando = true;
      ajustarFilaResumenGeneral(btn, 1);
      btn.disabled = true;

      const ok = await agregarRegistroManualDesdeResumen(datosResumenGeneralDesdeBoton(btn));

      if (!ok) {
        ajustarFilaResumenGeneral(btn, -1);
      }

      btn.disabled = false;
      resumenGeneralOperando = false;
      await refrescarConsultaGeneralActual();
    });
  });

  generalBloqueBody.querySelectorAll(".btn-remove-general").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (resumenGeneralOperando) return;
      resumenGeneralOperando = true;
      ajustarFilaResumenGeneral(btn, -1);
      btn.disabled = true;

      const ok = await quitarRegistroManualDesdeResumen(datosResumenGeneralDesdeBoton(btn));

      if (!ok) {
        ajustarFilaResumenGeneral(btn, 1);
      }

      btn.disabled = false;
      resumenGeneralOperando = false;
      await refrescarConsultaGeneralActual();
    });
  });
}



async function cargarResumenGeneralPorBloque(bloque, variedad = "") {
  if (!generalBloqueBody) return;
  if (resumenGeneralOperando) return;

  if (!bloque) {
    limpiarConsultaGeneral();
    return;
  }

  try {
    const url = variedad
      ? `/api/general/bloque/${encodeURIComponent(bloque)}?variedad=${encodeURIComponent(variedad)}`
      : `/api/general/bloque/${encodeURIComponent(bloque)}`;

    const res = await fetch(url);

    if (!res.ok) {
      limpiarTotalesResumenGeneral();
      setHTML(generalBloqueBody, `
        <tr>
          <td colspan="9" class="empty-row">Error cargando el resumen del bloque.</td>
        </tr>
      `);
      return;
    }

    const json = await res.json();

    if (!json.ok || !json.data.length) {
      limpiarTotalesResumenGeneral();
      setHTML(generalBloqueBody, `
        <tr>
          <td colspan="9" class="empty-row">No hay datos para este filtro.</td>
        </tr>
      `);
      return;
    }

    renderResumenGeneralFiltro(json.data);
  } catch (err) {
    limpiarTotalesResumenGeneral();
    setHTML(generalBloqueBody, `
      <tr>
        <td colspan="9" class="empty-row">Error cargando el resumen del bloque.</td>
      </tr>
    `);
  }
}

async function cargarDetalleGeneralPorBloque(bloque, variedad = "") {
  if (!generalBloqueDetalleBody) return;
  if (!detalleFiltroEstaAbierto()) return;

  if (!bloque) {
    setHTML(generalBloqueDetalleBody, `
      <tr>
        <td colspan="13" class="empty-row">Sin datos para mostrar.</td>
      </tr>
    `);
    return;
  }

  try {
    const url = variedad
      ? `/api/general/bloque/${encodeURIComponent(bloque)}/detalle?variedad=${encodeURIComponent(variedad)}`
      : `/api/general/bloque/${encodeURIComponent(bloque)}/detalle`;

    const res = await fetch(url);

    if (!res.ok) {
      setHTML(generalBloqueDetalleBody, `
        <tr>
          <td colspan="13" class="empty-row">Error cargando el detalle del bloque.</td>
        </tr>
      `);
      return;
    }

    const json = await res.json();

    if (!json.ok || !json.data.length) {
      setHTML(generalBloqueDetalleBody, `
        <tr>
          <td colspan="13" class="empty-row">No hay registros para este filtro.</td>
        </tr>
      `);
      return;
    }

    generalBloqueDetalleBody.innerHTML = "";

    json.data.forEach((row) => {
      const fecha = row.created_at
        ? new Date(row.created_at).toLocaleString("es-CO")
        : "";

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${row.barcode ?? ""}</td>
        <td>${row.tipo ?? ""}</td>
        <td>${row.serial ?? ""}</td>
        <td>${row.variedad ?? ""}</td>
        <td>${row.bloque ?? ""}</td>
        <td>${row.tamano ?? ""}</td>
        <td>${row.tallos ?? ""}</td>
        <td>${row.etapa ?? ""}</td>
        <td>${row.form ?? ""}</td>
        <td>${row.barcode_origen ?? ""}</td>
        <td>${row.es_reregistro === true ? "Sí" : "No"}</td>
        <td>
          <button class="btn-delete-general" data-barcode="${row.barcode}">
            Eliminar
          </button>
        </td>
      `;

      generalBloqueDetalleBody.appendChild(tr);
    });

    document.querySelectorAll(".btn-delete-general").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const barcode = btn.dataset.barcode;
        await eliminarRegistroReal(barcode);
      });
    });
  } catch (err) {
    setHTML(generalBloqueDetalleBody, `
      <tr>
        <td colspan="13" class="empty-row">Error cargando el detalle del bloque.</td>
      </tr>
    `);
  }
}
async function cargarResumenGeneralPorVariedadGlobal(variedad) {
  if (!generalBloqueBody) return;
  if (resumenGeneralOperando) return;

  if (!variedad) {
    limpiarTotalesVariedadGlobal();
    limpiarConsultaGeneral();
    return;
  }

  try {
    const res = await fetch(
      `/api/general/variedad/${encodeURIComponent(variedad)}`
    );

    if (!res.ok) {
      limpiarTotalesVariedadGlobal();
      limpiarTotalesResumenGeneral();

      setHTML(generalBloqueBody, `
        <tr>
          <td colspan="9" class="empty-row">Error cargando el resumen de la variedad.</td>
        </tr>
      `);
      return;
    }

    const json = await res.json();

    if (!json.ok || !Array.isArray(json.data) || !json.data.length) {
      limpiarTotalesVariedadGlobal();
      limpiarTotalesResumenGeneral();

      setHTML(generalBloqueBody, `
        <tr>
          <td colspan="9" class="empty-row">No hay datos para esta variedad.</td>
        </tr>
      `);
      return;
    }

    const totalTabacos = json.data.reduce((acc, row) => {
      return acc + Number(row.tabacos || 0);
    }, 0);

    const totalTallos = json.data.reduce((acc, row) => {
      return acc + Number(row.suma_tallos || 0);
    }, 0);

    mostrarTotalesVariedadGlobal(variedad, totalTabacos, totalTallos);

    renderResumenGeneralFiltro(json.data);

  } catch (err) {
    console.error("Error cargando resumen por variedad global:", err);

    limpiarTotalesVariedadGlobal();
    limpiarTotalesResumenGeneral();

    setHTML(generalBloqueBody, `
      <tr>
        <td colspan="9" class="empty-row">Error cargando el resumen de la variedad.</td>
      </tr>
    `);
  }
}

async function cargarDetalleGeneralPorVariedadGlobal(variedad) {
  if (!generalBloqueDetalleBody) return;
  if (!detalleFiltroEstaAbierto()) return;

  if (!variedad) {
    setHTML(generalBloqueDetalleBody, `
      <tr>
        <td colspan="13" class="empty-row">Sin datos para mostrar.</td>
      </tr>
    `);
    return;
  }

  try {
    const res = await fetch(
      `/api/general/variedad/${encodeURIComponent(variedad)}/detalle`
    );

    if (!res.ok) {
      setHTML(generalBloqueDetalleBody, `
        <tr>
          <td colspan="13" class="empty-row">Error cargando el detalle de la variedad.</td>
        </tr>
      `);
      return;
    }

    const json = await res.json();

    if (!json.ok || !json.data.length) {
      setHTML(generalBloqueDetalleBody, `
        <tr>
          <td colspan="13" class="empty-row">No hay registros para esta variedad.</td>
        </tr>
      `);
      return;
    }

    generalBloqueDetalleBody.innerHTML = "";

    json.data.forEach((row) => {
      const fecha = row.created_at
        ? new Date(row.created_at).toLocaleString("es-CO")
        : "";

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${row.barcode ?? ""}</td>
        <td>${row.tipo ?? ""}</td>
        <td>${row.serial ?? ""}</td>
        <td>${row.variedad ?? ""}</td>
        <td>${row.bloque ?? ""}</td>
        <td>${row.tamano ?? ""}</td>
        <td>${row.tallos ?? ""}</td>
        <td>${row.etapa ?? ""}</td>
        <td>${row.form ?? ""}</td>
        <td>${row.barcode_origen ?? ""}</td>
        <td>${row.es_reregistro === true ? "Sí" : "No"}</td>
        <td>
          <button class="btn-delete-general" data-barcode="${row.barcode}">
            Eliminar
          </button>
        </td>
      `;

      generalBloqueDetalleBody.appendChild(tr);
    });

    document.querySelectorAll(".btn-delete-general").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const barcode = btn.dataset.barcode;
        await eliminarRegistroReal(barcode);
      });
    });

  } catch (err) {
    console.error("Error cargando detalle por variedad global:", err);

    setHTML(generalBloqueDetalleBody, `
      <tr>
        <td colspan="13" class="empty-row">Error cargando el detalle de la variedad.</td>
      </tr>
    `);
  }
}
async function cargarViajes() {
  const contenedor = document.getElementById("viajes-botones");
  if (!contenedor) return;

  const pintarBotones = (viajes) => {
    contenedor.innerHTML = "";

    viajes.forEach((nombre) => {
      const btn = document.createElement("button");

      btn.className = "btn-viaje";
      btn.textContent = nombre;

      btn.addEventListener("click", async () => {
        await activarViaje(nombre);
      });

      contenedor.appendChild(btn);
    });
  };

  try {
    const res = await fetch("/api/viajes");

    if (!res.ok) {
      pintarBotones(Array.from({ length: 20 }, (_, i) => `Viaje ${i + 1}`));
      return;
    }

    const json = await res.json();

    if (!json.ok || !Array.isArray(json.data)) {
      contenedor.innerHTML = "";
      return;
    }

    pintarBotones(json.data);
  } catch (err) {
    console.error("Error cargando viajes:", err);
    pintarBotones(Array.from({ length: 20 }, (_, i) => `Viaje ${i + 1}`));
  }
}
function limpiarTotalesVariedadGlobal() {
  setText(nombreVariedadGlobal, "Variedad");
  setText(totalTabacosVariedadGlobal, 0);
  setText(totalTallosVariedadGlobal, 0);

  if (resumenVariedadGlobalBox) {
    resumenVariedadGlobalBox.classList.add("hidden");
  }
}
function mostrarTotalesVariedadGlobal(variedad, totalTabacos, totalTallos) {
  setText(nombreVariedadGlobal, variedad || "Variedad");
  setText(totalTabacosVariedadGlobal, totalTabacos || 0);
  setText(totalTallosVariedadGlobal, totalTallos || 0);

  if (resumenVariedadGlobalBox) {
    resumenVariedadGlobalBox.classList.remove("hidden");
  }
}

function iniciarAutoRefreshViaje() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);

  autoRefreshTimer = setInterval(async () => {
    if (!viajeActivo || scrollBloqueado || escaneando) return;

    const tareas = [
      refrescarResumen(),
      refrescarPivot(),
      refrescarResumenDesdeBD(),
      cargarContadorGeneralBD()
    ];

    if (!mostrandoRegistrosHistoricos && ultimosRegistrosEstaVisible()) {
      tareas.push(refrescarDetalle());
    }

    const bloque = bloqueGeneralSelect?.value || "";
    const variedad = variedadGeneralSelect?.value || "";

    if (bloque) {
      tareas.push(cargarResumenGeneralPorBloque(bloque, variedad));

      if (detalleFiltroEstaAbierto()) {
        tareas.push(cargarDetalleGeneralPorBloque(bloque, variedad));
      }
    }

    await Promise.all(tareas);
  }, 6000);
}

function detenerAutoRefreshViaje() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

async function activarViaje(nombre) {
  try {
    const viajeNombre = String(nombre || "").trim();

    if (!viajeNombre) {
      setStatus("Debes seleccionar un viaje", "warn");
      return;
    }

    const res = await fetch("/api/viajes/activar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nombre: viajeNombre
      })
    });

    const json = await res.json();

    if (!json.ok) {
      setStatus(json.error || "No se pudo activar el viaje", "error");
      return;
    }

    viajeActivo = viajeNombre;
    guardarEstadoUI();
    detenerAutoRefreshViaje();
    mostrandoRegistrosHistoricos = false;

if (timerOcultarRegistrosHistoricos) {
  clearTimeout(timerOcultarRegistrosHistoricos);
  timerOcultarRegistrosHistoricos = null;
}

    document.querySelectorAll(".btn-viaje").forEach((b) => {
      b.classList.remove("activo");

      if (b.textContent === viajeNombre) {
        b.classList.add("activo");
      }
    });

    setText(viajeActivoLabel, viajeNombre);
    setText(totalEscaneados, 0);
    setText(totalDuplicados, 0);
    setText(totalErrores, 0);

    actualizarAlertasResumen(0, 0);

    cacheDetalle = [];
    duplicadosSesionActual = 0;
erroresSesionActual = 0;
cacheYaRegistrados = [];
pintarDuplicadosYErrores();

    if (detalleBody) {
      detalleBody.innerHTML = `
        <tr>
          <td colspan="11" class="empty-row">Sin registros todavía.</td>
        </tr>
      `;
    }

    if (pivotBody) {
      pivotBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-row">Sin datos para mostrar.</td>
        </tr>
      `;
    }

    if (yaRegistradosLista) {
      yaRegistradosLista.innerHTML = `<div class="ya-registrado-item">Sin novedades.</div>`;
    }

    if (resumenVariedadBody) {
      resumenVariedadBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-row">Sin registros por variedad.</td>
        </tr>
      `;
    }

    await conservarPosicionPantalla(async () => {
      await refrescarResumen();
      await pintarPendientesOfflineDelViaje();
      await refrescarResumenDesdeBD();
      await cargarContadorGeneralBD();
    });

    setStatus(`Viaje ${viajeNombre} activado`, "ok");
    iniciarAutoRefreshViaje();
  } catch (err) {
    console.error("Error activando viaje:", err);

    if (!navigator.onLine) {
      const viajeNombre = String(nombre || "").trim();

      viajeActivo = viajeNombre;
      guardarEstadoUI();
      detenerAutoRefreshViaje();
      mostrandoRegistrosHistoricos = false;

      document.querySelectorAll(".btn-viaje").forEach((b) => {
        b.classList.toggle("activo", b.textContent === viajeNombre);
      });

      setText(viajeActivoLabel, viajeNombre);
      setText(totalEscaneados, 0);
      setText(totalDuplicados, 0);
      setText(totalErrores, 0);
      setText(totalAcumuladoGeneral, 0);
      actualizarAlertasResumen(0, 0);

      cacheDetalle = [];
      duplicadosSesionActual = 0;
      erroresSesionActual = 0;
      cacheYaRegistrados = [];
      pintarDuplicadosYErrores();

      await pintarPendientesOfflineDelViaje();
      await actualizarTotalesConPendientesOffline(0, 0);

      setStatus(`Viaje ${viajeNombre} activado en modo offline`, "warn");
      return;
    }

    setStatus("Error activando viaje", "error");
  }
}

async function finalizarViaje() {
  if (!viajeActivo) {
    setStatus("No hay viaje activo", "warn");
    return;
  }

  try {
    const nombreFinalizar = viajeActivo;

    const res = await fetch("/api/viajes/finalizar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nombre: nombreFinalizar
      })
    });

    const json = await res.json();

    if (!json.ok) {
      setStatus(json.error || "No se pudo finalizar", "error");
      return;
    }

    setStatus(`Viaje ${nombreFinalizar} finalizado`, "ok");

    viajeActivo = "";
    guardarEstadoUI();
    detenerAutoRefreshViaje();

    setText(viajeActivoLabel, "Sin viaje");

    document.querySelectorAll(".btn-viaje").forEach((b) => {
      b.classList.remove("activo");
    });

    limpiarResumenViaje();
  } catch (err) {
    console.error("Error finalizando viaje:", err);
    setStatus("Error finalizando viaje", "error");
  }
}

async function escanearCodigo(barcode, viajeRegistro = viajeActivo) {
  try {
    const barcodeLimpio = normalizarBarcode(barcode);

    if (!viajeRegistro) {
      setStatus("Debes activar un viaje antes de escanear", "warn");
      return;
    }

    if (!barcodeLimpio) {
      setStatus("El barcode está vacío", "warn");
      return;
    }

    const payload = {
      barcode: barcodeLimpio,
      viaje: viajeRegistro,
      form: formInput?.value?.trim() || ""
    };
    const mostrarEnPantallaActual = viajeRegistro === viajeActivo;

    let res = null;
    let data = null;

    try {
      res = await fetchConTimeout("/api/escanear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }, 8000);

      data = await res.json();

    } catch (networkError) {
      if (navigator.onLine && esErrorTimeout(networkError)) {
        actualizarRegistroPendienteVisual(
          barcodeLimpio,
          "Servidor lento. Reintentando registro automatico..."
        );
        setStatus(`${barcodeLimpio} pendiente por respuesta lenta. Reintentando...`, "warn");
        programarEscaneoForzado(payload);
        return;
      }

      const yaExisteOffline = await existeRegistroOfflinePendiente(barcodeLimpio);

      if (yaExisteOffline) {
        quitarRegistroPendienteVisual(barcodeLimpio);

        if (!mostrarEnPantallaActual) {
          setStatus(`${barcodeLimpio} procesado para ${viajeRegistro}`, "ok");
          return;
        }

        duplicadosSesionActual += 1;

        cacheYaRegistrados.unshift({
          fecha: new Date().toISOString(),
          barcode: barcodeLimpio,
          tipo: "",
          serial: "",
          variedad: "Pendiente offline",
          bloque: "Pendiente offline",
          tamano: "",
          tallos: "",
          resultado: "YA_REGISTRADO",
          observacion: "Este código ya está guardado localmente pendiente de sincronizar"
        });

        pintarDuplicadosYErrores();
        renderYaRegistrados();

        setStatus(`${barcodeLimpio} → YA REGISTRADO OFFLINE`, "warn");
        return;
      }

      const registroOffline = await guardarRegistroOffline(payload);

      setStatus(`${barcodeLimpio} → GUARDADO OFFLINE`, "warn");

      if (!mostrarEnPantallaActual) {
        quitarRegistroPendienteVisual(barcodeLimpio);
        return;
      }

      const actual = Number(totalEscaneados?.textContent || 0);
      setText(totalEscaneados, actual + 1);

      const acumulado = Number(totalAcumuladoGeneral?.textContent || 0);
      setAcumuladoSeguro(acumulado + 1);

      quitarRegistroPendienteVisual(barcodeLimpio);
      agregarRegistroOfflineVisual(registroOffline);

      return;
    }

    if (!res || !res.ok || !data || data.ok === false) {
      const mensaje =
        data?.error ||
        data?.mensaje ||
        data?.resultado ||
        "Error al escanear";

      setStatus(`${barcodeLimpio} → ${mensaje}`, "error");

      quitarRegistroPendienteVisual(barcodeLimpio);

      console.error(
        "Error backend /api/escanear:",
        JSON.stringify(data, null, 2)
      );

      return;
    }

    if (!mostrarEnPantallaActual) {
      quitarRegistroPendienteVisual(barcodeLimpio);
      setStatus(`${barcodeLimpio} procesado para ${viajeRegistro}`, "ok");
      return;
    }

    if (data.resultado === "OK") {
      setStatus(`${barcodeLimpio} → REGISTRADO`, "ok");

      const actual = Number(totalEscaneados?.textContent || 0);
      setText(totalEscaneados, actual + 1);

      const acumulado = Number(totalAcumuladoGeneral?.textContent || 0);
      setAcumuladoSeguro(acumulado + 1);
      agregarRegistroProcesadoVisual(data.data, "OK");

    } else if (data.resultado === "YA_REGISTRADO") {
      quitarRegistroPendienteVisual(barcodeLimpio);
      duplicadosSesionActual += 1;

      cacheYaRegistrados.unshift({
        fecha: new Date().toISOString(),
        barcode: data.data?.barcode || barcodeLimpio,
        tipo: data.data?.tipo || "",
        serial: data.data?.serial || "",
        variedad: data.data?.variedad || "",
        bloque: data.data?.bloque || "",
        tamano: data.data?.tamano || "",
        tallos: data.data?.tallos || "",
        resultado: "YA_REGISTRADO",
        observacion: data.data?.observacion || "El barcode ya existe en registros"
      });

      pintarDuplicadosYErrores();
      renderYaRegistrados();

      setStatus(`${barcodeLimpio} → YA REGISTRADO`, "warn");

    } else if (data.resultado === "REREGISTRADO") {
      setStatus(`${barcodeLimpio} → RE-REGISTRADO`, "ok");

      const actual = Number(totalEscaneados?.textContent || 0);
      setText(totalEscaneados, actual + 1);

      const acumulado = Number(totalAcumuladoGeneral?.textContent || 0);
      setAcumuladoSeguro(acumulado + 1);
      agregarRegistroProcesadoVisual(data.data, "REREGISTRADO");

    } else if (data.resultado === "NO_EXISTE") {
      quitarRegistroPendienteVisual(barcodeLimpio);
      erroresSesionActual += 1;
      pintarDuplicadosYErrores();

      setStatus(`${barcodeLimpio} → NO EXISTE`, "error");

    } else {
      quitarRegistroPendienteVisual(barcodeLimpio);
      setStatus(`Escaneo procesado: ${barcodeLimpio}`, "ok");
    }

    programarRefrescoPostEscaneo();

  } catch (error) {
    console.error("Error escaneando:", error);
    quitarRegistroPendienteVisual(barcode);
    setStatus("Error escaneando", "error");
  }
}

function programarEscaneoForzado(payload, intento = 1) {
  const delay = Math.min(1500 * intento, 6000);

  setTimeout(() => {
    confirmarEscaneoPendiente(payload, intento);
  }, delay);
}

async function confirmarEscaneoPendiente(payload, intento = 1) {
  const barcodeLimpio = normalizarBarcode(payload?.barcode);
  const viajeRegistro = String(payload?.viaje || "").trim();
  const mostrarEnPantallaActual = viajeRegistro === viajeActivo;

  if (!barcodeLimpio || !viajeRegistro) return;

  if (!navigator.onLine) {
    try {
      const registroOffline = await guardarRegistroOffline(payload);
      quitarRegistroPendienteVisual(barcodeLimpio);

      if (mostrarEnPantallaActual) {
        agregarRegistroOfflineVisual(registroOffline);
      }
    } catch (err) {
      actualizarRegistroPendienteVisual(barcodeLimpio, "Sin internet. Pendiente de guardado local.");
    }

    return;
  }

  actualizarRegistroPendienteVisual(
    barcodeLimpio,
    `Reintentando registro automatico (${intento}/5)...`
  );

  try {
    const res = await fetchConTimeout("/api/escanear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }, 12000);

    const data = await res.json();

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || data?.mensaje || "No se pudo confirmar el registro");
    }

    if (data.resultado === "OK" || data.resultado === "REREGISTRADO") {
      if (mostrarEnPantallaActual) {
        const actual = Number(totalEscaneados?.textContent || 0);
        setText(totalEscaneados, actual + 1);

        const acumulado = Number(totalAcumuladoGeneral?.textContent || 0);
        setAcumuladoSeguro(acumulado + 1);

        agregarRegistroProcesadoVisual(data.data, data.resultado);
      } else {
        quitarRegistroPendienteVisual(barcodeLimpio);
      }

      setStatus(`${barcodeLimpio} registrado automaticamente`, "ok");
      programarRefrescoPostEscaneo();
      return;
    }

    if (data.resultado === "YA_REGISTRADO") {
      quitarRegistroPendienteVisual(barcodeLimpio);

      if (mostrarEnPantallaActual) {
        await recalcularTotalesViajeDesdeDetalle();
      }

      setStatus(`${barcodeLimpio} ya estaba confirmado en la base`, "ok");
      programarRefrescoPostEscaneo();
      return;
    }

    if (data.resultado === "NO_EXISTE") {
      quitarRegistroPendienteVisual(barcodeLimpio);
      erroresSesionActual += 1;
      pintarDuplicadosYErrores();
      setStatus(`${barcodeLimpio} no existe`, "error");
      return;
    }

    quitarRegistroPendienteVisual(barcodeLimpio);
    setStatus(`${barcodeLimpio} procesado`, "ok");
  } catch (err) {
    if (intento < 5) {
      programarEscaneoForzado(payload, intento + 1);
      return;
    }

    actualizarRegistroPendienteVisual(
      barcodeLimpio,
      "No se pudo confirmar aun. Revisa conexion con el servidor."
    );
    setStatus(`${barcodeLimpio} sigue pendiente por respuesta del servidor`, "warn");
  }
}

async function reregistrarCodigo(barcodeOriginal) {
  if (!viajeActivo) {
    setStatus("Debes activar un viaje antes de re-registrar", "warn");
    return;
  }

  const confirmar = confirm(`¿Deseas re-registrar el código ${barcodeOriginal}?`);
  if (!confirmar) return;

  try {
    const res = await fetch("/api/reregistrar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        viaje: viajeActivo,
        barcode: barcodeOriginal
      })
    });

    const json = await res.json();

    if (!json.ok) {
      console.error("Error backend /api/reregistrar:", json);
      setStatus(json.error || "No se pudo re-registrar", "error");
      return;
    }

    setStatus(`${barcodeOriginal} → RE-REGISTRADO como ${json.data.barcode}`, "ok");

    await conservarPosicionPantalla(async () => {
      await refrescarTodo();
    });
  } catch (err) {
    console.error("Error en re-registro:", err);
    setStatus("Error en re-registro", "error");
  }
}

async function refrescarResumen() {
  if (!viajeActivo) {
    limpiarResumenViaje();
    return;
  }

  try {
    const res = await fetch(`/api/viajes/${encodeURIComponent(viajeActivo)}/resumen`);
    if (!res.ok) return;

    const json = await res.json();

    const okSesion = json.sesionActual?.ok ?? 0;
    const reregSesion = json.sesionActual?.reregistrados ?? 0;
    const duplicados = json.sesionActual?.duplicados ?? 0;
    const errores = json.sesionActual?.errores ?? 0;

    await actualizarTotalesConPendientesOffline(okSesion + reregSesion);
    if (Number(duplicados || 0) > duplicadosSesionActual) {
  duplicadosSesionActual = Number(duplicados || 0);
}

if (Number(errores || 0) > erroresSesionActual) {
  erroresSesionActual = Number(errores || 0);
}

pintarDuplicadosYErrores();
  } catch (err) {
    console.error("Error refrescando resumen:", err);
  }
}

async function refrescarResumenDesdeBD() {
  if (!viajeActivo) return;

  try {
    const res = await fetch(`/api/viajes/${encodeURIComponent(viajeActivo)}/resumen-db`);

    if (!res.ok) {
      console.error("Error refrescando resumen DB: HTTP", res.status);
      return;
    }

    const json = await res.json();
    if (!json.ok) return;

    const row = json.data || {};
    const ok = Number(row.ok || 0);
    const rereg = Number(row.reregistrados || 0);

    await actualizarTotalesConPendientesOffline(null, ok + rereg);
    await refrescarResumenPorVariedadDesdeBD();
  } catch (err) {
    console.error("Error refrescando resumen DB:", err);
  }
}

async function refrescarPivot() {
  if (!pivotBody) return;

  if (!viajeActivo) {
    setHTML(pivotBody, `
      <tr>
        <td colspan="8" class="empty-row">Sin datos para mostrar.</td>
      </tr>
    `);
    return;
  }

  try {
    const res = await fetch(`/api/viajes/${encodeURIComponent(viajeActivo)}/pivot`);
    if (!res.ok) return;

    const json = await res.json();

    if (!json.data.length) {
      setHTML(pivotBody, `
        <tr>
          <td colspan="8" class="empty-row">Sin datos para mostrar.</td>
        </tr>
      `);
      return;
    }

    pivotBody.innerHTML = "";

    json.data.forEach((row) => {
      const tr = document.createElement("tr");

      tr.dataset.bloque = row.bloque ?? "";
      tr.dataset.variedad = row.variedad ?? "";
      tr.dataset.tamano = row.tamano ?? "NA";
      tr.dataset.tallos = row.tallos ?? "";
      tr.dataset.tabacos = row.tabacos ?? 0;
      tr.dataset.suma = row.suma_tallos ?? 0;
      tr.dataset.etapa = row.etapa ?? "";

      tr.innerHTML = `
        <td>${row.bloque ?? ""}</td>
        <td>${row.variedad ?? ""}</td>
        <td>${row.tamano ?? ""}</td>
        <td>${row.tallos ?? ""}</td>
        <td>${row.etapa ?? ""}</td>
        <td class="cell-green">${row.tabacos ?? 0}</td>
        <td class="cell-blue">${row.suma_tallos ?? 0}</td>
        <td>
          <button onclick="verDetalleFila(this)">Ver</button>
        </td>
      `;

      pivotBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error refrescando pivot:", err);
  }
}

function refrescarResumenPorVariedad() {
  if (!resumenVariedadBody) return;

  const ordenActual = new Map(
    Array.from(resumenVariedadBody.querySelectorAll("tr[data-resumen-key]"))
      .map((tr, index) => [tr.dataset.resumenKey, index])
  );

  if (!viajeActivo) {
    resumenVariedadBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Sin registros por variedad.</td>
      </tr>
    `;
    return;
  }

  if (!cacheDetalle.length) {
    refrescarResumenPorVariedadDesdeBD();
    return;
  }

  const agrupado = {};

  cacheDetalle.forEach((row) => {
    if (!["OK", "REREGISTRADO", "OFFLINE", "LOCAL"].includes(row.resultado)) return;

    const bloque = String(row.bloque || "N/A").trim();
    const variedad = String(row.variedad || "Sin variedad").trim();
    const tamano = String(row.tamano || "NA").trim();
    const tallos = Number(row.tallos || 0);
    const form = String(row.form || "").trim();
    const etapa = String(row.etapa || "Ingreso").trim();
    const tipo = String(row.tipo || "").trim();

    const key = `${bloque}|${variedad}|${tamano}|${tallos}|${form}|${etapa}|${tipo}`;
    const resumenKey = encodeURIComponent(key);

    if (!agrupado[key]) {
      agrupado[key] = {
        resumenKey,
        bloque,
        variedad,
        tamano,
        tallos,
        form,
        etapa,
        tipo,
        tabacos: 0,
        totalTallos: 0
      };
    }

    agrupado[key].tabacos += 1;
    agrupado[key].totalTallos += tallos;
  });

  const filas = Object.values(agrupado).sort((a, b) => {
    const ordenA = ordenActual.get(a.resumenKey);
    const ordenB = ordenActual.get(b.resumenKey);

    if (ordenA !== undefined && ordenB !== undefined) {
      return ordenA - ordenB;
    }

    if (ordenA !== undefined) return -1;
    if (ordenB !== undefined) return 1;

    if (String(a.bloque) < String(b.bloque)) return -1;
    if (String(a.bloque) > String(b.bloque)) return 1;
    const variedadCompare = String(a.variedad).localeCompare(String(b.variedad));
    if (variedadCompare !== 0) return variedadCompare;
    const tamanoCompare = String(a.tamano).localeCompare(String(b.tamano));
    if (tamanoCompare !== 0) return tamanoCompare;
    return Number(a.tallos || 0) - Number(b.tallos || 0);
  });

  if (!filas.length) {
    resumenVariedadBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">Sin registros por variedad.</td>
      </tr>
    `;
    return;
  }

  resumenVariedadBody.innerHTML = filas.map((item) => `
    <tr data-resumen-key="${item.resumenKey}">
      <td>${item.bloque}</td>
      <td>${item.variedad}</td>
      <td>${item.tamano || "NA"}</td>
      <td>${item.form || "-"}</td>
      <td class="cell-green">${item.tabacos}</td>
      <td class="cell-blue">${item.totalTallos}</td>
      <td>
  <button
    class="btn-add-manual"
    data-bloque="${item.bloque}"
    data-variedad="${item.variedad}"
    data-tamano="${item.tamano || ""}"
    data-tallos="${item.tallos}"
    data-form="${item.form || ""}"
    data-etapa="${item.etapa || "Ingreso"}"
    data-tipo="${item.tipo || ""}"
    title="Agregar un registro igual"
  >+</button>

  <button
    class="btn-remove-manual"
    data-bloque="${item.bloque}"
    data-variedad="${item.variedad}"
    data-tamano="${item.tamano || ""}"
    data-tallos="${item.tallos}"
    data-form="${item.form || ""}"
    data-etapa="${item.etapa || "Ingreso"}"
    data-tipo="${item.tipo || ""}"
    title="Quitar un registro igual"
  >−</button>
</td>
    </tr>
  `).join("");

  resumenVariedadBody.querySelectorAll(".btn-add-manual").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await agregarRegistroManualDesdeResumen({
        bloque: btn.dataset.bloque,
        variedad: btn.dataset.variedad,
        tamano: btn.dataset.tamano,
        tallos: Number(btn.dataset.tallos || 0),
        form: btn.dataset.form,
        etapa: btn.dataset.etapa,
        tipo: btn.dataset.tipo
      });
    });
  });
  resumenVariedadBody.querySelectorAll(".btn-remove-manual").forEach((btn) => {
  btn.addEventListener("click", async () => {
    await quitarRegistroManualDesdeResumen({
      bloque: btn.dataset.bloque,
      variedad: btn.dataset.variedad,
      tamano: btn.dataset.tamano,
      tallos: Number(btn.dataset.tallos || 0),
      form: btn.dataset.form,
      etapa: btn.dataset.etapa,
      tipo: btn.dataset.tipo
    });
  });
});
}

async function refrescarResumenPorVariedadDesdeBD() {
  if (!resumenVariedadBody || !viajeActivo) return;

  try {
    const res = await fetch(`/api/viajes/${encodeURIComponent(viajeActivo)}/resumen-variedad-db`);
    if (!res.ok) return;

    const json = await res.json();
    if (!json.ok || !Array.isArray(json.data) || !json.data.length) {
      if (!cacheDetalle.length) {
        resumenVariedadBody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-row">Sin registros por variedad.</td>
          </tr>
        `;
      }
      return;
    }

    const filas = json.data.map((row) => {
      const key = [
        row.bloque || "",
        row.variedad || "",
        row.tamano || "NA",
        Number(row.tallos || 0),
        row.form || "",
        row.etapa || "Ingreso",
        row.tipo || ""
      ].join("|");

      return {
        resumenKey: encodeURIComponent(key),
        bloque: row.bloque || "",
        variedad: row.variedad || "",
        tamano: row.tamano || "NA",
        tallos: Number(row.tallos || 0),
        form: row.form || "",
        etapa: row.etapa || "Ingreso",
        tipo: row.tipo || "",
        tabacos: Number(row.tabacos || 0),
        totalTallos: Number(row.total_tallos || 0)
      };
    });

    resumenVariedadBody.innerHTML = filas.map((item) => `
      <tr data-resumen-key="${item.resumenKey}">
        <td>${item.bloque}</td>
        <td>${item.variedad}</td>
        <td>${item.tamano || "NA"}</td>
        <td>${item.form || "-"}</td>
        <td class="cell-green">${item.tabacos}</td>
        <td class="cell-blue">${item.totalTallos}</td>
        <td>
          <button
            class="btn-add-manual"
            data-bloque="${item.bloque}"
            data-variedad="${item.variedad}"
            data-tamano="${item.tamano || ""}"
            data-tallos="${item.tallos}"
            data-form="${item.form || ""}"
            data-etapa="${item.etapa || "Ingreso"}"
            data-tipo="${item.tipo || ""}"
            title="Agregar un registro igual"
          >+</button>

          <button
            class="btn-remove-manual"
            data-bloque="${item.bloque}"
            data-variedad="${item.variedad}"
            data-tamano="${item.tamano || ""}"
            data-tallos="${item.tallos}"
            data-form="${item.form || ""}"
            data-etapa="${item.etapa || "Ingreso"}"
            data-tipo="${item.tipo || ""}"
            title="Quitar un registro igual"
          >-</button>
        </td>
      </tr>
    `).join("");

    resumenVariedadBody.querySelectorAll(".btn-add-manual").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await agregarRegistroManualDesdeResumen({
          bloque: btn.dataset.bloque,
          variedad: btn.dataset.variedad,
          tamano: btn.dataset.tamano,
          tallos: Number(btn.dataset.tallos || 0),
          form: btn.dataset.form,
          etapa: btn.dataset.etapa,
          tipo: btn.dataset.tipo
        });
      });
    });

    resumenVariedadBody.querySelectorAll(".btn-remove-manual").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await quitarRegistroManualDesdeResumen({
          bloque: btn.dataset.bloque,
          variedad: btn.dataset.variedad,
          tamano: btn.dataset.tamano,
          tallos: Number(btn.dataset.tallos || 0),
          form: btn.dataset.form,
          etapa: btn.dataset.etapa,
          tipo: btn.dataset.tipo
        });
      });
    });
  } catch (err) {
    console.error("Error refrescando resumen por variedad desde BD:", err);
  }
}

function badgeResultado(resultado) {
  if (resultado === "OK") return `<span class="badge badge-ok">OK</span>`;
  if (resultado === "YA_REGISTRADO") return `<span class="badge badge-dup">YA REGISTRADO</span>`;
  if (resultado === "NO_EXISTE") return `<span class="badge badge-bad">NO EXISTE</span>`;
  if (resultado === "REREGISTRADO") return `<span class="badge badge-ok">RE-REGISTRADO</span>`;
  if (resultado === "OFFLINE") return `<span class="badge badge-offline">OFFLINE</span>`;
  if (resultado === "LOCAL") return `<span class="badge badge-ok">GUARDADO</span>`;
  if (resultado === "PROCESANDO") return `<span class="badge badge-offline">PROCESANDO</span>`;
  return resultado || "";
}

function renderYaRegistrados(data = null) {
  if (!yaRegistradosLista) return;

  if (Array.isArray(data) && data.length) {
    const nuevosDuplicados = data.filter((x) => x.resultado === "YA_REGISTRADO");

    if (nuevosDuplicados.length) {
      cacheYaRegistrados = nuevosDuplicados.slice(0, 50);
    }
  }

  const duplicados = cacheYaRegistrados || [];

  if (!duplicados.length) {
    yaRegistradosLista.innerHTML = `<div class="ya-registrado-item">Sin novedades.</div>`;
    return;
  }

  yaRegistradosLista.innerHTML = duplicados.slice(0, 8).map((row) => {
    const fecha = row.fechaAnterior
      ? new Date(row.fechaAnterior).toLocaleString("es-CO")
      : (row.fecha ? new Date(row.fecha).toLocaleString("es-CO") : "Fecha no disponible");

    return `
      <div class="ya-registrado-item">
        <strong>${row.barcode ?? "-"}</strong><br>
        Variedad: ${row.variedad ?? "-"} | Bloque: ${row.bloque ?? "-"} | Tamaño: ${row.tamano ?? "-"}<br>
        Tallos: ${row.tallos ?? "-"}<br>
        Fecha: ${fecha}
      </div>
    `;
  }).join("");
}

function renderDetalle(data) {
  if (!detalleBody) return;

  const visibles = (data || []).slice(0, 300);

  if (!visibles.length) {
    setHTML(detalleBody, `
      <tr>
        <td colspan="11" class="empty-row">Sin registros todavía.</td>
      </tr>
    `);
    return;
  }

  detalleBody.innerHTML = "";

  visibles.forEach((row) => {
    const fecha = new Date(row.fecha).toLocaleString("es-CO");

    let acciones = ["OFFLINE", "LOCAL"].includes(row.resultado)
      ? `<span class="badge badge-offline">Enviando</span>`
      : `<button class="btn-delete" data-barcode="${row.barcode}">Eliminar</button>`;

    if (row.resultado === "PROCESANDO") {
      acciones = `<span class="badge badge-offline">Esperando</span>`;
    }

    if (row.resultado === "YA_REGISTRADO" && row.puede_reregistrar === true) {
      acciones += ` <button class="btn-primary btn-reregistrar-tabla" data-barcode="${row.barcode}">Re-registrar</button>`;
    }

    const observacionTexto =
      row.resultado === "REREGISTRADO" && row.barcode_origen
        ? `Re-registro de ${row.barcode_origen}`
        : (row.observacion ?? "");

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${row.viaje || viajeActivo}</td>
      <td>${row.barcode ?? ""}</td>
      <td>${row.bloque ?? ""}</td>
      <td>${row.variedad ?? ""}</td>
      <td>${row.tamano ?? ""}</td>
      <td>${row.tallos ?? ""}</td>
      <td>${row.form ?? ""}</td>
      <td>${badgeResultado(row.resultado)}</td>
      <td>${observacionTexto}</td>
      <td>${acciones}</td>
    `;

    detalleBody.appendChild(tr);
  });

  detalleBody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const barcode = btn.dataset.barcode;
      await eliminarRegistroReal(barcode);
    });
  });

  detalleBody.querySelectorAll(".btn-reregistrar-tabla").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const barcode = btn.dataset.barcode;
      await reregistrarCodigo(barcode);
    });
  });
}

async function agregarRegistroManualDesdeResumen(data) {
  if (!viajeActivo && data.scope !== "general") {
    setStatus("Debes activar un viaje antes de agregar registros", "warn");
    return false;
  }

  const esConsultaGeneral = data.scope === "general";
  const barcodeTemporal = `MANUAL-${Date.now()}`;
  const actualAntes = Number(totalEscaneados?.textContent || 0);
  const acumuladoAntes = Number(totalAcumuladoGeneral?.textContent || 0);

  if (!esConsultaGeneral) {
    setText(totalEscaneados, actualAntes + 1);
    setAcumuladoSeguro(acumuladoAntes + 1);

    agregarRegistroProcesadoVisual({
      barcode: barcodeTemporal,
      tipo: data.tipo || "",
      serial: "",
      bloque: data.bloque,
      variedad: data.variedad,
      tamano: data.tamano,
      tallos: data.tallos,
      form: data.form,
      etapa: data.etapa || "Ingreso",
      observacion: "Agregando manualmente..."
    }, "OK");
  }

  setStatus(
    `Agregando: ${data.variedad} / ${data.tamano || "NA"} / ${data.tallos} tallos`,
    "warn"
  );

  try {
    const res = await fetch("/api/registros/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        viaje: esConsultaGeneral ? "" : viajeActivo,
        bloque: data.bloque,
        variedad: data.variedad,
        tamano: data.tamano,
        tallos: data.tallos,
        form: data.form,
        etapa: data.etapa || "Ingreso",
        tipo: data.tipo,
        scope: data.scope || "viaje"
      })
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      if (!esConsultaGeneral) {
        quitarRegistroVisualPorBarcode(barcodeTemporal);
        setText(totalEscaneados, actualAntes);
        setAcumuladoSeguro(acumuladoAntes);
      }
      setStatus(json.error || "No se pudo agregar el registro manual", "error");
      return false;
    }

    setStatus(
      `Registro agregado: ${data.variedad} / ${data.tamano || "NA"} / ${data.tallos} tallos`,
      "ok"
    );

    if (!esConsultaGeneral) {
      quitarRegistroVisualPorBarcode(barcodeTemporal);
      agregarRegistroProcesadoVisual(json.data, "OK");
      programarRefrescoPostEscaneo();
    }

    return true;
  } catch (err) {
    if (!esConsultaGeneral) {
      quitarRegistroVisualPorBarcode(barcodeTemporal);
      setText(totalEscaneados, actualAntes);
      setAcumuladoSeguro(acumuladoAntes);
    }
    console.error("Error agregando registro manual:", err);
    setStatus("Error agregando registro manual", "error");
    return false;
  }
}
async function quitarRegistroManualDesdeResumen(data) {
  if (!viajeActivo && data.scope !== "general") {
    setStatus("Debes activar un viaje antes de quitar registros", "warn");
    return false;
  }

  const esConsultaGeneral = data.scope === "general";
  const actualAntes = Number(totalEscaneados?.textContent || 0);
  const acumuladoAntes = Number(totalAcumuladoGeneral?.textContent || 0);
  const eliminadoVisual = esConsultaGeneral ? null : quitarRegistroVisualPorGrupo(data);

  if (!esConsultaGeneral) {
    setText(totalEscaneados, Math.max(0, actualAntes - 1));
    setAcumuladoSeguro(Math.max(0, acumuladoAntes - 1));
  }
  setStatus(
    `Quitando: ${data.variedad} / ${data.tamano || "NA"} / ${data.tallos} tallos`,
    "warn"
  );

  try {
    const res = await fetch("/api/registros/manual/quitar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        viaje: viajeActivo || "",
        bloque: data.bloque,
        variedad: data.variedad,
        tamano: data.tamano,
        tallos: data.tallos,
        form: data.form,
        etapa: data.etapa || "Ingreso",
        tipo: data.tipo,
        scope: data.scope || "viaje"
      })
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      if (eliminadoVisual) {
        cacheDetalle.unshift(eliminadoVisual);
        renderDetalle(cacheDetalle);
        refrescarResumenPorVariedad();
      }

      if (!esConsultaGeneral) {
        setText(totalEscaneados, actualAntes);
        setAcumuladoSeguro(acumuladoAntes);
      }
      setStatus(json.error || "No se pudo quitar el registro", "error");
      return false;
    }

    setStatus(
      `Se quitó un tabaco: ${data.variedad} / ${data.tamano || "NA"} / ${data.tallos} tallos`,
      "ok"
    );

    if (!esConsultaGeneral) {
      programarRefrescoPostEscaneo();
    }
    return true;

  } catch (err) {
    if (eliminadoVisual) {
      cacheDetalle.unshift(eliminadoVisual);
      renderDetalle(cacheDetalle);
      refrescarResumenPorVariedad();
    }

    if (!esConsultaGeneral) {
      setText(totalEscaneados, actualAntes);
      setAcumuladoSeguro(acumuladoAntes);
    }
    console.error("Error quitando registro manual:", err);
    setStatus("Error quitando registro manual", "error");
    return false;
  }
}
// =====================================================
// LECTOR GLOBAL DE CÓDIGOS
// Funciona desde cualquier parte de la página.
// Escribe o escanea números y registra al presionar ENTER.
// Acepta códigos desde 2 dígitos hasta más de 17.
// Usa cola para no perder códigos escaneados rápido.
// =====================================================

let lectorBuffer = "";
let lectorProcesando = false;
let colaCodigos = [];
let escaneosActivos = 0;
const MAX_ESCANEOS_PARALELOS = 4;

function limpiarLectorGlobal() {
  lectorBuffer = "";

  if (barcodeInput) {
    barcodeInput.value = "";
  }

  if (barcodeVisible) {
    barcodeVisible.textContent = "Esperando escaneo...";
  }
}

function mostrarLectorGlobal() {
  if (barcodeVisible) {
    barcodeVisible.textContent = lectorBuffer || "Esperando escaneo...";
  }
}

function usuarioEstaEditandoCampo() {
  const activo = document.activeElement;

  if (!activo) return false;

  const tag = activo.tagName?.toLowerCase();

  if (tag === "select") return true;
  if (tag === "textarea") return true;

  if (tag === "input" && activo !== barcodeInput) {
    return true;
  }

  return false;
}

function obtenerCaracterDesdeTecla(e) {
  if (/^[a-zA-Z0-9]$/.test(e.key)) {
    return e.key.toUpperCase();
  }

  if (/^Numpad\d$/.test(e.code)) {
    return e.code.replace("Numpad", "");
  }

  return null;
}

async function registrarEscaneoInstantaneo(codigo) {
  const barcodeLimpio = normalizarBarcode(codigo);

  if (!viajeActivo) {
    setStatus("Debes activar un viaje antes de escanear", "warn");
    return;
  }

  if (!barcodeLimpio) return;

  try {
    const yaExisteOffline = await existeRegistroOfflinePendiente(barcodeLimpio);

    if (yaExisteOffline) {
      setStatus(`${barcodeLimpio} ya esta guardado localmente`, "warn");
      return;
    }

    const payload = {
      barcode: barcodeLimpio,
      viaje: viajeActivo,
      form: formInput?.value?.trim() || ""
    };

    const registroLocal = await guardarRegistroOffline(payload);

    const actual = Number(totalEscaneados?.textContent || 0);
    setText(totalEscaneados, actual + 1);

    const acumulado = Number(totalAcumuladoGeneral?.textContent || 0);
    setAcumuladoSeguro(acumulado + 1);

    agregarRegistroOfflineVisual(registroLocal);
    setStatus(`${barcodeLimpio} guardado. Enviando a la base...`, "ok");

    setTimeout(() => {
      sincronizarRegistrosOffline();
    }, 20);
  } catch (err) {
    console.error("Error guardando escaneo local:", err);
    setStatus("No se pudo guardar el escaneo localmente", "error");
  }
}

function encolarCodigo(codigoRaw) {
  const codigo = String(codigoRaw || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .trim();

  if (!codigo) return;

  if (!viajeActivo) {
    setStatus("Debes activar un viaje antes de escanear", "warn");
    return;
  }

  const esNumero = /^\d{2,}$/.test(codigo);

  // Acepta letra + número + cualquier cantidad de números después
  // Ejemplos válidos: A2, A2123, A399999, B14567
  const esLetraNumeroConSerial = /^[A-Z]\d+$/i.test(codigo);

  if (!esNumero && !esLetraNumeroConSerial) {
    setStatus(`Código inválido: ${codigo}`, "warn");
    return;
  }

  registrarEscaneoInstantaneo(codigo);
}
function procesarColaCodigos() {
  while (colaCodigos.length > 0 && escaneosActivos < MAX_ESCANEOS_PARALELOS) {
    const item = colaCodigos.shift();

    lectorProcesando = true;
    escaneando = true;
    escaneosActivos += 1;

    escanearCodigo(item.codigo, item.viaje)
      .finally(() => {
        escaneosActivos -= 1;

        if (colaCodigos.length > 0) {
          procesarColaCodigos();
          return;
        }

        if (escaneosActivos === 0) {
          lectorProcesando = false;
          escaneando = false;

          setTimeout(() => {
            focusBarcodeSeguro();
          }, 80);
        }
      });
  }
}

document.addEventListener("keydown", async (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  const caracter = obtenerCaracterDesdeTecla(e);

if (caracter !== null) {
  e.preventDefault();

  lectorBuffer += caracter;
  mostrarLectorGlobal();

  return;
}

  if (e.key === "Backspace") {
    if (!lectorBuffer) return;

    e.preventDefault();

    lectorBuffer = lectorBuffer.slice(0, -1);
    mostrarLectorGlobal();

    return;
  }

  if (e.key === "Escape") {
    e.preventDefault();

    limpiarLectorGlobal();
    setStatus("Código limpiado", "neutral");

    return;
  }

  if (e.key === "Enter" || e.key === "Tab") {
    if (!lectorBuffer.trim() && !barcodeInput?.value) return;

    e.preventDefault();

    const codigo = lectorBuffer || barcodeInput?.value || "";

    limpiarLectorGlobal();

    encolarCodigo(codigo);
  }
});

// =====================================================
// FALLBACK PARA PISTOLA QUE ESCRIBE DIRECTO EN EL INPUT
// =====================================================
if (barcodeInput) {
  barcodeInput.addEventListener("input", () => {
    const valor = String(barcodeInput.value || "")
  .replace(/[^A-Za-z0-9]/g, "")
  .toUpperCase();
    if (!valor) return;

    lectorBuffer = valor;

    if (barcodeVisible) {
      barcodeVisible.textContent = lectorBuffer;
    }
  });

  barcodeInput.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" && e.key !== "Tab") return;

    e.preventDefault();

    const codigo = lectorBuffer || barcodeInput.value;

    limpiarLectorGlobal();

    encolarCodigo(codigo);
  });
}async function refrescarDetalle() {
  if (!detalleBody) return;

  if (!viajeActivo) {
    setHTML(detalleBody, `
      <tr>
        <td colspan="11" class="empty-row">Sin registros todavía.</td>
      </tr>
    `);

    if (resumenVariedadBody) {
      resumenVariedadBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-row">Sin registros por variedad.</td>
        </tr>
      `;
    }

    return;
  }

  if (!mostrandoRegistrosHistoricos && !ultimosRegistrosEstaVisible()) {
    await pintarPendientesOfflineDelViaje();
    refrescarResumenPorVariedad();
    return;
  }

  try {
    const res = await fetch(`/api/viajes/${encodeURIComponent(viajeActivo)}/detalle`);
    if (!res.ok) {
      await pintarPendientesOfflineDelViaje();
      return;
    }

    const json = await res.json();

    cacheDetalle = json.data || [];
    await pintarPendientesOfflineDelViaje();

    renderDetalle(cacheDetalle);
    refrescarResumenPorVariedad();

  } catch (err) {
    console.error("Error refrescando detalle:", err);
    await pintarPendientesOfflineDelViaje();
  }
}

// =====================================================
// VER / OCULTAR REGISTROS DEL VIAJE DEL DÍA
// =====================================================
async function cargarRegistrosHistoricosDelViajeHoy() {
  if (!viajeActivo) {
    setStatus("Debes activar un viaje para consultar sus registros", "warn");
    return;
  }

  try {
    if (timerOcultarRegistrosHistoricos) {
      clearTimeout(timerOcultarRegistrosHistoricos);
      timerOcultarRegistrosHistoricos = null;
    }

    const res = await fetch(
      `/api/viajes/${encodeURIComponent(viajeActivo)}/detalle-hoy`
    );

    const json = await res.json();

    if (!res.ok || !json.ok) {
      setStatus(json.error || "No se pudieron cargar los registros del viaje", "error");
      return;
    }

    mostrandoRegistrosHistoricos = true;

    cacheDetalle = json.data || [];

    renderDetalle(cacheDetalle);
    refrescarResumenPorVariedad();

    setStatus(`Registros visibles por 6 segundos para ${viajeActivo}`, "ok");

    timerOcultarRegistrosHistoricos = setTimeout(() => {
      ocultarRegistrosHistoricosDelViaje();
    }, 6000);

  } catch (err) {
    console.error("Error cargando registros del viaje:", err);
    setStatus("Error cargando registros del viaje", "error");
  }
}

function ocultarRegistrosHistoricosDelViaje() {
  mostrandoRegistrosHistoricos = false;

  if (timerOcultarRegistrosHistoricos) {
    clearTimeout(timerOcultarRegistrosHistoricos);
    timerOcultarRegistrosHistoricos = null;
  }

  cacheDetalle = [];

  if (detalleBody) {
    detalleBody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-row">Sin registros visibles.</td>
      </tr>
    `;
  }

  if (resumenVariedadBody) {
    resumenVariedadBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">Sin registros por variedad.</td>
      </tr>
    `;
  }

  setStatus("Registros ocultos.", "neutral");
}
async function eliminarRegistro(idLocal) {
  if (!viajeActivo) return;

  const confirmar = confirm("¿Eliminar este registro del viaje actual?");
  if (!confirmar) return;

  try {
    const res = await fetch(`/api/viajes/${encodeURIComponent(viajeActivo)}/detalle/${idLocal}`, {
      method: "DELETE"
    });

    const json = await res.json();

    if (!json.ok) {
      setStatus(json.error || "No se pudo eliminar", "error");
      return;
    }

    setStatus("Registro eliminado del viaje actual", "ok");

    await conservarPosicionPantalla(async () => {
      await refrescarTodo();
    });
  } catch (err) {
    console.error("Error eliminando registro:", err);
    setStatus("Error al eliminar registro", "error");
  }
}

async function eliminarRegistroReal(barcode) {
  const confirmar = confirm(`¿Eliminar definitivamente el registro ${barcode} de la base de datos?`);
  if (!confirmar) return;

  try {
    const res = await fetch(`/api/registros/${encodeURIComponent(barcode)}`, {
      method: "DELETE"
    });

    const json = await res.json();

    if (!json.ok) {
      setStatus(json.error || "No se pudo eliminar de la base de datos", "error");
      await conservarPosicionPantalla(async () => {
        await recalcularTotalesViajeDesdeDetalle();
        await cargarContadorGeneralBD();
      });
      return;
    }

    setStatus(`Registro ${barcode} eliminado de la base de datos`, "ok");

    await conservarPosicionPantalla(async () => {
      await refrescarTodo();
      await recalcularTotalesViajeDesdeDetalle();

      const bloque = bloqueGeneralSelect?.value || "";
      const variedad = variedadGeneralSelect?.value || "";

      if (bloque) {
        await cargarResumenGeneralPorBloque(bloque, variedad);
        await cargarDetalleGeneralPorBloque(bloque, variedad);
      }
    });
  } catch (err) {
    console.error("Error eliminando registro real:", err);
    setStatus("Error eliminando de la base de datos", "error");
  }
}

async function refrescarTodo() {
  await refrescarResumen();
  await refrescarPivot();
  await refrescarDetalle();
  await refrescarResumenDesdeBD();
  await recalcularTotalesViajeDesdeDetalle();
  await cargarContadorGeneralBD();

  const bloqueSeleccionado = bloqueGeneralSelect?.value || "";
  const variedadSeleccionada = variedadGeneralSelect?.value || "";

  await cargarBloquesGenerales();

  if (bloqueSeleccionado) {
    await cargarVariedadesGeneralesPorBloque(bloqueSeleccionado, variedadSeleccionada);
    await cargarResumenGeneralPorBloque(bloqueSeleccionado, variedadSeleccionada);
    await cargarDetalleGeneralPorBloque(bloqueSeleccionado, variedadSeleccionada);
  }
}

function verDetalleFila(btn) {
  const tr = btn.closest("tr");

  const bloque = tr.dataset.bloque;
  const variedad = tr.dataset.variedad;
  const tamano = tr.dataset.tamano;
  const tallos = tr.dataset.tallos;
  const tabacos = tr.dataset.tabacos;
  const suma = tr.dataset.suma;

  alert(
    `DETALLE\n\n` +
    `Bloque: ${bloque}\n` +
    `Variedad: ${variedad}\n` +
    `Tamaño: ${tamano}\n` +
    `Tallos por tabaco: ${tallos}\n` +
    `Tabacos: ${tabacos}\n` +
    `Suma de tallos: ${suma}`
  );
}




function abrirModalYaRegistrados() {
  if (!modalYaRegistrados || !modalYaRegistradosBody) return;

  const duplicados = cacheYaRegistrados || [];

  if (!duplicados.length) {
    modalYaRegistradosBody.innerHTML = `
      <div class="empty-row">No hay registros duplicados para mostrar.</div>
    `;
  } else {
    modalYaRegistradosBody.innerHTML = duplicados.map((row) => {
      const fecha = row.fechaAnterior
        ? new Date(row.fechaAnterior).toLocaleString("es-CO")
        : (row.fecha ? new Date(row.fecha).toLocaleString("es-CO") : "Fecha no disponible");

      return `
        <div class="modal-dup-item">
          <strong>${row.barcode ?? "-"}</strong>
          <div class="modal-dup-meta">
            <div><strong>Variedad:</strong> ${row.variedad ?? "-"}</div>
            <div><strong>Bloque:</strong> ${row.bloque ?? "-"}</div>
            <div><strong>Tamaño:</strong> ${row.tamano ?? "-"}</div>
            <div><strong>Tallos:</strong> ${row.tallos ?? "-"}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  modalYaRegistrados.classList.add("show");
}

function cerrarModalYaRegistradosFn() {
  if (!modalYaRegistrados) return;
  modalYaRegistrados.classList.remove("show");
}

if (cardYaRegistrados) {
  cardYaRegistrados.addEventListener("click", () => {
    abrirModalYaRegistrados();
  });
}

if (cerrarModalYaRegistrados) {
  cerrarModalYaRegistrados.addEventListener("click", cerrarModalYaRegistradosFn);
}

if (modalYaRegistrados) {
  modalYaRegistrados.addEventListener("click", (e) => {
    if (e.target === modalYaRegistrados) {
      cerrarModalYaRegistradosFn();
    }
  });
}

if (finalizarBtn) {
  finalizarBtn.addEventListener("click", finalizarViaje);
}
if (verRegistrosViajeBtn) {
  verRegistrosViajeBtn.addEventListener("click", async () => {
    await cargarRegistrosHistoricosDelViajeHoy();
  });
}

if (ocultarRegistrosViajeBtn) {
  ocultarRegistrosViajeBtn.addEventListener("click", () => {
    ocultarRegistrosHistoricosDelViaje();
  });
}


if (variedadGeneralSelect) {
  variedadGeneralSelect.addEventListener("change", async () => {
    try {
      const bloque = bloqueGeneralSelect?.value || "";
      const variedad = variedadGeneralSelect.value;

      limpiarTotalesVariedadGlobal();

      if (variedadGlobalSelect) {
        variedadGlobalSelect.value = "";
      }

      guardarEstadoUI();

      await cargarResumenGeneralPorBloque(bloque, variedad);
      await cargarDetalleGeneralPorBloque(bloque, variedad);
    } finally {
      recuperarLectorDespuesDeControl(variedadGeneralSelect);
    }
  });
}
if (bloqueGeneralSelect) {
  bloqueGeneralSelect.addEventListener("change", async () => {
    try {
      const bloque = bloqueGeneralSelect.value;

      limpiarTotalesVariedadGlobal();

      if (variedadGlobalSelect) {
        variedadGlobalSelect.value = "";
      }

      if (!bloque) {
        limpiarConsultaGeneral();
        return;
      }

      guardarEstadoUI();

      await cargarVariedadesGeneralesPorBloque(bloque, "");

      if (variedadGeneralSelect) {
        variedadGeneralSelect.value = "";
      }

      await cargarResumenGeneralPorBloque(bloque, "");
      await cargarDetalleGeneralPorBloque(bloque, "");
    } finally {
      recuperarLectorDespuesDeControl(bloqueGeneralSelect);
    }
  });
}
if (variedadGlobalSelect) {
  variedadGlobalSelect.addEventListener("change", async () => {
    try {
      const variedad = variedadGlobalSelect.value || "";

      if (!variedad) {
        limpiarTotalesVariedadGlobal();
        limpiarConsultaGeneral();
        return;
      }

      if (bloqueGeneralSelect) {
        bloqueGeneralSelect.value = "";
      }

      if (variedadGeneralSelect) {
        variedadGeneralSelect.innerHTML = `
          <option value="">Seleccionar variedad</option>
        `;
      }

      guardarEstadoUI();

      await conservarPosicionPantalla(async () => {
        await cargarResumenGeneralPorVariedadGlobal(variedad);
        await cargarDetalleGeneralPorVariedadGlobal(variedad);
      });
    } finally {
      recuperarLectorDespuesDeControl(variedadGlobalSelect);
    }
  });
}
/////////////////////// AUTOFOCUS ESCANER ///////////////////////////////

function puedeRecuperarFoco() {

  const activo = document.activeElement;

  if (!activo) return true;

  const tag = activo.tagName?.toLowerCase();

  // NO ROBAR FOCO A ESTOS CONTROLES
  if (
    tag === "select" ||
    tag === "textarea"
  ) {
    return false;
  }

  // INPUTS NORMALES
  if (
    tag === "input" &&
    activo !== barcodeInput
  ) {
    return false;
  }

  return true;
}


// CLICK GENERAL
if (false) document.addEventListener("click", (e) => {

  const target = e.target;

  if (!target) return;

  const tag = target.tagName?.toLowerCase();

  // CONTROLES QUE NO DEBEN PERDER FOCO
  if (
    tag === "select" ||
    tag === "option" ||
    tag === "button" ||
    tag === "textarea"
  ) {
    return;
  }

  // INPUT NORMAL
  if (
    tag === "input" &&
    target !== barcodeInput
  ) {
    return;
  }

  setTimeout(() => {

    if (!escaneando) {
      focusBarcodeSeguro();
    }

  }, 250);
});

// AL VOLVER A LA PESTAÑA
if (false) document.addEventListener("visibilitychange", () => {

  if (!document.hidden) {

    setTimeout(() => {

      if (!escaneando) {
        focusBarcodeSeguro();
      }

    }, 300);
  }
});

document.addEventListener("pointerup", (e) => {
  const target = e.target;
  if (!target) return;

  const tag = target.tagName?.toLowerCase();

  if (tag === "select" || tag === "option" || tag === "textarea") return;
  if (tag === "input" && target !== barcodeInput) return;

  setTimeout(() => {
    if (!escaneando) focusBarcodeSeguro();
  }, 120);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;

  setTimeout(() => {
    if (!escaneando) activarLectorAutomatico(5, 180);
  }, 200);
});

window.addEventListener("focus", () => {
  setTimeout(() => {
    if (!escaneando) activarLectorAutomatico(5, 180);
  }, 150);
});

async function activarViajeInicialAutomatico() {
  const contenedor = document.getElementById("viajes-botones");
  if (!contenedor) return;

  const botones = Array.from(contenedor.querySelectorAll(".btn-viaje"));

  if (!botones.length) {
    limpiarResumenViaje();
    return;
  }

  // Busca específicamente el viaje 1
  const botonViaje1 = botones.find((btn) => {
    const texto = String(btn.textContent || "").trim().toLowerCase();
    return texto === "viaje 1" || texto === "1" || texto.includes("viaje 1");
  });

  // Si existe Viaje 1, activa ese. Si no existe, activa el primero disponible.
  const botonSeleccionado = botonViaje1 || botones[0];

  const nombreViaje = String(botonSeleccionado.textContent || "").trim();

  if (!nombreViaje) {
    limpiarResumenViaje();
    return;
  }

  await activarViaje(nombreViaje);
  activarLectorAutomatico(6, 180);
}
function actualizarEstadoInternet() {
  if (!internetStatus) return;

  if (navigator.onLine) {
    internetStatus.textContent = "En línea";
    internetStatus.classList.remove("offline");
    internetStatus.classList.add("online");
  } else {
    internetStatus.textContent = "Sin internet - modo Offline";
    internetStatus.classList.remove("online");
    internetStatus.classList.add("offline");
  }
}

window.addEventListener("load", async () => {

  if (!pedirAcceso()) return;

  actualizarEstadoInternet();

  setTimeout(() => {
    activarLectorAutomatico(12, 180);
  }, 150);

  setInterval(() => {
    if (escaneando) return;
    if (!puedeRecuperarFoco()) return;

    if (document.activeElement !== barcodeInput) {
      focusBarcodeSeguro();
    }
  }, 2000);

  await cargarContadorGeneralBD();
await cargarBloquesGenerales();
await cargarVariedadesGlobales();
await cargarCatalogoTiposOffline();
await cargarViajes();

  limpiarConsultaGeneral();

  await activarViajeInicialAutomatico();

  if (navigator.onLine) {
    setTimeout(async () => {
      await sincronizarRegistrosOffline();
    }, 1500);
  }

});

window.addEventListener("online", async () => {
  actualizarEstadoInternet();
  setStatus("Internet recuperado. Sincronizando pendientes...", "warn");

  try {
    await cargarCatalogoTiposOffline();
    await sincronizarRegistrosOffline();
  } catch (err) {
    console.error("Error sincronizando al volver internet:", err);
    setStatus("Error sincronizando registros pendientes", "error");
  }
});

window.addEventListener("offline", () => {
  actualizarEstadoInternet();
  setStatus("Sin internet. El sistema seguirá guardando en modo offline.", "warn");
});
