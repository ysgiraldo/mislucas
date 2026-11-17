// ===== Sesion (Cognito Hosted UI, Authorization Code + PKCE) =====
const C = window.CONFIG, REDIR = location.origin + location.pathname;
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sesion = () => { try { const s = JSON.parse(localStorage.sesion); return s.exp > Date.now() ? s : null; } catch { return null; } };

async function entrar() {
  const v = b64(crypto.getRandomValues(new Uint8Array(32)));
  sessionStorage.v = v;
  const ch = b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  location.href = `${C.COGNITO_DOMAIN}/oauth2/authorize?response_type=code&client_id=${C.CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIR)}&scope=openid+email&code_challenge_method=S256&code_challenge=${ch}`;
}
async function canjear(code) {
  const r = await fetch(`${C.COGNITO_DOMAIN}/oauth2/token`, { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: C.CLIENT_ID, code, redirect_uri: REDIR, code_verifier: sessionStorage.v }) });
  if (!r.ok) throw new Error("login");
  const t = await r.json();
  localStorage.sesion = JSON.stringify({ id: t.id_token, exp: Date.now() + t.expires_in * 1000 - 60000 });
}
function salir() { localStorage.removeItem("sesion"); location.href = `${C.COGNITO_DOMAIN}/logout?client_id=${C.CLIENT_ID}&logout_uri=${encodeURIComponent(REDIR)}`; }

// ===== Capa de API (la unica parte que habla con el servidor; reutilizable en una app nativa) =====
async function api(ruta, opciones = {}) {
  const s = sesion(); if (!s) return entrar();
  const r = await fetch(C.API_URL + ruta, { ...opciones, headers: { Authorization: `Bearer ${s.id}`, "Content-Type": "application/json" } });
  if (r.status === 401) { localStorage.removeItem("sesion"); return entrar(); }
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.error || "error");
  return datos;
}
const Api = {
  resumen: () => api("/resumen"),
  lista: () => api("/transacciones?limite=60"),
  crear: d => api("/transacciones", { method: "POST", body: JSON.stringify(d) }),
  editar: (id, d) => api(`/transacciones/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
  borrar: id => api(`/transacciones/${id}`, { method: "DELETE" }),
};

// ===== Vistas =====
const $ = s => document.querySelector(s), vista = $("#vista");
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

async function inicio() {
  const r = await Api.resumen();
  const cats = Object.entries(r.por_categoria).sort((a, b) => b[1] - a[1]), max = cats[0]?.[1] || 1;
  vista.innerHTML = `<h1>Resumen</h1>
  <div class="grid">
    <div class="card"><div class="k">Gasto hoy</div><div class="v">${peso(r.gasto_hoy)}</div></div>
    <div class="card"><div class="k">Gasto del mes</div><div class="v">${peso(r.gasto_mes)}</div></div>
    <div class="card"><div class="k">Ingresos del mes</div><div class="v">${peso(r.ingreso_mes)}</div></div>
    <div class="card"><div class="k">Cierre proyectado</div><div class="v">${peso(r.proyeccion_cierre)}</div></div>
  </div>
  ${r.alertas.length ? `<div class="card"><b>Alertas</b>${r.alertas.map(a => `<div class="alerta">${esc(a)}</div>`).join("")}</div>` : ""}
  <div class="card"><b>Gasto por categoría</b><br>${cats.length ? cats.map(([c, m]) => {
    const lim = r.presupuestos[c];
    return `<div style="margin-top:10px"><div class="fila" style="border:0;padding:0"><span>${esc(c)}</span><span>${peso(m)}${lim ? ` <span class="mut">/ ${peso(lim)}</span>` : ""}</span></div>
      <div class="barra" style="width:${Math.max(3, m / max * 100)}%;${lim && m > lim ? "background:var(--rojo)" : ""}"></div></div>`;
  }).join("") : '<p class="mut">Sin gastos este mes.</p>'}</div>`;
}

async function movimientos() {
  const lista = await Api.lista();
  const hoy = new Date().toISOString().slice(0, 10);
  vista.innerHTML = `<h1>Movimientos</h1>
  <div class="card"><b>Agregar</b>
    <select id="tipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option><option value="ahorro">Ahorro</option></select>
    <input id="monto" inputmode="numeric" placeholder="Monto (ej. 25000 o 25 mil)">
    <input id="cat" placeholder="Categoría (ej. comida)"><input id="desc" placeholder="Descripción (opcional)">
    <input id="fecha" type="date" value="${hoy}"><button class="p" id="guardar">Guardar</button><div id="err" class="mut"></div></div>
  <div class="card">${lista.length ? lista.map(t => `<div class="fila"><div><div>${esc(t.categoria)} <span class="mut">${esc(t.descripcion || "")}</span></div>
    <div class="mut">#${t.id} · ${esc(t.fecha)} · ${esc(t.tipo)}${t.origen === "correo" ? " · 📧" : ""}</div></div>
    <div style="text-align:right"><div>${peso(t.monto)}</div><button class="l" data-e="${t.id}">Editar</button><button class="l r" data-b="${t.id}">Borrar</button></div></div>`).join("")
    : '<p class="mut">Aún no hay movimientos.</p>'}</div>`;
  $("#guardar").onclick = async () => {
    try { await Api.crear({ tipo: $("#tipo").value, monto: $("#monto").value, categoria: $("#cat").value, descripcion: $("#desc").value, fecha: $("#fecha").value }); movimientos(); }
    catch (e) { $("#err").textContent = e.message; }
  };
  vista.querySelectorAll("[data-b]").forEach(b => b.onclick = async () => { if (confirm("¿Borrar este movimiento?")) { await Api.borrar(b.dataset.b); movimientos(); } });
  vista.querySelectorAll("[data-e]").forEach(b => b.onclick = async () => {
    const t = lista.find(x => x.id == b.dataset.e), monto = prompt("Monto:", t.monto); if (monto === null) return;
    const cat = prompt("Categoría:", t.categoria); if (cat === null) return;
    try { await Api.editar(t.id, { monto, categoria: cat }); movimientos(); } catch (e) { alert(e.message); }
  });
}

const VISTAS = { inicio, movimientos };
function ir(v) {
  document.querySelectorAll("#menu [data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  VISTAS[v]().catch(e => vista.innerHTML = `<div class="card">No pude cargar: ${esc(e.message)}</div>`);
}

(async function arrancar() {
  const code = new URLSearchParams(location.search).get("code");
  if (code) { try { await canjear(code); } catch { /* cae al login */ } history.replaceState(null, "", REDIR); }
  if (!sesion()) { vista.innerHTML = '<div class="centro"><h1>Mis lucas</h1><button class="p" id="login">Iniciar sesión</button></div>'; $("#login").onclick = entrar; return; }
  $("#menu").hidden = false; $("#salir").onclick = salir;
  document.querySelectorAll("#menu [data-v]").forEach(b => b.onclick = () => ir(b.dataset.v));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
  ir("inicio");
})();
