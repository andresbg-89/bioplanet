/* ============================================================
   bioplanet-ecosystem.js  v2.0
   ─────────────────────────────────────────────────────────────
   Pestaña Ecosistema de BioPlanet.
   · Globo con textura satelital real + filtros CSS por tipo
   · Paleta monocromática NASA/ESA: #030b1a / #4db8ff / #c8d8e8
   · Gráficos con datos científicos reales de referencia
     (Keeling CO₂, HadCRUT temp, pH oceánico, LPI biodiversidad)
     más tendencia dinámica que responde a los sliders
   · Modelo: Liebig + Michaelis-Menten + Lindeman
   ─────────────────────────────────────────────────────────────
   Requiere Chart.js cargado globalmente.
   Expone: renderEcosystem(el)  refreshBioPlanet()
   ============================================================ */

/* ── DATOS CIENTÍFICOS DE REFERENCIA ─────────────────────────
   Fuentes: NOAA/Keeling, HadCRUT5, ICOS, IUCN LPI, HOT       */

// CO₂ atmosférico Keeling Curve — ppm (1960-2024, cada 4 años)
const REF_CO2 = [
  {y:'1960',v:317},{y:'1964',v:320},{y:'1968',v:323},{y:'1972',v:327},
  {y:'1976',v:332},{y:'1980',v:339},{y:'1984',v:344},{y:'1988',v:352},
  {y:'1992',v:356},{y:'1996',v:363},{y:'2000',v:370},{y:'2004',v:377},
  {y:'2008',v:385},{y:'2012',v:394},{y:'2016',v:403},{y:'2020',v:412},
  {y:'2024',v:424},
];

// Anomalía temperatura HadCRUT5 — °C sobre 1850-1900 (1880-2024)
const REF_TEMP = [
  {y:'1880',v:-0.42},{y:'1890',v:-0.38},{y:'1900',v:-0.30},{y:'1910',v:-0.46},
  {y:'1920',v:-0.27},{y:'1930',v:-0.11},{y:'1940',v: 0.09},{y:'1950',v:-0.01},
  {y:'1960',v: 0.01},{y:'1970',v: 0.04},{y:'1980',v: 0.27},{y:'1990',v: 0.44},
  {y:'2000',v: 0.42},{y:'2010',v: 0.72},{y:'2020',v: 1.02},{y:'2024',v: 1.48},
];

// pH oceánico (HOT + Aloha station) — 1985-2024
const REF_PH = [
  {y:'1985',v:8.118},{y:'1990',v:8.114},{y:'1995',v:8.106},{y:'2000',v:8.099},
  {y:'2005',v:8.090},{y:'2010',v:8.082},{y:'2015',v:8.077},{y:'2020',v:8.072},
  {y:'2024',v:8.068},
];

// Living Planet Index (WWF/ZSL) — 1970=100, declive vertebrados
const REF_LPI = [
  {y:'1970',v:100},{y:'1975',v:95},{y:'1980',v:90},{y:'1985',v:83},
  {y:'1990',v:76},{y:'1995',v:70},{y:'2000',v:65},{y:'2005',v:61},
  {y:'2010',v:57},{y:'2015',v:54},{y:'2020',v:51},{y:'2024',v:47},
];

/* ── CLASIFICADOR ─────────────────────────────────────────── */
function _bpType(p) {
  if (p.H2S > 5 && p.S > 10000)    return 'sulfuric';
  if (p.Temp > 80 && p.S > 5000)   return 'volcanic';
  if (p.Temp < -40)                 return 'glacial';
  if (p.H2O < 10 && p.Fe > 60)     return 'arid';
  if (p.O2 < 2 && p.CO2 > 5)       return 'gaseous';
  return 'earth';
}

// Etiquetas científicas por tipo
const TYPE_META = {
  earth:    { label: 'Clase M — Terrestre',    filter: 'saturate(1.1) brightness(0.9)',  atm: 'rgba(120,200,255,0.18)' },
  volcanic: { label: 'Clase V — Volcánico',    filter: 'sepia(0.5) hue-rotate(-20deg) brightness(0.7)', atm: 'rgba(255,120,40,0.22)' },
  glacial:  { label: 'Clase G — Criógenico',   filter: 'saturate(0.3) brightness(1.1) hue-rotate(180deg)', atm: 'rgba(200,240,255,0.22)' },
  sulfuric: { label: 'Clase S — Sulfúrico',    filter: 'sepia(0.8) hue-rotate(40deg) brightness(0.75)',  atm: 'rgba(200,220,0,0.20)' },
  arid:     { label: 'Clase D — Árido',        filter: 'sepia(0.6) brightness(0.85)',   atm: 'rgba(200,150,60,0.18)' },
  gaseous:  { label: 'Clase J — Gaseoso',      filter: 'hue-rotate(260deg) saturate(0.7) brightness(0.8)', atm: 'rgba(160,100,255,0.22)' },
};

/* ── MODELO ECOLÓGICO ─────────────────────────────────────── */
function _bpModel(p) {
  const cl = v => Math.max(0, Math.min(1, v));
  const mm = (c, k) => c / (k + c);  // Michaelis-Menten

  // Saturación de nutrientes fotosintéticos (Liebig: el mínimo manda)
  const satP  = mm(p.P,  0.45);
  const satFe = mm(p.Fe, 22);
  const satMg = mm(p.Mg, 14);
  const satCa = mm(p.Ca, 18);
  const photoNuts = [satP, satFe, satMg];
  const limiting  = Math.min(...photoNuts);
  const limitIdx  = photoNuts.indexOf(limiting);
  const limitName = ['P (Fósforo)', 'Fe (Hierro)', 'Mg (Magnesio)'][limitIdx];
  const nutMean   = photoNuts.reduce((a, b) => a + b, 0) / 3;
  const nutVar    = photoNuts.reduce((a, x) => a + (x - nutMean) ** 2, 0) / 3;
  const nutBalance = cl(1 - Math.sqrt(nutVar) * 1.6);

  // Factores ambientales — ventana de habitabilidad
  const waterF = cl(1 - ((p.H2O / 100 - 0.72) / 0.55) ** 2);
  const tempF  = p.Temp >= 5 && p.Temp <= 35  ? 1.0
               : p.Temp >= -20 && p.Temp <= 50 ? 0.55
               : p.Temp >= -60 && p.Temp <= 80 ? 0.20 : 0.04;
  const o2F    = p.O2 >= 15 ? 1.0 : p.O2 >= 5 ? 0.6 : 0.15;
  const phF    = p.pH >= 5.5 && p.pH <= 9 ? 1.0 : p.pH >= 3 && p.pH <= 11 ? 0.5 : 0.15;
  const toxF   = cl(1 - (p.H2S / 6) * 1.1);
  const co2F   = cl(1 - Math.max(0, p.CO2 - 1) * 0.18);

  // GPP — producción primaria bruta (Liebig + balance + ambiente)
  const gpp = cl(
    (limiting * 0.7 + nutMean * 0.3) *
    (0.55 + 0.45 * nutBalance) *
    (0.45 + 0.55 * waterF) *
    tempF * o2F * phF * toxF * co2F
  );

  // Cascada trófica (Lindeman ~10% por nivel)
  const herbivores  = cl(Math.pow(gpp, 0.85) * (0.6 + 0.4 * satCa) * toxF);
  const carnivores  = cl(Math.pow(herbivores, 0.9) * o2F * tempF);
  const apex        = cl(Math.pow(carnivores, 0.9) * waterF);

  // Cobertura vegetal
  const veg     = cl(gpp * 0.72 + satCa * 0.28 * waterF);

  // Estabilidad del sistema
  const floor   = Math.min(satP, satFe, satMg, waterF, tempF, phF);
  const viab    = cl(gpp * 1.4);
  const stab    = cl((nutBalance * 0.4 + floor * 0.25 + gpp * 0.2 + waterF * 0.15) * (0.3 + 0.7 * viab) * toxF);

  // Métricas planetarias derivadas
  const hab       = cl(waterF * 0.3 + tempF * 0.25 + o2F * 0.25 + phF * 0.1 + toxF * 0.1);
  const biodiv    = cl(Math.pow(gpp, 0.7) * toxF * waterF);
  const tipping   = cl(toxF < 0.4 ? 0.8 : (p.H2S / 6) * 0.4 + Math.max(0, p.CO2 - 1) * 0.08 + (1 - tempF) * 0.3 + (1 - waterF) * 0.3);
  const co2Seq    = gpp * veg * 16;  // t CO₂/ha/año

  // pH oceánico dinámico (acidificación real + efecto CO₂/H₂S slider)
  const co2Atm    = p.CO2 / 0.04;  // ratio vs pre-industrial
  const oceanPH   = cl((8.18 - Math.log(co2Atm) * 0.12 - (p.H2S / 10) * 0.5 - 5.8) / 2.4 + 5.8 / 8.2);
  const oceanPHv  = 8.18 - Math.log(Math.max(0.01, co2Atm)) * 0.12 - (p.H2S / 10) * 0.5;

  return {
    gpp, veg, herbivores, carnivores, apex, stab, hab, biodiv, tipping,
    co2Seq, waterF, tempF, o2F, phF, toxF, nutBalance, limiting,
    limitName, satP, satFe, satMg, satCa, oceanPHv,
  };
}

/* ── CHART.JS: destructor y registro ─────────────────────── */
const _BP2 = {};
function _bpKill() {
  Object.values(_BP2).forEach(c => { try { c.destroy(); } catch(e) {} });
  Object.keys(_BP2).forEach(k => delete _BP2[k]);
}

// Opciones base estilo NASA/ESA
function _bpOpts(extra = {}) {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0a1828',
        borderColor: 'rgba(77,184,255,0.3)',
        borderWidth: 1,
        titleColor: '#4db8ff',
        bodyColor: '#c8d8e8',
        titleFont: { family: 'JetBrains Mono', size: 10 },
        bodyFont:  { family: 'JetBrains Mono', size: 9 },
      },
    },
    scales: {
      x: {
        ticks: { color: '#3a5a7a', font: { size: 8, family: 'JetBrains Mono' }, maxRotation: 0 },
        grid:  { color: 'rgba(77,184,255,0.06)' },
        border: { display: false },
      },
      y: {
        ticks: { color: '#3a5a7a', font: { size: 8, family: 'JetBrains Mono' } },
        grid:  { color: 'rgba(77,184,255,0.06)' },
        border: { display: false },
      },
    },
    ...extra,
  };
}

function _bpMkChart(id, cfg) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;flex:1;min-height:0;';
  const cv = document.createElement('canvas');
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', id + ' scientific chart');
  wrap.appendChild(cv);
  if (_BP2[id]) try { _BP2[id].destroy(); } catch(e) {}
  requestAnimationFrame(() => {
    if (!cv.isConnected) return;
    _BP2[id] = new Chart(cv, cfg);
  });
  return wrap;
}

/* ── ESTADO ──────────────────────────────────────────────── */
let _bpEl = null;

/* ══════════════════════════════════════════════════════════
   PUNTO DE ENTRADA
   ══════════════════════════════════════════════════════════ */
function renderEcosystem(el) {
  _bpKill();
  _bpEl = el;
  _bpInjectStyles();
  const p   = window.vals || _bpDefaultP();
  const t   = _bpType(p);
  const m   = _bpModel(p);
  el.innerHTML = _bpHTML();
  _bpDraw(p, t, m);
}

function refreshBioPlanet() {
  if (!_bpEl || !document.body.contains(_bpEl)) return;
  if (typeof currentTab !== 'undefined' && currentTab !== 'ecosystem') return;
  const p = window.vals || _bpDefaultP();
  const t = _bpType(p);
  const m = _bpModel(p);
  _bpKill();
  _bpDraw(p, t, m);
}

function _bpDefaultP() {
  return { Ca:41,Fe:56,Si:282,P:1.0,Mg:23,Cu:60,S:350,H2S:0,H2O:71,CO2:0.04,O2:21,Temp:15,pH:7.2,gravity:1.0 };
}

/* ── ESTILOS ─────────────────────────────────────────────── */
function _bpInjectStyles() {
  if (document.getElementById('_bpSty2')) return;
  const s = document.createElement('style');
  s.id = '_bpSty2';
  s.textContent = `
    #_bpRoot{width:100%;height:100%;display:flex;flex-direction:column;
      background:#030b1a;color:#c8d8e8;
      font-family:'JetBrains Mono',monospace;position:relative;overflow:hidden;}
    #_bpRoot *{box-sizing:border-box;}
    .bp2-grid{position:absolute;inset:0;pointer-events:none;z-index:0;
      background-image:linear-gradient(rgba(77,184,255,0.025) 1px,transparent 1px),
        linear-gradient(90deg,rgba(77,184,255,0.025) 1px,transparent 1px);
      background-size:48px 48px;}
    .bp2-hdr{z-index:2;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;
      padding:6px 18px;border-bottom:1px solid rgba(77,184,255,0.12);
      background:rgba(3,11,26,0.9);backdrop-filter:blur(4px);}
    .bp2-body{position:relative;z-index:1;flex:1;display:flex;gap:10px;
      padding:10px 14px;min-height:0;overflow:hidden;}
    .bp2-left{display:flex;flex-direction:column;gap:10px;width:230px;flex-shrink:0;}
    .bp2-center{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0;}
    .bp2-right{display:flex;flex-direction:column;gap:10px;width:230px;flex-shrink:0;}
    .bp2-panel{background:rgba(4,14,30,0.85);
      border:1px solid rgba(77,184,255,0.14);border-radius:6px;
      padding:10px 12px;display:flex;flex-direction:column;overflow:hidden;}
    .bp2-ph{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-shrink:0;}
    .bp2-phbar{width:2px;height:10px;background:#4db8ff;border-radius:1px;flex-shrink:0;}
    .bp2-phtxt{font-size:8px;letter-spacing:.18em;color:#4db8ff;font-weight:700;flex:1;}
    .bp2-dot{width:4px;height:4px;border-radius:50%;background:#4db8ff;
      animation:bp2blink 2s ease-in-out infinite;flex-shrink:0;}
    .bp2-chip{display:flex;flex-direction:column;}
    .bp2-cl{font-size:7px;color:#243a52;letter-spacing:.1em;}
    .bp2-cv{font-size:9px;font-weight:700;letter-spacing:.05em;}
    .bp2-barrow{display:flex;align-items:center;gap:5px;font-size:7px;margin-bottom:4px;}
    .bp2-bt{flex:1;height:4px;background:rgba(77,184,255,0.08);border-radius:2px;overflow:hidden;}
    .bp2-bf{height:100%;border-radius:2px;transition:width .45s;}
    .bp2-met{margin-bottom:6px;}
    .bp2-metrow{display:flex;justify-content:space-between;font-size:7.5px;margin-bottom:2px;}
    .bp2-mtrack{height:3px;background:rgba(77,184,255,0.08);border-radius:2px;overflow:hidden;}
    .bp2-mfill{height:100%;border-radius:2px;transition:width .45s;}
    .bp2-smrow{display:flex;gap:6px;margin-top:auto;padding-top:6px;
      border-top:1px solid rgba(77,184,255,0.08);flex-shrink:0;}
    .bp2-sm .bp2-sl{font-size:6px;color:#3a5a7a;letter-spacing:.08em;}
    .bp2-sm .bp2-sv{font-size:10px;font-weight:700;margin-top:1px;}
    .bp2-kpi{background:rgba(4,14,30,0.7);border:1px solid rgba(77,184,255,0.12);
      border-radius:5px;padding:7px 10px;text-align:center;}
    .bp2-kl{font-size:6px;color:#3a5a7a;letter-spacing:.1em;text-transform:uppercase;}
    .bp2-kv{font-size:13px;font-weight:700;margin-top:2px;}
    .bp2-coord{display:flex;align-items:center;gap:4px;
      background:rgba(4,14,30,0.8);border:1px solid rgba(77,184,255,0.14);
      border-radius:3px;padding:2px 7px;}
    .bp2-gm{position:absolute;display:flex;flex-direction:column;align-items:center;z-index:5;}
    .bp2-gml{font-size:6.5px;color:#243a52;letter-spacing:.08em;}
    .bp2-gmv{font-size:9px;font-weight:700;}
    .bp2-ref{font-size:6px;color:#243a52;letter-spacing:.05em;margin-bottom:3px;flex-shrink:0;}
    .bp2-badge{display:inline-flex;align-items:center;gap:4px;
      border-radius:3px;padding:1px 6px;font-size:7px;font-weight:700;letter-spacing:.08em;}
    .bp2-alrt{display:flex;flex-direction:column;gap:5px;}
    .bp2-alitem{display:flex;align-items:flex-start;gap:7px;padding:5px 8px;
      border-radius:4px;border-left:2px solid;font-size:9px;line-height:1.4;}
    .bp2-bottom{display:flex;gap:10px;height:180px;flex-shrink:0;
      padding:0 14px 10px;}
    .bp2-ftr{z-index:2;flex-shrink:0;display:flex;justify-content:space-between;
      align-items:center;padding:4px 18px;
      border-top:1px solid rgba(77,184,255,0.08);background:rgba(3,11,26,0.7);}
    @keyframes bp2blink{0%,100%{opacity:1}50%{opacity:.2}}
    @keyframes bp2scan{0%{top:20%;opacity:0}12%{opacity:1}88%{opacity:1}100%{top:80%;opacity:0}}
    @keyframes bp2orbit{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    @keyframes bp2orbitr{from{transform:rotateX(70deg) rotate(0)}to{transform:rotateX(70deg) rotate(-360deg)}}
  `;
  document.head.appendChild(s);
}

/* ── HTML ESQUELETO ─────────────────────────────────────── */
function _bpHTML() {
  return `<div id="_bpRoot">
  <div class="bp2-grid"></div>
  <div class="bp2-hdr" id="bp2h"></div>
  <div class="bp2-body">
    <div class="bp2-left">
      <div class="bp2-panel" id="bp2-mineral" style="flex:0 0 auto;height:48%"></div>
      <div class="bp2-panel" id="bp2-liebig"  style="flex:1;min-height:0"></div>
    </div>
    <div class="bp2-center">
      <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;min-height:0;">
        <div style="position:absolute;top:5px;left:50%;transform:translateX(-50%);
          display:flex;align-items:center;gap:7px;z-index:5;">
          <div style="display:flex;gap:2px">${[14,9,5,2].map(w=>`<span style="display:inline-block;width:${w}px;height:1px;background:rgba(77,184,255,0.3)"></span>`).join('')}</div>
          <span style="color:#4db8ff;font-size:7px;letter-spacing:.2em;opacity:.6">REAL·TIME TELEMETRY</span>
          <div style="display:flex;gap:2px">${[2,5,9,14].map(w=>`<span style="display:inline-block;width:${w}px;height:1px;background:rgba(77,184,255,0.3)"></span>`).join('')}</div>
        </div>
        <div id="bp2-globe" style="width:100%;height:100%;position:relative;display:flex;align-items:center;justify-content:center"></div>
        <div style="position:absolute;bottom:8px;display:flex;gap:8px;z-index:5;">
          <div class="bp2-coord"><span style="color:#243a52;font-size:7px">LAT</span><span style="color:#4db8ff;font-size:8px">0.000°N</span></div>
          <div class="bp2-coord"><span style="color:#243a52;font-size:7px">LON</span><span style="color:#4db8ff;font-size:8px">0.000°E</span></div>
          <div class="bp2-coord"><span style="color:#243a52;font-size:7px">ALT</span><span id="bp2-alt" style="color:#4db8ff;font-size:8px">0km</span></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;flex-shrink:0;">
        <div class="bp2-kpi" id="bp2k0"></div>
        <div class="bp2-kpi" id="bp2k1"></div>
        <div class="bp2-kpi" id="bp2k2"></div>
        <div class="bp2-kpi" id="bp2k3"></div>
      </div>
    </div>
    <div class="bp2-right">
      <div class="bp2-panel" id="bp2-atm"  style="flex:1;min-height:0"></div>
      <div class="bp2-panel" id="bp2-ph"   style="flex:1;min-height:0"></div>
    </div>
  </div>
  <div class="bp2-bottom">
    <div class="bp2-panel" style="flex:1" id="bp2-co2"></div>
    <div class="bp2-panel" style="flex:1" id="bp2-temp"></div>
    <div class="bp2-panel" style="flex:1" id="bp2-lpi"></div>
    <div class="bp2-panel" style="flex:1" id="bp2-trophic"></div>
  </div>
  <div class="bp2-ftr" id="bp2ftr"></div>
</div>`;
}

/* ── RENDER MAESTRO ──────────────────────────────────────── */
function _bpDraw(p, type, m) {
  const meta = TYPE_META[type];
  _bpHeader(p, type, meta, m);
  _bpGlobe(p, type, meta, m);
  _bpKpis(p, m);
  _bpMineralPanel(p, m);
  _bpLiebigPanel(p, m);
  _bpAtmPanel(p, m);
  _bpPhPanel(p, m);
  _bpCo2Chart(p);
  _bpTempChart(p);
  _bpLpiChart(p, m);
  _bpTrophicChart(p, m);
  _bpFooter(type, meta, m);
}

/* ── COLOR SEMÁNTICO (solo para alertas) ──────────────────── */
function _bpAlert(v) {  // v: 0..1 score
  if (v >= 0.66) return { c: '#4db8ff', l: 'ÓPTIMO' };
  if (v >= 0.42) return { c: '#e8b84b', l: 'ESTRÉS' };
  if (v >= 0.22) return { c: '#e07840', l: 'CRÍTICO' };
  return { c: '#c84040', l: 'COLAPSO' };
}

/* ── HEADER ──────────────────────────────────────────────── */
function _bpHeader(p, type, meta, m) {
  const al = _bpAlert(m.stab);
  document.getElementById('bp2h').innerHTML = `
    <div style="display:flex;gap:18px;">
      <div class="bp2-chip"><span class="bp2-cl">TIPO PLANETARIO</span><span class="bp2-cv" style="color:#4db8ff">${meta.label}</span></div>
      <div class="bp2-chip"><span class="bp2-cl">HABITABILIDAD</span><span class="bp2-cv" style="color:${_bpAlert(m.hab).c}">${Math.round(m.hab*100)}%</span></div>
      <div class="bp2-chip"><span class="bp2-cl">TEMP SUPERFICIAL</span><span class="bp2-cv" style="color:#c8d8e8">${p.Temp}°C</span></div>
    </div>
    <div style="text-align:center;position:absolute;left:50%;transform:translateX(-50%);">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:32px;height:1px;background:linear-gradient(90deg,transparent,rgba(77,184,255,0.5))"></div>
        <span style="color:#e8f4ff;font-size:15px;font-weight:700;letter-spacing:.3em;text-shadow:0 0 20px rgba(77,184,255,0.35)">BIOPLANET · ECOSISTEMA</span>
        <div style="width:32px;height:1px;background:linear-gradient(90deg,rgba(77,184,255,0.5),transparent)"></div>
      </div>
      <div style="color:#243a52;font-size:7px;letter-spacing:.2em;margin-top:2px">GLOBAL ECOSYSTEM MONITORING · ${meta.label.toUpperCase()}</div>
    </div>
    <div style="display:flex;gap:18px;justify-content:flex-end;">
      <div class="bp2-chip" style="align-items:flex-end"><span class="bp2-cl">ESTABILIDAD</span><span class="bp2-cv" style="color:${al.c}">${al.l} ${Math.round(m.stab*100)}%</span></div>
      <div class="bp2-chip" style="align-items:flex-end"><span class="bp2-cl">NUTRIENTE LIMITANTE</span><span class="bp2-cv" style="color:#e8b84b">${m.limitName}</span></div>
      <div class="bp2-chip" style="align-items:flex-end"><span class="bp2-cl">UTC</span><span class="bp2-cv" style="color:#4db8ff">${new Date().toUTCString().slice(17,25)}</span></div>
    </div>`;
}

/* ── GLOBO SATELITAL ─────────────────────────────────────── */
function _bpGlobe(p, type, meta, m) {
  const cloudO = Math.min(0.75, p.H2O / 100 * 1.1);
  const acidO  = Math.max(0, (8.1 - m.oceanPHv) / 2);

  // URLs de textura satelital NASA/USGS
  const textures = {
    earth:    'https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=600&h=600&fit=crop',
    volcanic: 'https://images.unsplash.com/photo-1600002415506-dd8e0504a5c0?w=600&h=600&fit=crop',
    glacial:  'https://images.unsplash.com/photo-1517783999520-f068d7431a60?w=600&h=600&fit=crop',
    sulfuric: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&h=600&fit=crop',
    arid:     'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600&h=600&fit=crop',
    gaseous:  'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=600&h=600&fit=crop',
  };

  document.getElementById('bp2-globe').innerHTML = `
    <!-- anillos orbitales -->
    <div style="position:absolute;width:340px;height:340px;border-radius:50%;border:1px solid rgba(77,184,255,0.1);animation:bp2orbit 60s linear infinite;pointer-events:none"></div>
    <div style="position:absolute;width:295px;height:295px;border-radius:50%;border:1px solid rgba(77,184,255,0.18)"></div>
    <div style="position:absolute;width:278px;height:88px;border-radius:50%;border:1px solid rgba(77,184,255,0.22);transform:rotateX(70deg);animation:bp2orbitr 30s linear infinite"></div>
    <div style="position:absolute;width:278px;height:88px;border-radius:50%;border:1px solid rgba(77,184,255,0.12);transform:rotateX(70deg) rotateY(55deg)"></div>

    <!-- halo atmosférico -->
    <div style="position:absolute;width:256px;height:256px;border-radius:50%;
      background:radial-gradient(circle,transparent 46%,${meta.atm} 62%,transparent 72%);
      filter:blur(6px)"></div>

    <!-- globo -->
    <div style="position:relative;width:232px;height:232px;border-radius:50%;overflow:hidden;
      box-shadow:0 0 50px rgba(77,184,255,0.22),inset -35px -12px 60px rgba(0,0,0,0.65);
      border:1px solid rgba(77,184,255,0.35);z-index:2;">
      <!-- textura satelital -->
      <img src="${textures[type]}" alt="planetary surface"
        style="width:100%;height:100%;object-fit:cover;filter:${meta.filter};display:block;"
        onerror="this.style.display='none'">
      <!-- tinte de acidificación oceánica -->
      <div style="position:absolute;inset:0;border-radius:50%;
        background:rgba(180,80,20,${acidO.toFixed(2)});mix-blend-mode:multiply"></div>
      <!-- capa de nubes -->
      ${cloudO > 0.15 ? `<div style="position:absolute;inset:0;border-radius:50%;
        background:radial-gradient(ellipse at 38% 28%,rgba(255,255,255,${(cloudO*0.5).toFixed(2)}) 0%,transparent 55%),
          radial-gradient(ellipse at 68% 60%,rgba(255,255,255,${(cloudO*0.35).toFixed(2)}) 0%,transparent 42%),
          radial-gradient(ellipse at 20% 65%,rgba(255,255,255,${(cloudO*0.25).toFixed(2)}) 0%,transparent 38%)">
        </div>` : ''}
      <!-- terminator (sombra noche) -->
      <div style="position:absolute;inset:0;border-radius:50%;
        background:radial-gradient(circle at 31% 28%,transparent 38%,rgba(0,0,15,0.58) 100%)"></div>
      <!-- specular highlight -->
      <div style="position:absolute;inset:0;border-radius:50%;
        background:radial-gradient(circle at 29% 26%,rgba(200,225,255,0.12) 0%,transparent 40%)"></div>
    </div>

    <!-- línea de escaneo -->
    <div style="position:absolute;width:232px;height:1.5px;z-index:3;
      background:linear-gradient(90deg,transparent,rgba(77,184,255,0.8) 25%,rgba(77,184,255,1) 50%,rgba(77,184,255,0.8) 75%,transparent);
      animation:bp2scan 4s ease-in-out infinite;filter:blur(0.5px)"></div>

    <!-- puntos de telemetría -->
    ${[{t:'26%',l:'44%'},{t:'52%',l:'70%'},{t:'38%',l:'70%'},{t:'62%',l:'28%'}].map((pt,i)=>`
      <div style="position:absolute;top:${pt.t};left:${pt.l};width:5px;height:5px;border-radius:50%;
        background:#4db8ff;box-shadow:0 0 7px rgba(77,184,255,0.9);z-index:4;
        animation:bp2blink ${1.4+i*0.35}s ease-in-out infinite"></div>`).join('')}

    <!-- métricas flotantes -->
    <div class="bp2-gm" style="top:9%;right:7%"><span class="bp2-gml">H₂O</span><span class="bp2-gmv" style="color:#4db8ff">${p.H2O}%</span></div>
    <div class="bp2-gm" style="top:40%;right:3%"><span class="bp2-gml">O₂</span><span class="bp2-gmv" style="color:#4db8ff">${p.O2}%</span></div>
    <div class="bp2-gm" style="bottom:18%;right:7%"><span class="bp2-gml">pH</span><span class="bp2-gmv" style="color:${m.oceanPHv<7.8?'#e07840':'#4db8ff'}">${m.oceanPHv.toFixed(2)}</span></div>
    <div class="bp2-gm" style="top:9%;left:7%"><span class="bp2-gml">CO₂</span><span class="bp2-gmv" style="color:${p.CO2>1?'#e8b84b':'#4db8ff'}">${p.CO2.toFixed?p.CO2.toFixed(2):p.CO2}%</span></div>
    <div class="bp2-gm" style="top:40%;left:3%"><span class="bp2-gml">H₂S</span><span class="bp2-gmv" style="color:${p.H2S>3?'#c84040':'#4db8ff'}">${p.H2S}%</span></div>
    <div class="bp2-gm" style="bottom:18%;left:7%"><span class="bp2-gml">TEMP</span><span class="bp2-gmv" style="color:#4db8ff">${p.Temp}°</span></div>`;

  document.getElementById('bp2-alt').textContent = Math.round(400 + (p.gravity||1)*12) + ' km';
}

/* ── KPIS ────────────────────────────────────────────────── */
function _bpKpis(p, m) {
  const kpis = [
    { l:'HABITABILIDAD',    v: Math.round(m.hab*100)+'%',   a: _bpAlert(m.hab) },
    { l:'GPP (prod. prim.)',v: Math.round(m.gpp*100),       a: _bpAlert(m.gpp) },
    { l:'BIODIVERSIDAD',    v: Math.round(m.biodiv*100)+'%',a: _bpAlert(m.biodiv) },
    { l:'RIESGO TIPPING',   v: Math.round(m.tipping*100)+'%',a:_bpAlert(1-m.tipping) },
  ];
  kpis.forEach((k,i)=>{
    document.getElementById('bp2k'+i).innerHTML=`
      <div class="bp2-kl">${k.l}</div>
      <div class="bp2-kv" style="color:${k.a.c}">${k.v}</div>`;
  });
}

/* ── PANEL: COMPOSICIÓN MINERAL ─────────────────────────── */
function _bpMineralPanel(p, m) {
  const el = document.getElementById('bp2-mineral');
  el.innerHTML = `<div class="bp2-ph"><div class="bp2-phbar"></div><span class="bp2-phtxt">COMPOSICIÓN MINERAL</span><div class="bp2-dot"></div></div>`;

  const items = [
    { sym:'Si', v:Math.round(p.Si/10), pct: p.Si/350*100, unit:'K ppm' },
    { sym:'Fe', v:Math.round(p.Fe),    pct: p.Fe/100*100,  unit:'K ppm' },
    { sym:'Ca', v:Math.round(p.Ca),    pct: p.Ca/100*100,  unit:'K ppm' },
    { sym:'Mg', v:Math.round(p.Mg),    pct: p.Mg/60*100,   unit:'K ppm' },
    { sym:'P',  v:+(p.P).toFixed(2),   pct: p.P/5*100,     unit:'K ppm' },
    { sym:'S',  v:Math.round(p.S),     pct: Math.min(100,p.S/25000*100), unit:'ppm' },
  ];

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:5px;flex:1;';
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'bp2-barrow';
    row.innerHTML = `
      <span style="color:#4db8ff;width:16px;font-size:7.5px">${it.sym}</span>
      <div class="bp2-bt"><div class="bp2-bf" style="width:${Math.min(100,it.pct).toFixed(1)}%;background:rgba(77,184,255,0.55)"></div></div>
      <span style="color:#c8d8e8;width:46px;text-align:right;font-size:7px">${it.v} ${it.unit}</span>`;
    wrap.appendChild(row);
  });
  el.appendChild(wrap);

  // Ratios científicos
  const kpis = document.createElement('div');
  kpis.style.cssText = 'display:flex;gap:4px;margin-top:auto;padding-top:7px;border-top:1px solid rgba(77,184,255,0.08);flex-shrink:0;';
  kpis.innerHTML = `
    <div style="flex:1;text-align:center"><div class="bp2-kl">Fe/Si</div><div style="font-size:10px;font-weight:700;color:#4db8ff">${(p.Fe/Math.max(1,p.Si/10)).toFixed(2)}</div></div>
    <div style="width:1px;background:rgba(77,184,255,0.08)"></div>
    <div style="flex:1;text-align:center"><div class="bp2-kl">C-SEQ t/ha/yr</div><div style="font-size:10px;font-weight:700;color:#4db8ff">${m.co2Seq.toFixed(1)}</div></div>`;
  el.appendChild(kpis);
}

/* ── PANEL: DIAGRAMA LIEBIG (nutriente limitante) ────────── */
function _bpLiebigPanel(p, m) {
  const el = document.getElementById('bp2-liebig');
  const nv = [
    { n:'P',  sat: m.satP,  lim: m.limitName.startsWith('P') },
    { n:'Fe', sat: m.satFe, lim: m.limitName.startsWith('Fe') },
    { n:'Mg', sat: m.satMg, lim: m.limitName.startsWith('Mg') },
    { n:'Ca', sat: m.satCa, lim: false },
  ];
  el.innerHTML = `<div class="bp2-ph"><div class="bp2-phbar"></div><span class="bp2-phtxt">LEY DEL MÍNIMO — LIEBIG</span><div class="bp2-dot"></div></div>
    <div class="bp2-ref">V = Vmax · S/(Km + S) — el nutriente más bajo controla la GPP</div>`;

  const barWrap = document.createElement('div');
  barWrap.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
  nv.forEach(n => {
    const row = document.createElement('div');
    row.className = 'bp2-barrow';
    const color = n.lim ? '#e8b84b' : 'rgba(77,184,255,0.5)';
    row.innerHTML = `
      <span style="color:${n.lim?'#e8b84b':'#4db8ff'};width:20px;font-size:7.5px">${n.n}</span>
      <div class="bp2-bt">
        <div class="bp2-bf" style="width:${Math.round(n.sat*100)}%;background:${color}"></div>
      </div>
      <span style="color:${color};width:30px;text-align:right;font-size:7px">${Math.round(n.sat*100)}%</span>
      ${n.lim ? '<span style="color:#e8b84b;font-size:7px;margin-left:2px">← LIM</span>' : ''}`;
    barWrap.appendChild(row);
  });
  el.appendChild(barWrap);

  // Factores ambientales
  const envs = [
    { n:'H₂O',  v:m.waterF }, { n:'Temp', v:m.tempF },
    { n:'O₂',   v:m.o2F },   { n:'pH',   v:m.phF },
    { n:'Tox',  v:m.toxF },
  ];
  const sep = document.createElement('div');
  sep.style.cssText = 'font-size:7px;color:#243a52;letter-spacing:.08em;margin:8px 0 5px';
  sep.textContent = 'FACTORES AMBIENTALES';
  el.appendChild(sep);

  envs.forEach(e => {
    const row = document.createElement('div');
    row.className = 'bp2-barrow';
    row.innerHTML = `
      <span style="color:#4db8ff;width:24px;font-size:7.5px">${e.n}</span>
      <div class="bp2-bt"><div class="bp2-bf" style="width:${Math.round(e.v*100)}%;background:rgba(77,184,255,0.4)"></div></div>
      <span style="color:#c8d8e8;width:28px;text-align:right;font-size:7px">${Math.round(e.v*100)}%</span>`;
    el.appendChild(row);
  });

  // GPP resultante
  const gppRow = document.createElement('div');
  gppRow.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid rgba(77,184,255,0.08);display:flex;justify-content:space-between;align-items:center;';
  gppRow.innerHTML = `
    <div style="font-size:7px;color:#4db8ff;letter-spacing:.1em">GPP RESULTANTE</div>
    <div style="font-size:18px;font-weight:700;color:${_bpAlert(m.gpp).c}">${Math.round(m.gpp*100)}</div>
    <div style="font-size:7px;color:#3a5a7a">gC/m²/día<br>índice 0–100</div>`;
  el.appendChild(gppRow);
}

/* ── PANEL: DINÁMICA ATMOSFÉRICA ─────────────────────────── */
function _bpAtmPanel(p, m) {
  const el = document.getElementById('bp2-atm');
  el.innerHTML = `<div class="bp2-ph"><div class="bp2-phbar"></div><span class="bp2-phtxt">DINÁMICA ATMOSFÉRICA</span><div class="bp2-dot"></div></div>`;

  const gases = [
    { n:'N₂',    v: Math.max(0, 78 - p.CO2 * 0.3),       ref:78.1 },
    { n:'O₂',    v: p.O2,                                  ref:20.9 },
    { n:'CO₂',   v: p.CO2,                                 ref:0.04 },
    { n:'H₂S',   v: p.H2S,                                 ref:0.0  },
    { n:'H₂O(v)',v: Math.min(4, p.H2O * 0.04),            ref:1.0  },
  ];

  gases.forEach(g => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin-bottom:6px;';
    const maxV = Math.max(g.v, g.ref, 0.01);
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:7.5px;">
        <span style="color:#4db8ff">${g.n}</span>
        <div style="display:flex;gap:8px;">
          <span style="color:#c8d8e8">${g.v < 1 ? g.v.toFixed(2) : g.v.toFixed(1)}%</span>
          <span style="color:#3a5a7a">ref:${g.ref.toFixed(2)}%</span>
        </div>
      </div>
      <div style="position:relative;height:6px;background:rgba(77,184,255,0.07);border-radius:2px;overflow:visible;">
        <div style="height:100%;width:${Math.min(100,g.v/maxV*100).toFixed(1)}%;background:rgba(77,184,255,0.55);border-radius:2px;transition:width .4s"></div>
        <div style="position:absolute;top:-1px;height:8px;width:2px;background:rgba(77,184,255,0.3);border-radius:1px;
          left:${Math.min(100,g.ref/maxV*100).toFixed(1)}%"></div>
      </div>`;
    el.appendChild(row);
  });

  // Presión atmosférica estimada
  const press = ((p.O2/21) * 0.21 + Math.max(0, 78-p.CO2*0.3)/78 * 0.78) * (p.gravity||1) * 101.3;
  const sm = document.createElement('div');
  sm.className = 'bp2-smrow';
  sm.innerHTML = `
    <div class="bp2-sm"><div class="bp2-sl">PRESIÓN EST.</div><div class="bp2-sv" style="color:#4db8ff">${press.toFixed(0)} kPa</div></div>
    <div class="bp2-sm"><div class="bp2-sl">ESCUDO UV</div><div class="bp2-sv" style="color:${p.O2>10?'#4db8ff':'#e8b84b'}">${p.O2>10?'ACTIVO':'DÉBIL'}</div></div>
    <div class="bp2-sm"><div class="bp2-sl">EFECTO INVER.</div><div class="bp2-sv" style="color:${p.CO2>1?'#e07840':'#4db8ff'}">${p.CO2>5?'EXTREMO':p.CO2>1?'ALTO':'BAJO'}</div></div>`;
  el.appendChild(sm);
}

/* ── PANEL: pH OCEÁNICO ──────────────────────────────────── */
function _bpPhPanel(p, m) {
  const el = document.getElementById('bp2-ph');
  el.innerHTML = `<div class="bp2-ph"><div class="bp2-phbar"></div><span class="bp2-phtxt">ACIDIFICACIÓN OCEÁNICA</span><div class="bp2-dot"></div></div>
    <div class="bp2-ref">Fuente: HOT/ALOHA · Datos ref. 1985–2024 + modelo dinámico CO₂/H₂S</div>`;

  // Serie histórica real + punto dinámico del slider
  const hist = REF_PH.map(d => ({ x: d.y, y: d.v }));
  const labels  = [...hist.map(d => d.x), 'AHORA'];
  const refData = [...hist.map(d => d.y), null];
  const nowData = [...hist.map(() => null), m.oceanPHv];

  el.appendChild(_bpMkChart('ph', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'pH histórico (HOT)',
          data: refData,
          borderColor: 'rgba(77,184,255,0.6)',
          borderWidth: 1.5, pointRadius: 0, tension: 0.35, fill: false,
        },
        {
          label: 'pH actual (modelo)',
          data: nowData,
          borderColor: '#4db8ff',
          pointRadius: 5, pointBackgroundColor: m.oceanPHv < 7.9 ? '#e07840' : '#4db8ff',
          fill: false,
        },
      ],
    },
    options: _bpOpts({ scales: { y: { min: 7.8, max: 8.2, ticks: { color:'#3a5a7a', font:{size:8,family:'JetBrains Mono'} }, grid:{color:'rgba(77,184,255,0.06)'}, border:{display:false} }, x: { ticks:{color:'#3a5a7a',font:{size:7,family:'JetBrains Mono'}}, grid:{display:false}, border:{display:false} } } }),
  }));

  const sm = document.createElement('div');
  sm.className = 'bp2-smrow';
  sm.innerHTML = `
    <div class="bp2-sm"><div class="bp2-sl">pH ACTUAL</div><div class="bp2-sv" style="color:${m.oceanPHv<7.9?'#e07840':'#4db8ff'}">${m.oceanPHv.toFixed(3)}</div></div>
    <div class="bp2-sm"><div class="bp2-sl">REF. PRE-IND.</div><div class="bp2-sv" style="color:#c8d8e8">8.180</div></div>
    <div class="bp2-sm"><div class="bp2-sl">ΔACIDEZ</div><div class="bp2-sv" style="color:#e07840">−${(8.18-m.oceanPHv).toFixed(3)}</div></div>`;
  el.appendChild(sm);
}

/* ── GRÁFICO: CO₂ KEELING CURVE ──────────────────────────── */
function _bpCo2Chart(p) {
  const el = document.getElementById('bp2-co2');
  el.innerHTML = `<div class="bp2-ph"><div class="bp2-phbar"></div><span class="bp2-phtxt">CO₂ ATMOSFÉRICO — CURVA DE KEELING</span><div class="bp2-dot"></div></div>
    <div class="bp2-ref">Fuente: NOAA/Scripps Institution · ppm · ref. 1960–2024 + slider actual</div>`;

  const labels  = [...REF_CO2.map(d => d.y), 'SLIDER'];
  const refVals = [...REF_CO2.map(d => d.v), null];
  // Convertir % a ppm: 0.04% ≈ 400 ppm
  const sliderPpm = Math.round(p.CO2 / 0.04 * 400);
  const sliderData = [...REF_CO2.map(() => null), sliderPpm];

  el.appendChild(_bpMkChart('co2', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'CO₂ ppm (NOAA)', data: refVals, borderColor:'rgba(77,184,255,0.5)', borderWidth:1.5, pointRadius:0, tension:0.3, fill: { target:'origin', above:'rgba(77,184,255,0.05)' } },
        { label:'Slider', data: sliderData, borderColor: sliderPpm>450?'#e07840':'#4db8ff', pointRadius:6, pointBackgroundColor: sliderPpm>450?'#e07840':'#4db8ff', fill:false },
      ],
    },
    options: _bpOpts({ scales: { y: { min: 260, ticks:{color:'#3a5a7a',font:{size:8,family:'JetBrains Mono'}}, grid:{color:'rgba(77,184,255,0.06)'}, border:{display:false} }, x: {ticks:{color:'#3a5a7a',font:{size:7,family:'JetBrains Mono'},maxTicksLimit:6}, grid:{display:false}, border:{display:false}} } }),
  }));

  const sm = document.createElement('div');
  sm.className = 'bp2-smrow';
  sm.innerHTML = `
    <div class="bp2-sm"><div class="bp2-sl">SLIDER (ppm)</div><div class="bp2-sv" style="color:${sliderPpm>450?'#e07840':'#4db8ff'}">${sliderPpm}</div></div>
    <div class="bp2-sm"><div class="bp2-sl">2024 NOAA</div><div class="bp2-sv" style="color:#c8d8e8">424</div></div>
    <div class="bp2-sm"><div class="bp2-sl">PRE-IND. 1800</div><div class="bp2-sv" style="color:#c8d8e8">~280</div></div>`;
  el.appendChild(sm);
}

/* ── GRÁFICO: ANOMALÍA TEMPERATURA ──────────────────────── */
function _bpTempChart(p) {
  const el = document.getElementById('bp2-temp');
  el.innerHTML = `<div class="bp2-ph"><div class="bp2-phbar"></div><span class="bp2-phtxt">ANOMALÍA TÉRMICA — HadCRUT5</span><div class="bp2-dot"></div></div>
    <div class="bp2-ref">Fuente: Met Office/CRU · °C sobre 1850–1900 · ref. 1880–2024 + slider Temp</div>`;

  const sliderAnom = +(p.Temp - 14.0).toFixed(2); // anomalía sobre la media superficial global ~14°C
  const labels  = [...REF_TEMP.map(d => d.y), 'SLIDER'];
  const refVals = [...REF_TEMP.map(d => d.v), null];
  const slData  = [...REF_TEMP.map(() => null), sliderAnom];
  const color   = sliderAnom > 1.5 ? '#e07840' : sliderAnom > 0 ? '#e8b84b' : '#4db8ff';

  el.appendChild(_bpMkChart('temp', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Anomalía °C (HadCRUT5)',
          data: refVals,
          backgroundColor: ctx => {
            const v = ctx.raw;
            return v == null ? 'transparent' : v > 0 ? 'rgba(200,80,40,0.6)' : 'rgba(77,184,255,0.5)';
          },
          borderWidth: 0, borderRadius: 1,
        },
        { label:'Slider', data:slData, backgroundColor:color, borderWidth:0, borderRadius:2 },
      ],
    },
    options: _bpOpts({
      scales: {
        y: { ticks:{color:'#3a5a7a',font:{size:8,family:'JetBrains Mono'}}, grid:{color:'rgba(77,184,255,0.06)'}, border:{display:false} },
        x: { ticks:{color:'#3a5a7a',font:{size:7,family:'JetBrains Mono'},maxTicksLimit:6}, grid:{display:false}, border:{display:false} },
      },
    }),
  }));

  const sm = document.createElement('div');
  sm.className = 'bp2-smrow';
  sm.innerHTML = `
    <div class="bp2-sm"><div class="bp2-sl">SLIDER ANOMALÍA</div><div class="bp2-sv" style="color:${color}">${sliderAnom>0?'+':''}${sliderAnom}°C</div></div>
    <div class="bp2-sm"><div class="bp2-sl">2024 RECORD</div><div class="bp2-sv" style="color:#e07840">+1.48°C</div></div>
    <div class="bp2-sm"><div class="bp2-sl">LÍMITE PARIS</div><div class="bp2-sv" style="color:#c8d8e8">+1.5°C</div></div>`;
  el.appendChild(sm);
}

/* ── GRÁFICO: LIVING PLANET INDEX ────────────────────────── */
function _bpLpiChart(p, m) {
  const el = document.getElementById('bp2-lpi');
  el.innerHTML = `<div class="bp2-ph"><div class="bp2-phbar"></div><span class="bp2-phtxt">ÍNDICE LIVING PLANET (LPI)</span><div class="bp2-dot"></div></div>
    <div class="bp2-ref">Fuente: WWF/ZSL · vertebrados 1970=100 · ref. histórica + biodiversidad del slider</div>`;

  const sliderLpi = Math.round(m.biodiv * 100);
  const labels    = [...REF_LPI.map(d => d.y), 'SLIDER'];
  const refVals   = [...REF_LPI.map(d => d.v), null];
  const slData    = [...REF_LPI.map(() => null), sliderLpi];

  el.appendChild(_bpMkChart('lpi', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'LPI (WWF/ZSL)', data:refVals, borderColor:'rgba(77,184,255,0.5)', borderWidth:1.5, pointRadius:0, tension:0.4, fill:{target:'origin',above:'rgba(77,184,255,0.06)'} },
        { label:'Slider', data:slData, borderColor:_bpAlert(m.biodiv).c, pointRadius:5, pointBackgroundColor:_bpAlert(m.biodiv).c, fill:false },
      ],
    },
    options: _bpOpts({ scales: { y:{min:0,max:105,ticks:{color:'#3a5a7a',font:{size:8,family:'JetBrains Mono'}},grid:{color:'rgba(77,184,255,0.06)'},border:{display:false}}, x:{ticks:{color:'#3a5a7a',font:{size:7,family:'JetBrains Mono'},maxTicksLimit:6},grid:{display:false},border:{display:false}} } }),
  }));

  const sm = document.createElement('div');
  sm.className = 'bp2-smrow';
  sm.innerHTML = `
    <div class="bp2-sm"><div class="bp2-sl">SLIDER LPI</div><div class="bp2-sv" style="color:${_bpAlert(m.biodiv).c}">${sliderLpi}</div></div>
    <div class="bp2-sm"><div class="bp2-sl">2024 REAL</div><div class="bp2-sv" style="color:#e07840">47</div></div>
    <div class="bp2-sm"><div class="bp2-sl">DECLIVE 54 AÑOS</div><div class="bp2-sv" style="color:#c8d8e8">−69%</div></div>`;
  el.appendChild(sm);
}

/* ── GRÁFICO: CASCADA TRÓFICA ─────────────────────────────── */
function _bpTrophicChart(p, m) {
  const el = document.getElementById('bp2-trophic');
  el.innerHTML = `<div class="bp2-ph"><div class="bp2-phbar"></div><span class="bp2-phtxt">CASCADA TRÓFICA — LINDEMAN 10%</span><div class="bp2-dot"></div></div>
    <div class="bp2-ref">Eficiencia ecológica ~10% por nivel · regla de Lindeman (1942)</div>`;

  const trophic = [
    { l:'Productores',  v: Math.round(m.gpp * 1000) },         // base enorme
    { l:'Herbívoros',   v: Math.round(m.herbivores * 100) },
    { l:'Carnívoros',   v: Math.round(m.carnivores * 10) },
    { l:'Apex',         v: Math.round(m.apex * 1) },
    { l:'Descomp.',     v: Math.round(m.gpp * 200) },          // descomponedores ~ 20% GPP
  ];

  el.appendChild(_bpMkChart('troph', {
    type: 'bar',
    data: {
      labels: trophic.map(d => d.l),
      datasets: [{
        label: 'Biomasa relativa',
        data: trophic.map(d => d.v),
        backgroundColor: 'rgba(77,184,255,0.45)',
        borderColor: 'rgba(77,184,255,0.7)',
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      ...(_bpOpts()),
      indexAxis: 'y',
      scales: {
        x: { type:'logarithmic', ticks:{color:'#3a5a7a',font:{size:7,family:'JetBrains Mono'}}, grid:{color:'rgba(77,184,255,0.06)'}, border:{display:false} },
        y: { ticks:{color:'#4db8ff',font:{size:7.5,family:'JetBrains Mono'}}, grid:{display:false}, border:{display:false} },
      },
    },
  }));

  const sm = document.createElement('div');
  sm.className = 'bp2-smrow';
  sm.innerHTML = `
    <div class="bp2-sm"><div class="bp2-sl">APEX PRED.</div><div class="bp2-sv" style="color:${_bpAlert(m.apex).c}">${Math.round(m.apex*100)}</div></div>
    <div class="bp2-sm"><div class="bp2-sl">BIODIV IDX</div><div class="bp2-sv" style="color:${_bpAlert(m.biodiv).c}">${Math.round(m.biodiv*100)}</div></div>
    <div class="bp2-sm"><div class="bp2-sl">ESTABILIDAD</div><div class="bp2-sv" style="color:${_bpAlert(m.stab).c}">${Math.round(m.stab*100)}%</div></div>`;
  el.appendChild(sm);
}

/* ── FOOTER ─────────────────────────────────────────────── */
function _bpFooter(type, meta, m) {
  const al = _bpAlert(m.stab);
  document.getElementById('bp2ftr').innerHTML = `
    <span style="font-size:7px;color:#1e3550;letter-spacing:.1em">BIOPLANET v2.0 · ECOSYSTEM MONITOR · ${meta.label}</span>
    <div style="display:flex;gap:3px">${Array.from({length:14},(_,i)=>`<div style="width:2.5px;height:8px;border-radius:1px;background:rgba(77,184,255,${0.2+i*0.06});"></div>`).join('')}</div>
    <span style="font-size:7px;color:#1e3550;letter-spacing:.1em">SRC: NOAA · HadCRUT5 · HOT/ALOHA · WWF LPI · IUCN</span>`;
}

/* ── EXPONER GLOBALMENTE ─────────────────────────────────── */
window.renderEcosystem  = renderEcosystem;
window.refreshBioPlanet = refreshBioPlanet;
