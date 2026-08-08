import React, { useState, useRef, useEffect } from "react";

const TURNOS = ["A", "B"];
const LINEAS = ["Ensamble", "Desarme"];

const CLIENTES = [
  "Minera Escondida",
  "Minera Radomiro Tomic",
  "Minera El Salvador",
  "Minera Gabriela Mistral",
  "Minera Centinela",
  "Kospo Power Service Ltda.",
  "Minera Antucoya",
  "Minera Spence",
  "Cia. Minera del Pacifico S.A",
  "Empresa Electrica Angamos SPA",
  "Empresa Electrica Cochrane SPA",
  "Codelco division PTMP",
  "Compañía Minera Zaldivar SPA",
  "SCM Minera Lumina Copper",
  "Minera Los Pelambres",
  "Codelco division Ministro Hales",
  "Codelco division Chuquicamata",
];

const SUPERVISORES = ["Bryan Mendoza", "Richard Williams", "Alexis Nuñez"];

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

const defaultActividad = () => ({
  id: Date.now() + Math.random(),
  fecha: new Date().toISOString().split("T")[0],
  linea: "Ensamble",
  nroLinea: "",
  turno: "B",
  ran: "",
  unidad: "",
  cliente: "",
  clienteManual: "",
  tecnicos: "",
  supervisor: "",
  supervisorManual: "",
  planificacion: "",
  planificacionManual: "",
  avance: 0,
  realizado: "",
  pendiente: "",
  observaciones: "",
  notaTraspaso: "",
  fotos: [],
});

// Convierte reportes de la versión anterior (con checklist de tareas) al
// formato de texto libre, sin perder nada de lo ya registrado.
const migrar = (a) => {
  if (!a || typeof a !== "object") return defaultActividad();
  const base = defaultActividad();
  if (!Array.isArray(a.tareas)) {
    return { ...base, ...a, avance: clamp(a.avance), fotos: a.fotos || [] };
  }
  const reales = a.tareas.filter((t) => !t.titulo);
  const fin = reales.filter((t) => t.estado === "finalizado");
  const pen = reales.filter((t) => t.estado === "pendiente");
  const aplicables = reales.filter((t) => t.estado !== "noaplica");
  const avanceCalc = aplicables.length ? Math.round((fin.length / aplicables.length) * 100) : 0;
  const { tareas, ...resto } = a;
  return {
    ...base,
    ...resto,
    avance: clamp(a.avance != null ? a.avance : avanceCalc),
    realizado: a.realizado || fin.map((t) => "• " + t.nombre).join("\n"),
    pendiente:
      a.pendiente ||
      pen.map((t) => "• " + t.nombre + (t.notaPendiente ? " — " + t.notaPendiente : "")).join("\n"),
    fotos: a.fotos || [],
  };
};

const tienePendiente = (a) => !!(a.pendiente || "").trim();

const STORAGE_KEY = "reporte_turno_data";

export default function ReporteTurno() {
  const [step, setStep] = useState("form");
  const [actividadAbierta, setActividadAbierta] = useState(null);
  const [actividades, setActividades] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [defaultActividad()];
      const data = JSON.parse(saved);
      if (!Array.isArray(data) || !data.length) return [defaultActividad()];
      return data.map(migrar);
    } catch {
      return [defaultActividad()];
    }
  });
  const cameraRefs = useRef({});
  const galleryRefs = useRef({});
  const importRef = useRef();

  // ── Entrega de turno ──────────────────────────────────────────────────────
  const [ranAbierto, setRanAbierto] = useState(null);

  // ── App instalable en el celular (PWA) ────────────────────────────────────
  const [instalador, setInstalador] = useState(null);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e) => { e.preventDefault(); setInstalador(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const instalarApp = async () => {
    if (!instalador) return;
    instalador.prompt();
    await instalador.userChoice;
    setInstalador(null);
  };

  useEffect(() => {
    try {
      const sinFotos = actividades.map((a) => ({ ...a, fotos: [] }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sinFotos));
    } catch {}
  }, [actividades]);

  const addActividad = () => {
    const ultima = actividades[actividades.length - 1];
    const nueva = defaultActividad();
    // Se arrastra el encabezado común del turno para no reescribirlo cada vez.
    if (ultima) {
      nueva.fecha = ultima.fecha;
      nueva.turno = ultima.turno;
      nueva.supervisor = ultima.supervisor;
      nueva.supervisorManual = ultima.supervisorManual;
      nueva.planificacion = ultima.planificacion;
      nueva.planificacionManual = ultima.planificacionManual;
    }
    setActividades((p) => [...p, nueva]);
    setActividadAbierta(nueva.id);
  };
  const removeActividad = (id) => setActividades((p) => p.filter((a) => a.id !== id));
  const moverActividad = (id, dir) => {
    setActividades((p) => {
      const idx = p.findIndex((a) => a.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= p.length) return p;
      const arr = [...p];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };
  const updateActividad = (id, field, value) =>
    setActividades((p) => p.map((a) => (a.id === id ? { ...a, [field]: value } : a)));

  const comprimirImagen = (file, maxW = 1200, quality = 0.65) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

  const handleFotos = (id, files) => {
    Array.from(files).forEach(async (file) => {
      const dataUrl = await comprimirImagen(file);
      setActividades((p) =>
        p.map((a) =>
          a.id === id ? { ...a, fotos: [...(a.fotos || []), { dataUrl, name: file.name }] } : a
        )
      );
    });
  };
  const removeFoto = (actId, idx) =>
    setActividades((p) =>
      p.map((a) => (a.id === actId ? { ...a, fotos: a.fotos.filter((_, i) => i !== idx) } : a))
    );

  const limpiarTodo = () => {
    if (confirm("¿Limpiar todo y comenzar un nuevo reporte?")) {
      localStorage.removeItem(STORAGE_KEY);
      setActividades([defaultActividad()]);
      setStep("form");
    }
  };

  const exportarJSON = () => {
    const datos = actividades.map((a) => ({ ...a, fotos: [] }));
    const json = JSON.stringify(datos, null, 2);
    const fecha = new Date().toLocaleDateString("es-CL").replace(/\//g, "-");
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-turno-${fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importarJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const datos = JSON.parse(ev.target.result);
        if (Array.isArray(datos)) {
          setActividades(datos.map(migrar));
          setStep("form");
          alert("✅ Reporte cargado correctamente");
        } else if (datos?.tipo === "entrega-turno" && Array.isArray(datos.actividades)) {
          setActividades(datos.actividades.map(migrar));
          setStep("form");
          alert("✅ Reporte cargado correctamente");
        } else {
          alert("❌ Archivo inválido");
        }
      } catch {
        alert("❌ Error al leer el archivo");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── PDF: ACTA DE ENTREGA DE TURNO ─────────────────────────────────────────
  const handleExportPDF = () => {
    const esc = (t) => String(t ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const nl = (t) => esc(t).replace(/\n/g, "<br/>");

    const datos = actividades.map((a, i) => ({
      i,
      a,
      avance: clamp(a.avance),
      cliente: a.cliente === "__manual__" ? a.clienteManual : a.cliente,
      supervisor: a.supervisor === "__manual__" ? a.supervisorManual : a.supervisor,
      planificacion: a.planificacion === "__manual__" ? a.planificacionManual : a.planificacion,
      realizado: (a.realizado || "").trim(),
      pendiente: (a.pendiente || "").trim(),
    }));

    const equiposConPend = datos.filter((d) => d.pendiente).length;
    const avgAvance = datos.length ? Math.round(datos.reduce((n, d) => n + d.avance, 0) / datos.length) : 0;
    const p0 = datos[0]?.a || {};
    const fechaTurno = p0.fecha
      ? new Date(p0.fecha + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("es-CL");
    const emitido = new Date().toLocaleString("es-CL");
    const folio = `ET-${(p0.fecha || "").replace(/-/g, "")}-T${p0.turno || ""}`;

    // Código de verificación: se deriva del contenido del acta. Si algún dato
    // cambia después de emitido, el código ya no corresponde.
    const huella = JSON.stringify(datos.map((d) => [d.a.ran, d.avance, d.realizado, d.pendiente, d.a.notaTraspaso]));
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let k = 0; k < huella.length; k++) {
      h1 = (h1 ^ huella.charCodeAt(k)) >>> 0;
      h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 + huella.charCodeAt(k) * (k + 7)) >>> 0;
    }
    const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const trozo = (n) => { let r = ""; for (let k = 0; k < 4; k++) { r += alfabeto[n % 32]; n = Math.floor(n / 32); } return r; };
    const codigo = `${trozo(h1)}-${trozo(h2)}`;

    const barra = (pct) => {
      const col = pct === 100 ? "#1B7A4B" : pct >= 60 ? "#C9822E" : "#B3261E";
      return `<div style="display:flex;align-items:center;gap:5px;">
        <div style="flex:1;background:#E2E8F0;border-radius:99px;height:5px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${col};border-radius:99px;"></div>
        </div>
        <span style="font-size:9px;font-weight:800;color:${col};min-width:26px;text-align:right;">${pct}%</span>
      </div>`;
    };

    // ── HOJA 1: ACTA ─────────────────────────────────────────────────────────
    const filasResumen = datos.map((d) => `
      <tr>
        <td style="padding:5px 7px;border-bottom:1px solid #E8EBEE;font-family:monospace;font-weight:700;font-size:10px;">${esc(d.a.ran || "—")}</td>
        <td style="padding:5px 7px;border-bottom:1px solid #E8EBEE;">
          <span style="font-size:8px;font-weight:800;color:#fff;background:${d.a.linea === "Ensamble" ? "#2F6E8F" : "#A15A32"};border-radius:3px;padding:1px 5px;">${d.a.linea === "Ensamble" ? "ENS" : "DES"}</span>
        </td>
        <td style="padding:5px 7px;border-bottom:1px solid #E8EBEE;font-size:10px;">${esc(d.a.unidad || "—")}</td>
        <td style="padding:5px 7px;border-bottom:1px solid #E8EBEE;font-size:9px;color:#4B5560;">${esc(d.cliente || "—")}</td>
        <td style="padding:5px 7px;border-bottom:1px solid #E8EBEE;width:90px;">${barra(d.avance)}</td>
        <td style="padding:5px 7px;border-bottom:1px solid #E8EBEE;text-align:center;">
          ${d.pendiente
            ? `<span style="background:#FDF0DC;color:#8A5A1E;font-weight:800;font-size:10px;border-radius:9px;padding:1px 7px;">SÍ</span>`
            : `<span style="color:#1B7A4B;font-weight:800;font-size:10px;">✓</span>`}
        </td>
      </tr>`).join("");

    const acta = `
      <div style="border:1.5px solid #141A21;border-radius:6px;overflow:hidden;">
        <div style="background:#141A21;padding:12px 16px;display:flex;justify-content:space-between;align-items:flex-end;">
          <div>
            <div style="color:#E0A245;font-size:9px;font-weight:800;letter-spacing:0.16em;">SM CYCLO DE CHILE LTDA. · SMAN ANTOFAGASTA</div>
            <div style="color:#fff;font-size:17px;font-weight:800;letter-spacing:-0.3px;margin-top:2px;">ACTA DE ENTREGA DE TURNO</div>
          </div>
          <div style="text-align:right;color:#94A3B8;font-size:9px;font-family:monospace;">
            <div>FOLIO ${esc(folio)}</div>
            <div>${esc(emitido)}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E2E8F0;">
          ${[["FECHA DEL TURNO", fechaTurno], ["TURNO", p0.turno ? "Turno " + p0.turno : "—"],
             ["SUPERVISOR", datos[0]?.supervisor || "—"], ["PLANIFICACIÓN", datos[0]?.planificacion || "—"]]
            .map(([k, v]) => `<div style="background:#F8FAFC;padding:6px 9px;">
              <div style="font-size:7px;font-weight:800;color:#64748B;letter-spacing:0.08em;">${k}</div>
              <div style="font-size:10px;font-weight:700;color:#141A21;margin-top:1px;">${esc(v)}</div>
            </div>`).join("")}
        </div>

        <div style="padding:12px 16px;">
          <div style="display:flex;gap:10px;margin-bottom:12px;">
            <div style="flex:1;border:1px solid #E2E8F0;border-radius:5px;padding:8px 10px;text-align:center;">
              <div style="font-size:20px;font-weight:800;color:#141A21;">${datos.length}</div>
              <div style="font-size:8px;font-weight:700;color:#64748B;letter-spacing:0.06em;">EQUIPOS EN TURNO</div>
            </div>
            <div style="flex:1;border:1.5px solid #E0A245;background:#FFF8ED;border-radius:5px;padding:8px 10px;text-align:center;">
              <div style="font-size:20px;font-weight:800;color:#8A5A1E;">${equiposConPend}</div>
              <div style="font-size:8px;font-weight:800;color:#8A5A1E;letter-spacing:0.06em;">EQUIPOS CON PENDIENTES</div>
            </div>
            <div style="flex:1;border:1px solid #E2E8F0;border-radius:5px;padding:8px 10px;text-align:center;">
              <div style="font-size:20px;font-weight:800;color:#141A21;">${avgAvance}%</div>
              <div style="font-size:8px;font-weight:700;color:#64748B;letter-spacing:0.06em;">AVANCE PROMEDIO</div>
            </div>
          </div>

          <div style="font-size:8px;font-weight:800;color:#64748B;letter-spacing:0.09em;margin-bottom:5px;">DETALLE DE EQUIPOS</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#F1F5F9;">
                ${["RAN", "LÍNEA", "EQUIPO / UNIDAD", "CLIENTE", "AVANCE", "PEND."].map((h, k) =>
                  `<th style="padding:5px 7px;text-align:${k === 4 || k === 5 ? "center" : "left"};font-size:7.5px;font-weight:800;color:#4B5560;letter-spacing:0.07em;border-bottom:1.5px solid #CBD5E1;">${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${filasResumen}</tbody>
          </table>
        </div>

        <div style="border-top:1.5px solid #141A21;padding:11px 16px;background:#F8FAFC;">
          <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:16px;align-items:end;">
            <div>
              <div style="font-size:7.5px;font-weight:800;color:#64748B;letter-spacing:0.08em;">SUPERVISOR DE TURNO</div>
              <div style="font-size:11px;font-weight:700;color:#141A21;">${esc(datos[0]?.supervisor) || "—"}</div>
              <div style="font-size:8px;color:#64748B;">Turno ${esc(p0.turno || "—")} · SMAN Antofagasta</div>
            </div>
            <div>
              <div style="font-size:7.5px;font-weight:800;color:#64748B;letter-spacing:0.08em;">PLANIFICACIÓN Y CONTROL</div>
              <div style="font-size:11px;font-weight:700;color:#141A21;">${esc(datos[0]?.planificacion) || "—"}</div>
              <div style="font-size:8px;color:#64748B;">Planificación y Control de Producción</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:7.5px;font-weight:800;color:#64748B;letter-spacing:0.08em;">CÓDIGO DE VERIFICACIÓN</div>
              <div style="font-family:monospace;font-size:13px;font-weight:800;color:#141A21;letter-spacing:0.08em;">${codigo}</div>
              <div style="font-size:7.5px;color:#64748B;">Emitido ${esc(emitido)}</div>
            </div>
          </div>
          <div style="font-size:7.5px;color:#8A93A0;margin-top:8px;line-height:1.4;">
            Documento generado automáticamente desde el sistema de Reporte de Turno. El código de verificación se calcula a partir del contenido del acta; cualquier modificación posterior invalida su correspondencia.
          </div>
        </div>
      </div>`;

    // ── HOJA 2: PENDIENTES CONSOLIDADOS ──────────────────────────────────────
    const conPend = datos.filter((d) => d.pendiente || d.a.notaTraspaso);
    const hojaPendientes = `
      <div style="break-before:page;page-break-before:always;">
        <div style="background:#141A21;padding:9px 14px;border-radius:5px 5px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <div style="color:#fff;font-size:13px;font-weight:800;">PENDIENTES PARA EL TURNO ENTRANTE</div>
          <div style="color:#E0A245;font-size:11px;font-weight:800;">${equiposConPend} equipo${equiposConPend !== 1 ? "s" : ""}</div>
        </div>
        <div style="border:1px solid #E2E8F0;border-top:none;border-radius:0 0 5px 5px;padding:10px 14px;">
        ${conPend.length === 0
          ? `<div style="font-size:11px;color:#1B7A4B;font-weight:700;padding:8px 0;">Sin pendientes registrados. Todos los equipos quedan al día.</div>`
          : conPend.map((d) => `
            <div style="margin-bottom:11px;break-inside:avoid;">
              <div style="display:flex;align-items:center;gap:6px;border-bottom:1.5px solid #141A21;padding-bottom:3px;margin-bottom:5px;">
                <span style="font-size:8px;font-weight:800;color:#fff;background:${d.a.linea === "Ensamble" ? "#2F6E8F" : "#A15A32"};border-radius:3px;padding:1px 5px;">${d.a.linea === "Ensamble" ? "ENS" : "DES"}</span>
                <span style="font-family:monospace;font-size:12px;font-weight:800;">RAN ${esc(d.a.ran || "—")}</span>
                <span style="font-size:10px;color:#4B5560;">${esc(d.a.unidad || "")}</span>
                <span style="margin-left:auto;font-size:9px;font-weight:800;color:#8A5A1E;">${d.avance}% avance</span>
              </div>
              ${d.pendiente ? `
                <div style="background:#FFF8ED;border-left:3px solid #E0A245;padding:5px 8px;margin-bottom:3px;">
                  <div style="font-size:10.5px;color:#141A21;line-height:1.45;">${nl(d.pendiente)}</div>
                </div>` : ""}
              ${d.a.notaTraspaso ? `
                <div style="background:#F1F5F9;border-left:3px solid #141A21;padding:5px 8px;margin-top:4px;">
                  <div style="font-size:7.5px;font-weight:800;color:#64748B;letter-spacing:0.07em;">INSTRUCCIÓN</div>
                  <div style="font-size:10px;color:#141A21;font-weight:600;line-height:1.45;">${nl(d.a.notaTraspaso)}</div>
                </div>` : ""}
            </div>`).join("")}
        </div>
      </div>`;

    // ── HOJAS 3+: DETALLE POR EQUIPO ─────────────────────────────────────────
    const hojasDetalle = datos.map((d) => `
      <div style="break-before:page;page-break-before:always;">
        <div style="background:#141A21;padding:9px 14px;border-radius:5px 5px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="color:#fff;font-size:13px;font-weight:800;font-family:monospace;">RAN ${esc(d.a.ran || "—")}</div>
            <div style="color:#94A3B8;font-size:9px;">${esc(d.a.unidad || "")}${d.cliente ? " · " + esc(d.cliente) : ""}</div>
          </div>
          <div style="text-align:right;">
            <div style="color:#E0A245;font-size:9px;font-weight:800;">${d.a.linea.toUpperCase()}${d.a.nroLinea ? " N°" + esc(d.a.nroLinea) : ""}</div>
            <div style="color:#fff;font-size:15px;font-weight:800;">${d.avance}%</div>
          </div>
        </div>
        <div style="border:1px solid #E2E8F0;border-top:none;border-radius:0 0 5px 5px;padding:9px 14px;">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:8px;">
            ${[["TÉCNICOS", d.a.tecnicos], ["SUPERVISOR", d.supervisor], ["TURNO", d.a.turno ? "Turno " + d.a.turno : ""]]
              .filter(([, v]) => v).map(([k, v]) => `<div>
                <div style="font-size:7px;font-weight:800;color:#64748B;">${k}</div>
                <div style="font-size:9.5px;font-weight:600;color:#141A21;">${esc(v)}</div>
              </div>`).join("")}
          </div>

          <div style="border:1.5px solid #1B7A4B;background:#F4FBF7;border-radius:5px;padding:7px 9px;margin-bottom:7px;">
            <div style="font-size:8.5px;font-weight:800;color:#1B7A4B;letter-spacing:0.07em;margin-bottom:4px;">TRABAJO REALIZADO EN EL TURNO</div>
            <div style="font-size:10.5px;color:#141A21;line-height:1.5;">${d.realizado ? nl(d.realizado) : "<span style='color:#94A3B8;'>Sin registro.</span>"}</div>
          </div>

          ${d.pendiente ? `
            <div style="border:1.5px solid #E0A245;background:#FFF8ED;border-radius:5px;padding:7px 9px;">
              <div style="font-size:8.5px;font-weight:800;color:#8A5A1E;letter-spacing:0.07em;margin-bottom:4px;">⚠ PENDIENTE PARA EL PRÓXIMO TURNO</div>
              <div style="font-size:10.5px;color:#141A21;line-height:1.5;">${nl(d.pendiente)}</div>
            </div>` : `
            <div style="border:1px solid #1B7A4B;background:#DCF2E5;border-radius:5px;padding:6px 9px;font-size:10px;font-weight:700;color:#1B7A4B;">
              ✓ Sin pendientes en este equipo
            </div>`}

          ${d.a.notaTraspaso ? `
            <div style="background:#F1F5F9;border-left:3px solid #141A21;padding:5px 9px;margin-top:6px;">
              <div style="font-size:7.5px;font-weight:800;color:#64748B;letter-spacing:0.07em;">INSTRUCCIÓN PARA EL TURNO ENTRANTE</div>
              <div style="font-size:10px;color:#141A21;font-weight:600;line-height:1.45;">${nl(d.a.notaTraspaso)}</div>
            </div>` : ""}

          ${d.a.observaciones ? `
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:5px;padding:5px 9px;margin-top:6px;font-size:9.5px;color:#4B5560;line-height:1.45;">
              <strong style="font-size:7.5px;color:#64748B;">OBSERVACIONES</strong><br/>${nl(d.a.observaciones)}
            </div>` : ""}

          ${d.a.fotos?.length ? `
            <div style="margin-top:8px;">
              <div style="font-size:7.5px;font-weight:800;color:#64748B;letter-spacing:0.07em;margin-bottom:3px;">REGISTRO FOTOGRÁFICO</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">
                ${d.a.fotos.slice(0, 6).map((f) => `<img src="${f.dataUrl}" style="width:100%;height:74px;object-fit:cover;border-radius:3px;border:1px solid #E2E8F0;" />`).join("")}
              </div>
            </div>` : ""}
        </div>
      </div>`).join("");

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Acta de Entrega de Turno — ${esc(folio)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{background:#fff;font-family:'Segoe UI',system-ui,sans-serif;color:#141A21;}
  @page{margin:11mm;size:letter;}
  @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  table{border-collapse:collapse;}
</style></head>
<body>
  ${acta}
  ${hojaPendientes}
  ${hojasDetalle}
  <script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  };

  // ── PREVIEW ────────────────────────────────────────────────────────────────
  if (step === "preview") {
    return (
      <div style={S.root}>
        <div style={S.container}>
          <div style={S.topBar}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 24 }}>📋</div>
              <div>
                <div style={S.topBarTitle}>Resumen del Reporte</div>
                <div style={S.topBarSub}>{actividades.length} actividad{actividades.length !== 1 ? "es" : ""} registrada{actividades.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
          </div>

          <div style={S.shareBar}>
            <button style={{ ...S.shareBtn, background: "#141A21", color: "#fff", border: "none" }} onClick={handleExportPDF}>
              📄 Exportar PDF
            </button>
            <button style={S.shareBtn} onClick={() => setStep("entrega")}>← Volver a entrega</button>
          </div>

          <button style={{ ...S.btnPrimary, background: "#C9822E", marginBottom: 20 }} onClick={() => setStep("entrega")}>
            🤝 Entregar turno →
          </button>

          {actividades.map((a, i) => {
            const avance = clamp(a.avance);
            const fecha = new Date(a.fecha + "T12:00:00").toLocaleDateString("es-CL", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            });
            const clienteLabel = a.cliente === "__manual__" ? a.clienteManual : a.cliente;
            const supervisorLabel = a.supervisor === "__manual__" ? a.supervisorManual : a.supervisor;
            const planificacionLabel = a.planificacion === "__manual__" ? a.planificacionManual : a.planificacion;
            const nroLinea = a.nroLinea ? ` N°${a.nroLinea}` : "";
            return (
              <div key={a.id} style={S.previewCard}>
                <div style={S.previewCardTopBar}>
                  <div style={{ fontSize: 18 }}>📋</div>
                  <div>
                    <div style={S.previewCardBarTitle}>Turno {a.turno} — {a.linea}{nroLinea} — Actividad {i + 1}</div>
                    <div style={S.previewCardBarSub}>{fecha}</div>
                  </div>
                </div>
                <div style={S.previewCardMeta}>
                  {a.ran && <span style={{ ...S.metaChip, background: "#FDF0DC", color: "#8A5A1E" }}>📋 RAN: {a.ran}</span>}
                  {a.unidad && <span style={{ ...S.metaChip, background: "#EFF6FF", color: "#1D4ED8" }}>🔧 {a.unidad}</span>}
                  {clienteLabel && <span style={{ ...S.metaChip, background: "#F3E8FF", color: "#6B21A8" }}>🏢 {clienteLabel}</span>}
                  {a.tecnicos && <span style={{ ...S.metaChip, background: "#F0FDF4", color: "#166534" }}>👷 {a.tecnicos}</span>}
                  {supervisorLabel && <span style={{ ...S.metaChip, background: "#F8FAFC", color: "#334155" }}>👤 {supervisorLabel}</span>}
                  {planificacionLabel && <span style={{ ...S.metaChip, background: "#FFF7ED", color: "#9A3412" }}>📋 Plan: {planificacionLabel}</span>}
                </div>
                <div style={S.previewCardBody}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={S.previewLabel}>AVANCE</span>
                    <div style={{ flex: 1, background: "#E2E8F0", borderRadius: 99, height: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 99, width: `${avance}%`, background: avance === 100 ? "#1B7A4B" : avance >= 60 ? "#C9822E" : "#B3261E" }} />
                    </div>
                    <span style={S.avancePct}>{avance}%</span>
                  </div>

                  <div style={S.previewLabel}>TRABAJO REALIZADO</div>
                  <div style={S.cajaRealizadoPreview}>
                    {(a.realizado || "").trim() || "Sin registro."}
                  </div>

                  <div style={{ ...S.previewLabel, marginTop: 12 }}>PENDIENTE</div>
                  {tienePendiente(a) ? (
                    <div style={S.cajaPendientePreview}>{a.pendiente}</div>
                  ) : (
                    <div style={S.cajaSinPendiente}>✓ Sin pendientes en este equipo</div>
                  )}

                  {a.observaciones && <div style={{ ...S.obsBox, marginTop: 12 }}>📝 {a.observaciones}</div>}
                  {a.fotos?.length > 0 && (
                    <div style={S.fotoPreviewGrid}>
                      {a.fotos.map((f, fi) => (
                        <div key={fi} style={S.fotoPreviewWrap}>
                          <img src={f.dataUrl} alt={f.name} style={S.fotoPreviewImg} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── ENTREGA DE TURNO ───────────────────────────────────────────────────────
  if (step === "entrega") {
    const resumen = actividades.map((a, i) => ({
      idx: i,
      act: a,
      avance: clamp(a.avance),
      pend: tienePendiente(a),
      cliente: a.cliente === "__manual__" ? a.clienteManual : a.cliente,
    }));
    const equiposConPend = resumen.filter((r) => r.pend).length;
    const avancePromedio = resumen.length
      ? Math.round(resumen.reduce((n, r) => n + r.avance, 0) / resumen.length)
      : 0;

    return (
      <div style={S.root}>
        <div style={S.container}>
          <div style={S.topBar}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 26 }}>🤝</div>
              <div>
                <div style={S.topBarTitle}>Entrega de Turno</div>
                <div style={S.topBarSub}>
                  {resumen.length} RAN · {equiposConPend} con pendientes · {avancePromedio}% avance
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button style={{ ...S.shareBtn, flex: 1 }} onClick={() => setStep("form")}>← Editar actividades</button>
            <button style={{ ...S.shareBtn, flex: 1 }} onClick={() => setStep("preview")}>Ver detalle completo</button>
          </div>

          {/* ── TABLA RESUMEN ── */}
          <div style={S.section}>
            <div style={S.sectionLabel}>EQUIPOS EN ESTE TURNO</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: "0", fontSize: 12 }}>
              <div style={S.thEntrega}>RAN</div>
              <div style={S.thEntrega}>Equipo</div>
              <div style={{ ...S.thEntrega, textAlign: "center" }}>Av.</div>
              <div style={{ ...S.thEntrega, textAlign: "center" }}>Pend.</div>
              {resumen.map((r) => (
                <React.Fragment key={r.act.id}>
                  <div style={S.tdEntrega}>
                    <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{r.act.ran || "—"}</span>
                  </div>
                  <div style={S.tdEntrega}>{r.act.unidad || "—"}</div>
                  <div style={{ ...S.tdEntrega, textAlign: "center", fontWeight: 700 }}>{r.avance}%</div>
                  <div style={{ ...S.tdEntrega, textAlign: "center" }}>
                    {r.pend
                      ? <span style={{ color: "#8A5A1E", fontWeight: 800 }}>SÍ</span>
                      : <span style={{ color: "#1B7A4B", fontWeight: 800 }}>✓</span>}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ── DETALLE POR RAN ── */}
          <div style={{ ...S.sectionLabel, marginBottom: 8, marginTop: 4 }}>DETALLE POR EQUIPO</div>

          {resumen.map((r) => {
            const abierto = ranAbierto === r.act.id;
            const lineaColor = r.act.linea === "Ensamble" ? "#2F6E8F" : "#A15A32";
            return (
              <div key={r.act.id} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                <div
                  onClick={() => setRanAbierto(abierto ? null : r.act.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", background: abierto ? "#F1F5F9" : "#fff", userSelect: "none" }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: lineaColor, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>
                    {r.act.linea === "Ensamble" ? "ENS" : "DES"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#141A21", fontFamily: "monospace" }}>
                      RAN {r.act.ran || "sin N°"}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.act.unidad || "—"}{r.cliente ? ` · ${r.cliente}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {r.pend ? (
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#8A5A1E" }}>con pendiente</div>
                    ) : (
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#1B7A4B" }}>✓ al día</div>
                    )}
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{r.avance}%</div>
                  </div>
                  <span style={{ fontSize: 10, color: "#94A3B8" }}>{abierto ? "▼" : "▶"}</span>
                </div>

                {abierto && (
                  <div style={{ padding: "10px 12px", borderTop: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#1B7A4B", marginBottom: 5, letterSpacing: "0.05em" }}>
                      TRABAJO REALIZADO
                    </div>
                    <div style={S.cajaRealizadoPreview}>
                      {(r.act.realizado || "").trim() || "Sin registro."}
                    </div>

                    <div style={{ fontSize: 10, fontWeight: 700, color: "#8A5A1E", margin: "10px 0 5px", letterSpacing: "0.05em" }}>
                      PENDIENTE EN ESTE RAN
                    </div>
                    {r.pend ? (
                      <div style={S.cajaPendientePreview}>{r.act.pendiente}</div>
                    ) : (
                      <div style={S.cajaSinPendiente}>✓ Sin pendientes en este equipo</div>
                    )}

                    <label style={{ ...S.label, marginTop: 10 }}>Instrucción para el turno entrante</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 56, fontSize: 13 }}
                      placeholder="Qué debe hacer el próximo turno con este equipo..."
                      value={r.act.notaTraspaso || ""}
                      onChange={(e) => updateActividad(r.act.id, "notaTraspaso", e.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}

          <button style={{ ...S.btnPrimary, marginTop: 8 }} onClick={handleExportPDF}>
            📄 Exportar PDF del acta
          </button>
          <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
            Se abre el acta lista para imprimir. En el cuadro de impresión elige "Guardar como PDF" para adjuntarla al correo.
          </div>
        </div>
      </div>
    );
  }

  // ── FORM ───────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      <div style={S.container}>
        <div style={S.topBar}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 26 }}>📋</div>
              <div>
                <div style={S.topBarTitle}>Reporte de Turno</div>
                <div style={S.topBarSub}>Informe diario de actividades</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="file" accept=".json" style={{ display: "none" }} ref={importRef} onChange={importarJSON} />
              {instalador && (
                <button onClick={instalarApp} style={{ ...S.clearBtn, background: "#C9822E", border: "none", color: "#141A21", fontWeight: 700 }} title="Instalar como app">⬇️ Instalar</button>
              )}
              <button onClick={exportarJSON} style={S.clearBtn} title="Guardar como archivo">💾</button>
              <button onClick={() => importRef.current?.click()} style={S.clearBtn} title="Cargar archivo">📂</button>
              <button onClick={limpiarTodo} style={S.clearBtn} title="Nuevo reporte">🗑</button>
            </div>
          </div>
        </div>

        {actividades.map((a, i) => {
          const avance = clamp(a.avance);
          const abierta = actividadAbierta === a.id;
          const clienteLabel = a.cliente === "__manual__" ? a.clienteManual : a.cliente;
          const nroLinea = a.nroLinea ? ` N°${a.nroLinea}` : "";
          const lineaColor = a.linea === "Ensamble" ? "#2F6E8F" : "#A15A32";
          const avanceColor = avance === 100 ? "#1B7A4B" : avance >= 60 ? "#C9822E" : "#B3261E";
          return (
            <div key={a.id} style={{ background:"#fff", borderRadius:10, marginBottom:6, border:"1px solid #E2E8F0", overflow:"hidden" }}>

              {/* ── CABECERA ── */}
              <div style={{ display:"flex", alignItems:"stretch" }}>
                <div style={{ display:"flex", flexDirection:"column", borderRight:"1px solid #E2E8F0", flexShrink:0 }}>
                  <button disabled={i===0} onClick={()=>moverActividad(a.id,-1)} style={{ flex:1, width:28, border:"none", background:"transparent", cursor:i===0?"default":"pointer", color:i===0?"#CBD5E1":"#64748B", fontSize:13, borderBottom:"1px solid #E2E8F0" }}>▲</button>
                  <button disabled={i===actividades.length-1} onClick={()=>moverActividad(a.id,1)} style={{ flex:1, width:28, border:"none", background:"transparent", cursor:i===actividades.length-1?"default":"pointer", color:i===actividades.length-1?"#CBD5E1":"#64748B", fontSize:13 }}>▼</button>
                </div>
                <div onClick={()=>setActividadAbierta(abierta?null:a.id)} style={{ flex:1, display:"flex", alignItems:"center", gap:8, padding:"9px 11px", cursor:"pointer", background:abierta?"#F1F5F9":"#fff", userSelect:"none", minWidth:0 }}>
                  <div style={{ background:abierta?"#141A21":"#E2E8F0", color:abierta?"#fff":"#64748B", borderRadius:5, width:22, height:22, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, fontWeight:700, color:"#fff", background:lineaColor, borderRadius:4, padding:"1px 6px", flexShrink:0 }}>{a.linea}{nroLinea}</span>
                      {a.ran && <span style={{ fontSize:12, fontWeight:700, color:"#141A21" }}>RAN {a.ran}</span>}
                      {a.unidad && <span style={{ fontSize:11, color:"#64748B" }}>· {a.unidad}</span>}
                      {tienePendiente(a) && <span style={{ fontSize:9, fontWeight:800, color:"#8A5A1E", background:"#FDF0DC", borderRadius:4, padding:"1px 5px" }}>PEND.</span>}
                    </div>
                    {clienteLabel && <div style={{ fontSize:10, color:"#94A3B8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{clienteLabel}</div>}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2, flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:800, color:avanceColor }}>{avance}%</span>
                    <div style={{ width:44, background:"#E2E8F0", borderRadius:99, height:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:99, width:`${avance}%`, background:avanceColor }} />
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:"#94A3B8", flexShrink:0, transform:abierta?"rotate(180deg)":"none", transition:"transform 0.2s" }}>▼</div>
                </div>
              </div>

              {/* ── CUERPO ── */}
              {abierta && (<div style={{ padding:"12px 11px", borderTop:"1px solid #E2E8F0" }}>
              <div style={S.sectionLabel}>ENCABEZADO</div>

              {/* Fila 1: Fecha + Línea + Turno + N°Línea */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 56px", gap:6, marginBottom:6 }}>
                <div style={{ display:"flex", flexDirection:"column" }}>
                  <label style={S.label}>Fecha</label>
                  <input type="date" style={{ ...S.input, flex:1 }} value={a.fecha}
                    onChange={e => updateActividad(a.id,"fecha",e.target.value)} />
                </div>
                <div style={{ display:"flex", flexDirection:"column" }}>
                  <label style={S.label}>Línea</label>
                  <div style={{ display:"flex", gap:4, flex:1 }}>
                    {LINEAS.map(l => (
                      <button key={l} onClick={() => updateActividad(a.id,"linea",l)} style={{
                        flex:1, border:"1.5px solid", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer",
                        background: a.linea===l?(l==="Ensamble"?"#2F6E8F":"#A15A32"):"#F8FAFC",
                        color: a.linea===l?"#fff":"#64748B",
                        borderColor: a.linea===l?(l==="Ensamble"?"#2F6E8F":"#A15A32"):"#E2E8F0",
                      }}>{l==="Ensamble"?"Ens.":"Des."}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column" }}>
                  <label style={S.label}>Turno</label>
                  <div style={{ display:"flex", gap:4, flex:1 }}>
                    {TURNOS.map(t => (
                      <button key={t} onClick={() => updateActividad(a.id,"turno",t)} style={{
                        flex:1, border:"1.5px solid", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer",
                        background: a.turno===t?"#141A21":"#F8FAFC",
                        color: a.turno===t?"#fff":"#64748B",
                        borderColor: a.turno===t?"#141A21":"#E2E8F0",
                      }}>T{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column" }}>
                  <label style={S.label}>N°</label>
                  <input type="number" style={{ ...S.input, flex:1 }} placeholder="3"
                    value={a.nroLinea} onChange={e => updateActividad(a.id,"nroLinea",e.target.value)} />
                </div>
              </div>

              {/* Fila 2: RAN + Unidad + Cliente */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:6 }}>
                <div>
                  <label style={S.label}>RAN</label>
                  <input style={S.input} placeholder="N° orden" value={a.ran}
                    onChange={e => updateActividad(a.id,"ran",e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Unidad / Equipo</label>
                  <input style={S.input} placeholder="Reductor #4" value={a.unidad}
                    onChange={e => updateActividad(a.id,"unidad",e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Cliente</label>
                  <select style={S.select} value={a.cliente}
                    onChange={e => updateActividad(a.id,"cliente",e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__manual__">Otro</option>
                  </select>
                </div>
              </div>
              {a.cliente === "__manual__" && (
                <input style={{ ...S.input, marginBottom:6 }} placeholder="Nombre del cliente"
                  value={a.clienteManual} onChange={e => updateActividad(a.id,"clienteManual",e.target.value)} />
              )}

              {/* Fila 3: Técnicos + Supervisor + Planificación */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:6 }}>
                <div>
                  <label style={S.label}>Técnicos</label>
                  <input style={S.input} placeholder="José, Pedro..." value={a.tecnicos}
                    onChange={e => updateActividad(a.id,"tecnicos",e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Supervisor</label>
                  <select style={S.select} value={a.supervisor}
                    onChange={e => updateActividad(a.id,"supervisor",e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {SUPERVISORES.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="__manual__">Otro</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Planificación</label>
                  <select style={S.select} value={a.planificacion}
                    onChange={e => updateActividad(a.id,"planificacion",e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    <option value="Luis Cortés">Luis Cortés</option>
                    <option value="__manual__">Otro</option>
                  </select>
                </div>
              </div>
              {a.supervisor === "__manual__" && (
                <input style={{ ...S.input, marginBottom:6 }} placeholder="Nombre supervisor"
                  value={a.supervisorManual} onChange={e => updateActividad(a.id,"supervisorManual",e.target.value)} />
              )}
              {a.planificacion === "__manual__" && (
                <input style={{ ...S.input, marginBottom:6 }} placeholder="Nombre planificación"
                  value={a.planificacionManual} onChange={e => updateActividad(a.id,"planificacionManual",e.target.value)} />
              )}

              <div style={S.divider} />

              {/* ── AVANCE ── */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ ...S.sectionLabel, marginBottom:0 }}>AVANCE DEL EQUIPO</div>
                <div style={{ fontSize:16, fontWeight:800, color:avanceColor }}>{avance}%</div>
              </div>
              <input type="range" min="0" max="100" step="5" value={avance}
                onChange={e => updateActividad(a.id,"avance",clamp(e.target.value))}
                style={{ width:"100%", accentColor:avanceColor, marginBottom:6 }} />
              <div style={{ display:"flex", gap:4, marginBottom:14 }}>
                {[0,25,50,75,100].map(v => (
                  <button key={v} onClick={()=>updateActividad(a.id,"avance",v)} style={{
                    flex:1, padding:"5px 0", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                    border:"1.5px solid", background: avance===v?"#141A21":"#F8FAFC",
                    color: avance===v?"#fff":"#64748B", borderColor: avance===v?"#141A21":"#E2E8F0",
                  }}>{v}%</button>
                ))}
              </div>

              {/* ── TRABAJO REALIZADO ── */}
              <div style={S.fieldGroup}>
                <label style={{ ...S.label, color:"#1B7A4B", fontWeight:700 }}>✅ Trabajo realizado en el turno</label>
                <textarea
                  style={S.textareaRealizado}
                  placeholder={"Describe lo ejecutado en el turno. Ejemplo:\n• Retiro de tapa de housing\n• Desmontaje de trenes de engranaje\n• Lavado de ejes y piñones"}
                  value={a.realizado}
                  onChange={e => updateActividad(a.id,"realizado",e.target.value)} />
              </div>

              {/* ── PENDIENTE ── */}
              <div style={S.fieldGroup}>
                <label style={{ ...S.label, color:"#8A5A1E", fontWeight:700 }}>⏳ Pendiente para el próximo turno</label>
                <textarea
                  style={S.textareaPendiente}
                  placeholder={"Qué quedó sin terminar y por qué. Ejemplo:\n• Falta montaje de rodamientos — a la espera de repuesto\n• Pruebas dinámicas — banco ocupado"}
                  value={a.pendiente}
                  onChange={e => updateActividad(a.id,"pendiente",e.target.value)} />
              </div>

              <div style={S.divider} />

              <div style={S.fieldGroup}>
                <label style={S.label}>Observaciones</label>
                <textarea style={S.textarea} placeholder="Notas adicionales, alertas..."
                  value={a.observaciones}
                  onChange={e => updateActividad(a.id, "observaciones", e.target.value)} />
              </div>

              <div style={S.fieldGroup}>
                <label style={S.label}>📷 Fotos evidencia</label>
                <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }}
                  ref={el => cameraRefs.current[a.id] = el}
                  onChange={e => { handleFotos(a.id, e.target.files); e.target.value = ""; }} />
                <input type="file" accept="image/*" multiple style={{ display: "none" }}
                  ref={el => galleryRefs.current[a.id] = el}
                  onChange={e => { handleFotos(a.id, e.target.files); e.target.value = ""; }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.fotoBtn, flex: 1 }} onClick={() => cameraRefs.current[a.id]?.click()}>📷 Tomar foto</button>
                  <button style={{ ...S.fotoBtn, flex: 1 }} onClick={() => galleryRefs.current[a.id]?.click()}>🖼️ Galería</button>
                </div>
                {a.fotos?.length > 0 && (
                  <div style={S.fotoGrid}>
                    {a.fotos.map((f, fi) => (
                      <div key={fi} style={S.fotoThumbWrap}>
                        <img src={f.dataUrl} alt={f.name} style={S.fotoThumb} />
                        <button style={S.fotoRemove} onClick={() => removeFoto(a.id, fi)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {actividades.length > 1 && (
                  <button style={{ width:"100%", marginTop:6, padding:"8px", background:"none", border:"1px solid #FCA5A5", color:"#B3261E", fontSize:12, fontWeight:600, cursor:"pointer", borderRadius:6 }}
                    onClick={()=>removeActividad(a.id)}>✕ Eliminar esta actividad</button>
                )}
              </div>
              </div>)}
            </div>
          );
        })}

        <button style={S.addBtn} onClick={addActividad}>+ Agregar actividad</button>
        <button style={S.btnPrimary} onClick={() => setStep("entrega")}>
          Entregar turno →
        </button>
      </div>
    </div>
  );
}

const S = {
  thEntrega: { fontSize: 10, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", padding: "6px 8px", borderBottom: "1.5px solid #CBD5E1", textTransform: "uppercase" },
  tdEntrega: { fontSize: 12, color: "#141A21", padding: "7px 8px", borderBottom: "1px solid #F1F5F9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  root: { minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Segoe UI', system-ui, sans-serif", paddingBottom: 40 },
  container: { maxWidth: 680, margin: "0 auto", padding: "0 16px" },
  topBar: { background: "#141A21", margin: "0 -16px 24px", padding: "18px 20px" },
  topBarTitle: { color: "#F1F5F9", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" },
  topBarSub: { color: "#94A3B8", fontSize: 13, marginTop: 1 },
  clearBtn: { background: "none", border: "1px solid #475569", color: "#94A3B8", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" },
  section: { background: "#fff", borderRadius: 12, padding: "20px 18px", marginBottom: 16, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#64748B", marginBottom: 12 },
  divider: { height: 1, background: "#E2E8F0", margin: "16px 0 18px" },
  fieldGroup: { flex: 1, marginBottom: 14 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 },
  input: { width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 14, color: "#141A21", background: "#F8FAFC", boxSizing: "border-box", outline: "none" },
  textarea: { width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 14, color: "#141A21", background: "#F8FAFC", boxSizing: "border-box", minHeight: 72, resize: "vertical", outline: "none", fontFamily: "inherit" },
  textareaRealizado: { width: "100%", padding: "10px 12px", border: "1.5px solid #1B7A4B", borderRadius: 8, fontSize: 14, color: "#141A21", background: "#F4FBF7", boxSizing: "border-box", minHeight: 130, resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5 },
  textareaPendiente: { width: "100%", padding: "10px 12px", border: "1.5px solid #E0A245", borderRadius: 8, fontSize: 14, color: "#141A21", background: "#FFF8ED", boxSizing: "border-box", minHeight: 110, resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5 },
  select: { width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 14, color: "#141A21", background: "#F8FAFC", boxSizing: "border-box" },
  addBtn: { width: "100%", padding: "13px", border: "2px dashed #CBD5E1", borderRadius: 10, background: "none", color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12 },
  btnPrimary: { width: "100%", padding: "14px", background: "#141A21", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.2px" },
  shareBar: { display: "flex", gap: 8, margin: "16px 0 20px" },
  shareBtn: { flex: 1, padding: "11px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#141A21", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  previewCard: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, marginBottom: 20, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  previewCardTopBar: { background: "#141A21", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 },
  previewCardBarTitle: { color: "#F1F5F9", fontWeight: 700, fontSize: 15 },
  previewCardBarSub: { color: "#94A3B8", fontSize: 12, marginTop: 2, textTransform: "capitalize" },
  previewCardMeta: { display: "flex", flexWrap: "wrap", gap: 6, padding: "12px 16px", borderBottom: "1px solid #F1F5F9", background: "#FAFAFA" },
  previewCardBody: { padding: "14px 16px" },
  metaChip: { borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 },
  previewLabel: { fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6, letterSpacing: "0.04em" },
  avancePct: { fontSize: 13, fontWeight: 700, color: "#141A21", minWidth: 38, textAlign: "right" },
  cajaRealizadoPreview: { background: "#F4FBF7", border: "1px solid #1B7A4B", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#141A21", whiteSpace: "pre-wrap", lineHeight: 1.5 },
  cajaPendientePreview: { background: "#FFF8ED", border: "1px solid #E0A245", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#141A21", whiteSpace: "pre-wrap", lineHeight: 1.5 },
  cajaSinPendiente: { background: "#DCF2E5", border: "1px solid #1B7A4B", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1B7A4B", fontWeight: 600 },
  obsBox: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#475569", whiteSpace: "pre-wrap" },
  fotoPreviewGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 },
  fotoPreviewWrap: { width: 90, height: 90 },
  fotoPreviewImg: { width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #E2E8F0" },
  fotoBtn: { padding: "9px 12px", border: "1.5px dashed #94A3B8", borderRadius: 8, background: "#F8FAFC", color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  fotoGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 },
  fotoThumbWrap: { position: "relative", width: 80, height: 80 },
  fotoThumb: { width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1.5px solid #E2E8F0" },
  fotoRemove: { position: "absolute", top: -6, right: -6, background: "#B3261E", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
};
