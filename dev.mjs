// Levanta todos los microservicios y el front-end en una sola terminal.
// Funciona en Windows y Linux. Antes de arrancar:
//   1. Revisa que estén Node, pnpm, Python y uv (si falta uv lo instala; lo demás explica cómo instalarlo).
//   2. Instala con pnpm / uv las dependencias que falten o que cambiaron (p. ej. después de un pull).
// Uso (desde la raíz del proyecto):   node dev.mjs     (o ./dev.sh en Linux, dev.cmd en Windows)
// Con --host el sitio también se abre para otros dispositivos de la red (celular, otra PC):
//   ./dev.sh --host                 usa la IP local que detecte
//   ./dev.sh --host 192.168.1.50    usa esa IP
// Ctrl+C detiene todo.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { homedir, networkInterfaces } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(fileURLToPath(import.meta.url));
const esWindows = process.platform === "win32";
const dirFront = join(raiz, "front-end");
const dirBack = join(raiz, "back-end");

const servicios = [
  { nombre: "auth", puerto: 8001 },
  { nombre: "catalogo", puerto: 8002 },
  { nombre: "citas", puerto: 8003 },
  { nombre: "negocio", puerto: 8004 },
  { nombre: "actividad", puerto: 8005 },
  { nombre: "gateway", puerto: 8000 },
].map((s) => ({ ...s, carpeta: join(dirBack, `servicio-${s.nombre}`) }));

// --host [ip] / --host=ip: expone el front-end y el gateway en la red local
const args = process.argv.slice(2);
const iHost = args.findIndex((a) => a === "--host" || a.startsWith("--host="));
const ipRed =
  iHost === -1
    ? null
    : args[iHost].split("=")[1] ||
      (args[iHost + 1] && !args[iHost + 1].startsWith("--") ? args[iHost + 1] : null) ||
      Object.values(networkInterfaces())
        .flat()
        .find((i) => i.family === "IPv4" && !i.internal)?.address;
if (iHost !== -1 && !ipRed) {
  console.error("No se encontró una IP de red local. Indícala a mano: ./dev.sh --host 192.168.1.50");
  process.exit(1);
}
const puertoFront = 5173;

const color = (n, t) => `\x1b[${n}m${t}\x1b[0m`;
const ok = (t) => console.log(color(32, "✔ ") + t);
const aviso = (t) => console.log(color(33, "! ") + t);
const titulo = (t) => console.log("\n" + color(1, t));

// Ejecuta un comando y devuelve { codigo, salida } sin mostrar nada
function correr(comando, cwd = raiz) {
  const r = spawnSync(comando, { cwd, shell: true, encoding: "utf8" });
  return { codigo: r.status ?? 1, salida: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

// Ejecuta un comando mostrando su salida; devuelve true si terminó bien
function instalar(comando, cwd) {
  return spawnSync(comando, { cwd, shell: true, stdio: "inherit" }).status === 0;
}

const version = (texto) => (texto.match(/(\d+)\.(\d+)(?:\.(\d+))?/) ?? []).slice(1, 4).map((n) => Number(n ?? 0));
const menor = (a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] ?? 0) - (b[2] ?? 0);

/* ---------- 1. Herramientas ---------- */

titulo("Revisando herramientas…");
const faltantes = [];

// Node (si este script corre, Node existe; se revisa la versión que pide Vite)
const vNode = version(process.versions.node);
if (!((vNode[0] === 20 && vNode[1] >= 19) || menor(vNode, [22, 12, 0]) >= 0)) {
  faltantes.push({
    nombre: `Node ${process.versions.node} es muy viejo (se necesita 20.19+ o 22.12+)`,
    como: [
      "Descarga la versión LTS: https://nodejs.org/",
      esWindows ? "Windows: winget install OpenJS.NodeJS.LTS" : "Linux (con mise): mise use -g node@lts",
    ],
  });
} else ok(`Node ${process.versions.node}`);

const pnpm = correr("pnpm --version");
if (pnpm.codigo === 0) ok(`pnpm ${pnpm.salida}`);
else
  faltantes.push({
    nombre: "pnpm",
    como: ["Instálalo con: npm install -g pnpm", "Más opciones: https://pnpm.io/installation"],
  });

const pythonRequerido = version(
  readFileSync(join(servicios[0].carpeta, "pyproject.toml"), "utf8").match(/requires-python\s*=\s*"[^\d]*([\d.]+)/)?.[1] ?? "3",
);
const python = ["python3", "python", "py"].map((c) => correr(`${c} --version`)).find((r) => r.codigo === 0 && /Python \d/.test(r.salida));
if (!python)
  faltantes.push({
    nombre: `Python ${pythonRequerido.slice(0, 2).join(".")}+`,
    como: [
      "Descárgalo de: https://www.python.org/downloads/",
      esWindows
        ? `Windows: winget install Python.Python.${pythonRequerido[0]}.${pythonRequerido[1]}`
        : `Linux (con mise): mise use -g python@${pythonRequerido[0]}.${pythonRequerido[1]}`,
    ],
  });
else if (menor(version(python.salida), pythonRequerido) < 0)
  aviso(`${python.salida} es menor que la ${pythonRequerido.slice(0, 2).join(".")} que piden los servicios; uv descargará esa versión por su cuenta.`);
else ok(python.salida);

let uv = correr("uv --version");
if (uv.codigo !== 0) {
  aviso("uv no está instalado. Instalándolo con el instalador oficial (https://docs.astral.sh/uv/)…");
  instalar(
    esWindows
      ? 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"'
      : "curl -LsSf https://astral.sh/uv/install.sh | sh",
    raiz,
  );
  // El instalador deja uv en alguna de estas carpetas, que quizá aún no están en el PATH de esta terminal
  const { UV_INSTALL_DIR, XDG_BIN_HOME, XDG_DATA_HOME } = process.env;
  const carpetas = [UV_INSTALL_DIR, XDG_BIN_HOME, XDG_DATA_HOME && join(XDG_DATA_HOME, "..", "bin"), join(homedir(), ".local", "bin")];
  process.env.PATH = [...carpetas.filter(Boolean), process.env.PATH].join(delimiter);
  uv = correr("uv --version");
}
if (uv.codigo === 0) ok(uv.salida);
else
  faltantes.push({
    nombre: "uv (no se pudo instalar automáticamente)",
    como: [
      esWindows
        ? 'Windows: powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"'
        : "Linux: curl -LsSf https://astral.sh/uv/install.sh | sh",
      "Más opciones: https://docs.astral.sh/uv/getting-started/installation/",
    ],
  });

if (faltantes.length) {
  console.log("\n" + color(31, "Falta instalar:"));
  for (const f of faltantes) {
    console.log(color(31, `  ✘ ${f.nombre}`));
    for (const linea of f.como) console.log(`      ${linea}`);
  }
  console.log("\nInstala lo anterior, abre una terminal nueva y vuelve a ejecutar: node dev.mjs");
  process.exit(1);
}

if (!existsSync(join(dirBack, ".env"))) {
  console.error(color(31, "\nFalta el archivo back-end/.env (copia back-end/.env.example y llénalo)."));
  process.exit(1);
}

/* ---------- 2. Dependencias ---------- */

titulo("Revisando dependencias…");

// Front-end: después de instalar se guarda una huella de package.json + pnpm-lock.yaml en
// node_modules. Si la huella ya no coincide (alguien agregó o quitó paquetes), se reinstala.
const huellaFront = () =>
  createHash("sha1")
    .update(["package.json", "pnpm-lock.yaml"].map((f) => (existsSync(join(dirFront, f)) ? readFileSync(join(dirFront, f)) : "")).join("\0"))
    .digest("hex");
const archivoHuella = join(dirFront, "node_modules", ".huella-dev");

let motivo = null;
if (!existsSync(join(dirFront, "node_modules"))) motivo = "no están instaladas";
else if (!existsSync(archivoHuella) || readFileSync(archivoHuella, "utf8") !== huellaFront())
  motivo = "package.json o pnpm-lock.yaml cambiaron";

if (!motivo) ok("front-end: dependencias al día");
else {
  aviso(`front-end: hay que instalar dependencias (${motivo}). Ejecutando pnpm install…`);
  if (!instalar("pnpm install", dirFront)) {
    console.error(color(31, "No se pudieron instalar las dependencias del front-end."));
    process.exit(1);
  }
  writeFileSync(archivoHuella, huellaFront()); // pnpm install pudo actualizar el lockfile
  ok("front-end: dependencias instaladas");
}

// Back-end: "uv lock --check" falla si uv.lock ya no corresponde a pyproject.toml, y
// "uv sync --check" si al .venv le falta, le sobra o tiene distinta alguna dependencia.
// En cualquiera de los dos casos se sincroniza (uv sync también actualiza uv.lock).
for (const s of servicios) {
  const nombre = `servicio-${s.nombre}`;
  if (correr("uv lock --check", s.carpeta).codigo === 0 && correr("uv sync --check", s.carpeta).codigo === 0) {
    ok(`${nombre}: dependencias al día`);
    continue;
  }
  aviso(`${nombre}: hay dependencias nuevas, faltantes o que sobran. Ejecutando uv sync…`);
  if (!instalar("uv sync", s.carpeta)) {
    console.error(color(31, `No se pudieron instalar las dependencias de ${nombre}.`));
    process.exit(1);
  }
  ok(`${nombre}: dependencias instaladas`);
}

/* ---------- 3. Puertos ---------- */
// Si dev.mjs murió sin detener a sus hijos (terminal cerrada, kill -9…), los servicios viejos siguen
// ocupando los puertos y los nuevos fallan con "Address already in use". Aquí se detecta antes de arrancar.

titulo("Revisando puertos…");

const escucha = (host, puerto) =>
  new Promise((listo) => {
    const s = connect({ host, port: puerto });
    s.setTimeout(1000, () => { s.destroy(); listo(false); });
    s.once("connect", () => { s.destroy(); listo(true); });
    s.once("error", () => listo(false));
  });
// Vite escucha en [::1] (IPv6) y los servicios en 127.0.0.1: hay que probar las dos
const ocupado = async (puerto) => (await escucha("127.0.0.1", puerto)) || (await escucha("::1", puerto));

function pidsEnPuerto(puerto) {
  if (esWindows) {
    const filas = correr("netstat -ano -p tcp").salida.split(/\r?\n/);
    return [...new Set(filas.filter((l) => /LISTENING/.test(l) && l.includes(`:${puerto} `)).map((l) => Number(l.trim().split(/\s+/).pop())).filter(Boolean))];
  }
  const ss = correr(`ss -ltnpH "sport = :${puerto}"`).salida;
  return [...new Set([...ss.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1])))];
}

function comandoDe(pid) {
  if (esWindows) {
    return correr(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`).salida;
  }
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ").trim();
  } catch {
    return "";
  }
}

// ¿El proceso todavía pertenece a otro dev.mjs vivo? Entonces es una sesión abierta, no un huérfano.
function sesionActiva(pid) {
  for (let actual = pid, pasos = 0; actual > 1 && pasos < 40; pasos++) {
    if (actual !== process.pid && /\bdev\.mjs\b/.test(comandoDe(actual))) return actual;
    try {
      const stat = readFileSync(`/proc/${actual}/stat`, "utf8");
      actual = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]); // 4.º campo: el padre
    } catch {
      return null;
    }
  }
  return null;
}

const puertos = [...servicios.map((s) => ({ nombre: s.nombre, puerto: s.puerto })), { nombre: "front-end", puerto: puertoFront }];
const bloqueados = [];
for (const { nombre, puerto } of puertos) {
  if (!(await ocupado(puerto))) continue;
  const pids = pidsEnPuerto(puerto);
  const delProyecto = pids.length > 0 && pids.every((pid) => comandoDe(pid).includes(raiz));
  const activa = !esWindows && delProyecto ? pids.map(sesionActiva).find(Boolean) : null;
  if (activa) {
    bloqueados.push({ nombre, puerto, pids, activa });
  } else if (delProyecto && !esWindows) {
    // Servicio viejo de este mismo proyecto: se detiene su grupo de procesos completo (recargador incluido)
    for (const pid of pids) {
      const grupo = Number(correr(`ps -o pgid= -p ${pid}`).salida);
      try { process.kill(grupo > 1 ? -grupo : pid, "SIGTERM"); } catch {}
    }
    aviso(`${nombre}: el puerto ${puerto} lo tenía una ejecución anterior que quedó abierta; se detuvo`);
  } else {
    bloqueados.push({ nombre, puerto, pids, delProyecto });
  }
}
// Espera a que los puertos liberados queden libres de verdad
for (let i = 0; i < 20 && (await Promise.all(puertos.map((p) => ocupado(p.puerto)))).some((o, j) => o && !bloqueados.some((b) => b.puerto === puertos[j].puerto)); i++) {
  await new Promise((r) => setTimeout(r, 250));
}
const siguenOcupados = [];
for (const p of puertos) if (await ocupado(p.puerto)) siguenOcupados.push(bloqueados.find((b) => b.puerto === p.puerto) ?? { ...p, pids: pidsEnPuerto(p.puerto) });
if (siguenOcupados.length) {
  const sesion = siguenOcupados.find((b) => b.activa)?.activa;
  if (sesion) {
    console.log(color(31, `✘ Ya hay otro dev.sh corriendo (proceso ${sesion}): no se tocó nada.`));
    console.log(`    Ciérralo con Ctrl+C en su terminal (o: kill ${sesion}) y vuelve a ejecutar este.`);
    process.exit(1);
  }
  for (const b of siguenOcupados) {
    console.log(color(31, `✘ ${b.nombre}: el puerto ${b.puerto} está ocupado`) + (b.pids.length ? ` por el proceso ${b.pids.join(", ")}` : ""));
    for (const pid of b.pids) console.log(`    ${comandoDe(pid).slice(0, 160) || "(no se pudo leer el comando)"}`);
    if (b.pids.length) console.log(`    Ciérralo con: ${esWindows ? b.pids.map((pid) => `taskkill /PID ${pid} /T /F`).join(" & ") : `kill ${b.pids.join(" ")}`}`);
  }
  process.exit(1);
}
ok("Puertos libres");

/* ---------- 4. Arranque ---------- */

titulo("Iniciando servicios…\n");

// En modo red el front-end llama al gateway por la IP (localhost en el celular sería el propio celular),
// así que el gateway escucha en todas las interfaces y acepta ese origen en CORS.
const envRed = {};
if (ipRed) {
  const corsEnv = readFileSync(join(dirBack, ".env"), "utf8").match(/^CORS_ORIGINS=(.*)$/m)?.[1].trim();
  const cors = corsEnv || process.env.CORS_ORIGINS || `http://localhost:${puertoFront},http://127.0.0.1:${puertoFront}`;
  envRed.gateway = { CORS_ORIGINS: `${cors},http://${ipRed}:${puertoFront}` };
  envRed["front-end"] = { VITE_API_URL: `http://${ipRed}:8000/api` };
}

const procesos = [
  ...servicios.map((s) => ({
    ...s,
    // "python -m fastapi" en lugar del ejecutable fastapi.exe: Smart App Control de Windows
    // bloquea los .exe que uv genera en .venv\Scripts (no están firmados), pero no python.exe.
    comando: `uv run python -m fastapi dev app/main.py --port ${s.puerto}${ipRed && s.nombre === "gateway" ? " --host 0.0.0.0" : ""}`,
    url: `http://127.0.0.1:${s.puerto}/health`,
  })),
  {
    nombre: "front-end",
    carpeta: dirFront,
    // En modo red el puerto es fijo para que coincida con el origen permitido en CORS
    comando: ipRed ? `pnpm dev --host 0.0.0.0 --port ${puertoFront} --strictPort` : "pnpm dev",
    url: null,
  },
];

const colores = [36, 33, 35, 32, 34, 91, 96];
const ancho = Math.max(...procesos.map((p) => p.nombre.length));
const sinColor = (t) => t.replace(/\x1b\[[0-9;]*m/g, "");

function iniciarProceso(p, i) {
  const prefijo = color(colores[i % colores.length], `${p.nombre.padEnd(ancho)} |`) + " ";
  p.hijo = spawn(p.comando, {
    cwd: p.carpeta,
    shell: true,
    detached: !esWindows, // grupo de procesos propio para poder matarlo completo en Linux
    env: { ...process.env, FORCE_COLOR: "1", ...envRed[p.nombre] },
  });

  const imprimir = (datos) => {
    for (const linea of datos.toString().split(/\r?\n/)) {
      if (!linea.trim()) continue;
      process.stdout.write(prefijo + linea + "\n");
      // Vite avisa en qué URL quedó (puede no ser 5173 si ese puerto está ocupado)
      const local = !p.url && sinColor(linea).match(/Local:\s+(http\S+)/);
      if (local) p.url = local[1];
    }
  };
  p.hijo.stdout.on("data", imprimir);
  p.hijo.stderr.on("data", imprimir);
  p.hijo.on("exit", (codigo) => {
    p.terminado = true;
    if (!cerrando) imprimir(`terminó (código ${codigo})`);
  });
}

/* ---------- 5. Aviso de "todo listo" ---------- */

const responde = async (url, exigirTodo = false) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    if (!exigirTodo) return true;
    const estado = await r.json();
    return estado.todo_ok === true;
  } catch {
    return false;
  }
};

async function esperarGrupo(grupo, etiqueta, limiteMs = 180_000, exigirTodo = false) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs && !cerrando) {
    await Promise.all(grupo.map(async (p) => {
      if (!p.listo && !p.terminado && p.url) p.listo = await responde(p.url, exigirTodo);
    }));
    if (grupo.every((p) => p.listo)) return true;
    const caidos = grupo.filter((p) => p.terminado && !p.listo);
    if (caidos.length) {
      console.error(color(31, `\nNo se pudo iniciar ${etiqueta}: ${caidos.map((p) => p.nombre).join(", ")} se detuvo. Revisa el error anterior de ese servicio.`));
      return false;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!cerrando) {
    const pendientes = grupo.filter((p) => !p.listo).map((p) => p.nombre);
    console.error(color(31, `\nTiempo agotado esperando ${etiqueta}: ${pendientes.join(", ")}. Revisa conexión a PostgreSQL/Neon y los errores de arranque.`));
  }
  return false;
}

async function esperarListos(limiteMs = 180_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs && !cerrando) {
    for (const p of procesos) if (!p.listo && !p.terminado && p.url) p.listo = await responde(p.url);
    if (procesos.every((p) => p.listo || p.terminado)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (cerrando) return;

  const fallidos = procesos.filter((p) => !p.listo);
  const front = procesos.at(-1);
  const linea = "═".repeat(60);
  if (!fallidos.length) {
    console.log("\n" + color(32, linea));
    console.log(color(32, "  ✔ Proyecto listo: el front-end y todos los servicios están corriendo"));
    console.log(`    Sitio:    ${front.url}`);
    console.log(`    Panel:    ${new URL("/admin", front.url)}`);
    console.log("    Gateway:  http://localhost:8000/health");
    if (ipRed) console.log(`    En la red: http://${ipRed}:${puertoFront}  (desde otros dispositivos)`);
    console.log("    Ctrl+C para detener todo");
    console.log(color(32, linea) + "\n");
  } else {
    console.log("\n" + color(31, linea));
    console.log(color(31, "  ✘ No todo arrancó. Revisa los mensajes de:"));
    for (const p of fallidos) console.log(`    - ${p.nombre} (${p.terminado ? "se detuvo" : "no responde"})`);
    console.log(color(31, linea) + "\n");
  }
}

let cerrando = false;
function detener() {
  if (cerrando) return;
  cerrando = true;
  console.log("\nDeteniendo servicios...");
  for (const { hijo } of procesos) {
    if (!hijo || hijo.exitCode !== null) continue;
    try {
      if (esWindows) spawnSync("taskkill", ["/pid", String(hijo.pid), "/T", "/F"]);
      else process.kill(-hijo.pid, "SIGTERM");
    } catch {}
  }
  setTimeout(() => process.exit(0), 500);
}

async function arrancarPorEtapas() {
  const backends = procesos.filter((p) => !["gateway", "front-end"].includes(p.nombre));
  const gateway = procesos.find((p) => p.nombre === "gateway");
  const front = procesos.find((p) => p.nombre === "front-end");

  // Cada servicio termina de conectar/migrar antes de aceptar peticiones del navegador.
  backends.forEach((p) => iniciarProceso(p, procesos.indexOf(p)));
  if (!(await esperarGrupo(backends, "los servicios backend"))) {
    detener();
    return;
  }

  iniciarProceso(gateway, procesos.indexOf(gateway));
  if (!(await esperarGrupo([gateway], "el gateway y sus dependencias", 60_000, true))) {
    detener();
    return;
  }

  iniciarProceso(front, procesos.indexOf(front));
  await esperarListos();
}

process.on("SIGINT", detener);
process.on("SIGTERM", detener);
// Al cerrar la terminal llega SIGHUP: sin esto los servicios (que van en su propio grupo de procesos)
// quedaban vivos y ocupando los puertos para la siguiente vez
process.on("SIGHUP", detener);
arrancarPorEtapas();
