#!/usr/bin/env node
// conductor. — relais de la télécommande (téléphone ⇄ PC)
//
//   téléphone (navigateur)  ⇄  ce relais (Node, sur le PC)  ⇄  conductor. (onglet du PC)
//
// - Sert la page de la télécommande (public/index.html) au téléphone.
// - WebSocket /ws : conductor. s'y connecte en « hôte » (depuis le PC seulement) et envoie
//   l'état du lecteur ; les téléphones appairés reçoivent cet état et envoient des commandes.
// - Appairage : code à 4 chiffres, ou clé du QR code (affichés dans conductor.), puis jeton
//   gardé par le téléphone (plus de code ensuite). Code et clé restent les mêmes d'un
//   lancement à l'autre (.remote-key.json) ; « nouveau code » dans conductor. les change et
//   oublie les téléphones. Jetons : .remote-tokens.json
// - Options : --log (journal dans relay.log, pour un lancement sans fenêtre)
// - Volume du PC : Windows (Core Audio, via PowerShell), Linux (pactl / amixer), macOS (osascript).
// - Aucune dépendance : node relay.js   (Node 18 ou plus récent)
//
// Accès : même réseau (wifi, point d'accès, partage de connexion) ou Tailscale (4G, autre wifi).

"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFile } = require("child_process");

const PORT = Number(process.env.CONDUCTOR_REMOTE_PORT) || 8765;
const HERE = __dirname;
const APP = path.resolve(HERE, "..", "..");            // conductor/app
const ROOT = path.resolve(APP, "..");                    // conductor
const COVERS = path.join(ROOT, "datastorage", "covers");
const TOKENS_FILE = path.join(HERE, ".remote-tokens.json");
const KEY_FILE = path.join(HERE, ".remote-key.json");
const LOG_FILE = process.argv.includes("--log") ? path.join(HERE, "relay.log") : "";

// Code (4 chiffres) et clé du QR code : gardés d'un lancement à l'autre
let PIN = "", KEY = "";
function newPairing() {
  PIN = String(crypto.randomInt(0, 10000)).padStart(4, "0");
  KEY = crypto.randomBytes(12).toString("hex");
  try { fs.writeFileSync(KEY_FILE, JSON.stringify({ pin: PIN, key: KEY })); } catch (e) {}
}
try {
  const k = JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
  if (/^\d{4}$/.test(k.pin) && /^[0-9a-f]{24}$/.test(k.key)) { PIN = k.pin; KEY = k.key; }
} catch (e) {}
if (!PIN) newPairing();

// ---------- Jetons des téléphones appairés ----------

let tokens = {};
try { tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8")) || {}; } catch (e) { tokens = {}; }
function saveTokens() {
  try { fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 1)); } catch (e) { log("jetons non enregistrés : " + e.message); }
}

// ---------- Journal ----------

const pad = n => String(n).padStart(2, "0");
if (LOG_FILE) { try { fs.writeFileSync(LOG_FILE, ""); } catch (e) {} }
function out(line) {
  console.log(line);
  if (LOG_FILE) { try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch (e) {} }
}
function log(msg) {
  const d = new Date();
  out("  " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + "  " + msg);
}

// ---------- Adresses du PC ----------

// Classées : wifi d'abord, puis Tailscale, puis le reste. Ignorées : adresses 169.254.x
// (réseau non configuré) et la carte VirtualBox (192.168.56.x).
function addresses() {
  const list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" && a.family !== 4) continue;
      if (a.internal) continue;
      const [x, y, z] = a.address.split(".").map(Number);
      if (x === 169 && y === 254) continue;
      if (x === 192 && y === 168 && z === 56) continue;
      const tailscale = x === 100 && y >= 64 && y <= 127;
      const wifi = /wi-?fi|wlan|wireless|wlp|wlo/i.test(name);
      const kind = tailscale ? "tailscale" : wifi ? "wifi" : "autre";
      const label = tailscale ? "Tailscale (4G, autre wifi)" : wifi ? "Wifi" : name;
      list.push({ name, ip: a.address, tailscale, kind, label, url: "http://" + a.address + ":" + PORT });
    }
  }
  const rank = { wifi: 0, tailscale: 1, autre: 2 };
  return list.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

// ---------- WebSocket minimal (RFC 6455, messages texte) ----------

function wsAccept(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return false; }
  const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
  return true;
}

function wsFrame(op, payload) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}

class Peer {
  constructor(socket, role, info) {
    this.socket = socket;
    this.role = role;          // "host" | "remote"
    this.info = info || {};
    this.authed = role === "host";
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.alive = true;
    socket.setNoDelay(true);
    socket.on("data", d => this.onData(d));
    socket.on("close", () => this.onClose());
    socket.on("error", () => {});
  }
  send(obj) {
    if (this.socket.destroyed) return;
    try { this.socket.write(wsFrame(1, Buffer.from(JSON.stringify(obj)))); } catch (e) {}
  }
  ping() { if (!this.socket.destroyed) try { this.socket.write(wsFrame(9, Buffer.alloc(0))); } catch (e) {} }
  close() { try { this.socket.write(wsFrame(8, Buffer.alloc(0))); } catch (e) {} this.socket.destroy(); }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { this.close(); return; }          // 1 Mo max
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const mask = this.buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = this.buf.subarray(need);
      if (op === 8) { this.close(); return; }
      if (op === 9) { try { this.socket.write(wsFrame(10, payload)); } catch (e) {} continue; }
      if (op === 10) { this.alive = true; continue; }
      if (op === 1 || op === 0) {
        this.frags.push(payload);
        if (!fin) continue;
        const text = Buffer.concat(this.frags).toString("utf8");
        this.frags = [];
        let msg = null;
        try { msg = JSON.parse(text); } catch (e) {}
        if (msg && typeof msg === "object") onMessage(this, msg);
      }
    }
  }
  onClose() { onClose(this); }
}

// ---------- État ----------

let host = null;                 // conductor. (un seul onglet à la fois)
const remotes = new Set();
let state = null;                // dernier état du lecteur envoyé par conductor.
let coverSrc = "";               // pochette en cours (chemin local ou adresse http)
let coverVer = "";
let lyrics = null;               // paroles du morceau en cours (envoyées par conductor.)
let queue = [];                  // file d'attente (albums à suivre), pochettes à part
let thoughts = null;             // thoughts de l'album en cours
const searchCovers = new Map();  // albumId → pochette, pour les résultats du catalogue
const queueCovers = new Map();   // albumId → pochette (chemin local ou adresse http)
let sysVol = null;               // volume du PC, 0..100 (null : indisponible)
let sysMuted = false;
const fails = new Map();         // ip → { n, until } (codes faux)

function relayInfo() {
  return { type: "relay", pin: PIN, key: KEY, port: PORT, hostname: os.hostname(), addresses: addresses(),
    remotes: [...remotes].filter(r => r.authed).map(r => r.info.device || "téléphone") };
}

function remoteState() {
  return { type: "state", host: !!host, hostname: os.hostname(), state, cover: coverVer ? "/cover?v=" + coverVer : "",
    sysVolume: sysVol, sysMuted };
}

function broadcast() {
  const msg = remoteState();
  remotes.forEach(r => { if (r.authed) r.send(msg); });
}

function onMessage(peer, msg) {
  if (peer.role === "host") {
    if (msg.type === "state") {
      state = msg.state || null;
      const src = state && state.coverSrc || "";
      if (src !== coverSrc) {
        coverSrc = src;
        coverVer = src ? crypto.createHash("md5").update(src).digest("hex").slice(0, 10) : "";
      }
      if (state) delete state.coverSrc;
      broadcast();
    } else if (msg.type === "time") {
      if (state && Number.isFinite(msg.time)) { state.time = msg.time; state.playing = true; }
      remotes.forEach(r => { if (r.authed) r.send({ type: "time", time: msg.time }); });
    } else if (msg.type === "queue") {
      queueCovers.clear();
      queue = (Array.isArray(msg.queue) ? msg.queue : []).map(q => {
        if (q.coverSrc) queueCovers.set(q.id, q.coverSrc);
        return { id: q.id, title: q.title, artist: q.artist, year: q.year, duration: q.duration,
          cover: q.coverSrc ? "/cover?a=" + encodeURIComponent(q.id) + "&v=" + crypto.createHash("md5").update(q.coverSrc).digest("hex").slice(0, 8) : "" };
      });
      remotes.forEach(r => { if (r.authed) r.send({ type: "queue", queue }); });
    } else if (msg.type === "results") {
      // Résultats de recherche : pochettes servies par /cover?a=…
      const items = (Array.isArray(msg.items) ? msg.items : []).map(it => {
        if (it.coverSrc) searchCovers.set(it.id, it.coverSrc);
        return { id: it.id, title: it.title, artist: it.artist, year: it.year, genre: it.genre,
          cover: it.coverSrc ? "/cover?a=" + encodeURIComponent(it.id) + "&v=" + crypto.createHash("md5").update(it.coverSrc).digest("hex").slice(0, 8) : "" };
      });
      if (searchCovers.size > 2000) searchCovers.clear();
      remotes.forEach(r => { if (r.authed) r.send({ type: "results", id: msg.id, q: msg.q, items }); });
    } else if (msg.type === "thoughts") {
      thoughts = msg.thoughts || null;
      remotes.forEach(r => { if (r.authed) r.send({ type: "thoughts", thoughts }); });
    } else if (msg.type === "lyrics") {
      lyrics = msg.lyrics || null;
      remotes.forEach(r => { if (r.authed) r.send({ type: "lyrics", lyrics }); });
    } else if (msg.type === "info") {
      peer.send(relayInfo());
    } else if (msg.type === "new-pairing") {
      // Nouveau code et nouvelle clé : les téléphones appairés sont oubliés
      newPairing();
      tokens = {};
      saveTokens();
      remotes.forEach(r => { if (r.authed) { r.send({ type: "need-pin" }); r.authed = false; } });
      log("nouveau code : " + PIN + " (téléphones oubliés)");
      peer.send(relayInfo());
    } else if (msg.type === "quit") {
      log("arrêt demandé par conductor.");
      remotes.forEach(r => r.close());
      setTimeout(() => process.exit(0), 200);
    }
    return;
  }

  // Téléphone : mesure du délai réseau (aller-retour)
  if (msg.type === "ping") { peer.send({ type: "pong", c: msg.c }); return; }

  // Téléphone : appairage
  if (!peer.authed) {
    const ip = peer.info.ip;
    if (msg.type === "hello" && msg.token && tokens[msg.token]) {
      peer.authed = true;
      peer.info.device = tokens[msg.token].device;
      tokens[msg.token].lastSeen = new Date().toISOString();
      saveTokens();
      peer.send({ type: "welcome" });
      peer.send(remoteState());
      if (lyrics) peer.send({ type: "lyrics", lyrics });
      peer.send({ type: "queue", queue });
      if (thoughts) peer.send({ type: "thoughts", thoughts });
      log("téléphone connecté : " + peer.info.device + " (" + ip + ")");
      if (host) host.send(relayInfo());
      refreshSysVolume();
      return;
    }
    if (msg.type === "pair") {
      const f = fails.get(ip) || { n: 0, until: 0 };
      if (Date.now() < f.until) { peer.send({ type: "pair-error", reason: "Trop d'essais : attendez 30 secondes." }); return; }
      const ok = msg.key ? String(msg.key) === KEY : String(msg.pin || "") === PIN;
      if (!ok) {
        f.n += 1;
        if (f.n >= 5) { f.n = 0; f.until = Date.now() + 30000; }
        fails.set(ip, f);
        peer.send({ type: "pair-error", reason: msg.key ? "QR code périmé : scannez celui affiché dans conductor." : "Code incorrect." });
        log("code faux depuis " + ip);
        return;
      }
      fails.delete(ip);
      const token = crypto.randomBytes(24).toString("hex");
      const device = String(msg.device || "téléphone").slice(0, 60);
      tokens[token] = { device, pairedAt: new Date().toISOString(), lastSeen: new Date().toISOString() };
      saveTokens();
      peer.authed = true;
      peer.info.device = device;
      peer.send({ type: "paired", token });
      peer.send(remoteState());
      if (lyrics) peer.send({ type: "lyrics", lyrics });
      peer.send({ type: "queue", queue });
      if (thoughts) peer.send({ type: "thoughts", thoughts });
      log("téléphone appairé : " + device + " (" + ip + ")");
      if (host) host.send(relayInfo());
      refreshSysVolume();
      return;
    }
    if (msg.type === "hello") peer.send({ type: "need-pin" });
    return;
  }

  // Téléphone appairé : commandes
  if (msg.type !== "cmd") return;
  const name = String(msg.name || "");
  if (name === "sysVolume") { setSysVolume(Number(msg.value)); return; }
  if (name === "sysVolumeStep") { if (sysVol != null) setSysVolume(sysVol + Number(msg.value || 0)); return; }
  if (name === "sysMute") { setSysMute(!sysMuted); return; }
  const allowed = ["toggle", "next", "prev", "star", "volume", "volumeStep", "mute", "seek",
    "queuePlay", "queueRemove", "queueMove", "queueClear", "thoughtAdd", "thoughtDelete", "thoughtEdit",
    "search", "playAlbum", "queueAlbum"];
  if (!allowed.includes(name)) return;
  if (host) host.send({ type: "cmd", name, value: msg.value });
}

function onClose(peer) {
  if (peer === host) {
    host = null;
    lyrics = null;
    queue = [];
    queueCovers.clear();
    thoughts = null;
    log("conductor. déconnecté");
    broadcast();
  }
  if (remotes.delete(peer) && peer.authed) {
    log("téléphone déconnecté : " + (peer.info.device || "téléphone"));
    if (host) host.send(relayInfo());
  }
}

// ---------- Volume du PC ----------

let ps = null, psQueue = [], psBuf = "";
const PS_SCRIPT = String.raw`
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class ConductorAudio {
  static IAudioEndpointVolume Vol() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static int Get() { float v = 0; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return (int)Math.Round(v * 100); }
  public static void Set(int p) { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, p)) / 100f, Guid.Empty)); }
  public static bool Muted() { bool m = false; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
  public static void Mute(bool m) { Marshal.ThrowExceptionForHR(Vol().SetMute(m, Guid.Empty)); }
}
"@
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  try {
    if ($line.StartsWith("set ")) { [ConductorAudio]::Set([int]$line.Substring(4)) }
    elseif ($line -eq "mute") { [ConductorAudio]::Mute($true) }
    elseif ($line -eq "unmute") { [ConductorAudio]::Mute($false) }
    [Console]::Out.WriteLine("" + [ConductorAudio]::Get() + " " + [int][ConductorAudio]::Muted())
  } catch { [Console]::Out.WriteLine("err") }
  [Console]::Out.Flush()
}
`;

function winVolume(cmd) {
  return new Promise(resolve => {
    if (!ps) {
      const file = path.join(os.tmpdir(), "conductor-volume.ps1");
      try { fs.writeFileSync(file, "﻿" + PS_SCRIPT); } catch (e) { resolve(null); return; }
      ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file], { windowsHide: true });
      ps.stdout.setEncoding("utf8");
      ps.stdout.on("data", d => {
        psBuf += d;
        let i;
        while ((i = psBuf.indexOf("\n")) >= 0) {
          const line = psBuf.slice(0, i).trim();
          psBuf = psBuf.slice(i + 1);
          const cb = psQueue.shift();
          if (cb) cb(line);
        }
      });
      ps.on("exit", () => { ps = null; psQueue.splice(0).forEach(cb => cb("err")); });
      ps.on("error", () => { ps = null; psQueue.splice(0).forEach(cb => cb("err")); });
    }
    const timer = setTimeout(() => resolve(null), 8000);
    psQueue.push(line => {
      clearTimeout(timer);
      const m = /^(\d+) ([01])$/.exec(line);
      resolve(m ? { volume: Number(m[1]), muted: m[2] === "1" } : null);
    });
    try { ps.stdin.write(cmd + "\n"); } catch (e) { clearTimeout(timer); resolve(null); }
  });
}

function run(cmd, args) {
  return new Promise(resolve => execFile(cmd, args, { timeout: 4000 }, (err, out) => resolve(err ? null : String(out))));
}

async function unixVolume(cmd) {
  if (process.platform === "darwin") {
    if (cmd.startsWith("set ")) await run("osascript", ["-e", "set volume output volume " + Number(cmd.slice(4))]);
    if (cmd === "mute" || cmd === "unmute") await run("osascript", ["-e", "set volume " + (cmd === "mute" ? "with" : "without") + " output muted"]);
    const out = await run("osascript", ["-e", "output volume of (get volume settings) & \" \" & output muted of (get volume settings)"]);
    const m = out && /(\d+)\D+(true|false)/.exec(out);
    return m ? { volume: Number(m[1]), muted: m[2] === "true" } : null;
  }
  // Linux : PulseAudio / PipeWire (pactl), sinon ALSA (amixer)
  if (await run("pactl", ["--version"])) {
    if (cmd.startsWith("set ")) await run("pactl", ["set-sink-volume", "@DEFAULT_SINK@", Number(cmd.slice(4)) + "%"]);
    if (cmd === "mute" || cmd === "unmute") await run("pactl", ["set-sink-mute", "@DEFAULT_SINK@", cmd === "mute" ? "1" : "0"]);
    const v = await run("pactl", ["get-sink-volume", "@DEFAULT_SINK@"]);
    const m = await run("pactl", ["get-sink-mute", "@DEFAULT_SINK@"]);
    const pv = v && /(\d+)%/.exec(v);
    return pv ? { volume: Number(pv[1]), muted: /yes|oui/i.test(m || "") } : null;
  }
  if (cmd.startsWith("set ")) await run("amixer", ["-q", "sset", "Master", Number(cmd.slice(4)) + "%"]);
  if (cmd === "mute" || cmd === "unmute") await run("amixer", ["-q", "sset", "Master", cmd === "mute" ? "mute" : "unmute"]);
  const out = await run("amixer", ["sget", "Master"]);
  const m = out && /\[(\d+)%\](?:.*\[(on|off)\])?/.exec(out);
  return m ? { volume: Number(m[1]), muted: m[2] === "off" } : null;
}

const sysVolume = cmd => process.platform === "win32" ? winVolume(cmd) : unixVolume(cmd);

let volBusy = Promise.resolve();
function volOp(cmd) {
  volBusy = volBusy.then(() => sysVolume(cmd)).then(r => {
    if (r) { sysVol = r.volume; sysMuted = r.muted; } else if (cmd === "get") sysVol = null;
    broadcast();
  }).catch(() => {});
  return volBusy;
}
const refreshSysVolume = () => volOp("get");
function setSysVolume(v) { if (Number.isFinite(v)) volOp("set " + Math.max(0, Math.min(100, Math.round(v)))); }
function setSysMute(m) { volOp(m ? "mute" : "unmute"); }
// Volume changé sur le PC lui-même : relu de temps en temps quand un téléphone est là
setInterval(() => { if ([...remotes].some(r => r.authed)) refreshSysVolume(); }, 5000);

// ---------- Pochette en cours ----------

async function sendCover(res, src) {
  try {
    if (!src) { res.writeHead(404); res.end(); return; }
    const coverSrc = src;
    if (/^https?:\/\//i.test(coverSrc)) {
      const r = await fetch(coverSrc, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      res.writeHead(200, { "Content-Type": r.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=86400" });
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    // Pochette locale : seulement dans conductor/datastorage/covers
    const rel = decodeURIComponent(coverSrc.split(/[?#]/)[0]);
    const file = path.resolve(APP, rel);
    if (!file.startsWith(COVERS + path.sep)) throw new Error("chemin refusé");
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const data = await fs.promises.readFile(file);
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "private, max-age=86400" });
    res.end(data);
  } catch (e) {
    res.writeHead(404); res.end();
  }
}

// ---------- Serveur HTTP ----------

const PUBLIC = path.join(HERE, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/cover") {
    // Jeton du téléphone exigé (passé dans l'adresse : une <img> n'envoie pas d'en-tête)
    if (!tokens[url.searchParams.get("t") || ""]) { res.writeHead(403); res.end(); return; }
    const a = url.searchParams.get("a");
    sendCover(res, a ? queueCovers.get(a) || searchCovers.get(a) || "" : coverSrc);
    return;
  }
  const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (!/^[a-z0-9._-]+$/i.test(name)) { res.writeHead(404); res.end(); return; }
  const file = path.join(PUBLIC, name);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("introuvable"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname !== "/ws") { socket.destroy(); return; }
  const ip = (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  const local = ip === "127.0.0.1" || ip === "::1";
  const role = url.searchParams.get("role") === "host" ? "host" : "remote";
  if (role === "host" && !local) { socket.destroy(); return; }   // conductor. : depuis le PC seulement
  if (!wsAccept(req, socket)) return;
  const peer = new Peer(socket, role, { ip });
  if (role === "host") {
    if (host) host.close();
    host = peer;
    log("conductor. connecté");
    host.send(relayInfo());
    host.send({ type: "hello" });
    broadcast();
  } else {
    remotes.add(peer);
  }
});

// Connexions mortes (téléphone en veille, 4G coupée…) : ping toutes les 20 s
setInterval(() => {
  [host, ...remotes].forEach(p => {
    if (!p) return;
    if (!p.alive) { p.socket.destroy(); return; }
    p.alive = false;
    p.ping();
  });
}, 20000);

server.on("error", e => {
  if (e.code === "EADDRINUSE") console.error("\n  Le port " + PORT + " est déjà utilisé : le relais tourne peut-être déjà.\n");
  else console.error("\n  Erreur : " + e.message + "\n");
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  out("");
  out("  conductor. — télécommande");
  out("");
  out("  Code d'appairage : " + PIN.split("").join(" ") + "   (ou le QR code : conductor. → icône téléphone du pied de page)");
  out("");
  out("  Sur le téléphone, ouvrez :");
  const list = addresses();
  if (!list.length) out("    (aucun réseau : connectez le PC à un wifi, un partage de connexion ou Tailscale)");
  list.forEach(a => out("    " + a.url.padEnd(30) + a.label));
  out("");
  out(LOG_FILE ? "  Lancé sans fenêtre : arrêt depuis conductor. (télécommande → Arrêter)." : "  Laissez cette fenêtre ouverte. Ctrl + C pour arrêter.");
  out("");
  refreshSysVolume();
});
