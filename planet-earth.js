/* ============================================================================
   BIOPLANET · VISTA "PLANET EARTH"  (v2 — conectada al estado real `vals`)
   ----------------------------------------------------------------------------
   Integración:
     1. En index.html, antes de app.js:  <script src="planet-earth.js"></script>
     2. En app.js → renderMain(), añadir una línea:
            else if(currentTab==='planetearth') renderPlanetEarth(el);
     3. En buildTabBtns(), añadir 'planetearth' al array tabIds, y su etiqueta
        correspondiente en la función t('tabs').

   La vista NO tiene sliders propios: LEE el objeto global `vals` de la app
   (símbolos Ca, Fe, Si, P, Mg, Cu, S, Ni, V, O2, CO2, H2S, H2O, Temp, pH, gravity)
   y se re-renderiza en vivo mientras la pestaña está montada.

   Modelo: Liebig (mínimo) + Michaelis–Menten (captación) + Lindeman (10% trófico)
           + balance redox S/H₂S + ventana de habitabilidad (Temp, pH, agua, O₂).
   ============================================================================ */
(function (global) {
  'use strict';

  /* ESCALAS REALES (de SLIDERS en app.js) — para normalizar a 0..1 */
  const SCALE = {
    Ca:100, Fe:100, Si:350, P:5, Mg:60, Cu:300, S:25000, Ni:500, V:1000,
    O2:35, CO2:20, H2S:10, H2O:100, Temp:200, pH:14, gravity:5,
  };
  /* Constantes de semisaturación (Michaelis–Menten) en unidades reales */
  const KM = { Ca:18, Fe:22, P:0.45, Mg:14, S:4000 };

  function n(sym, v) { const s = SCALE[sym] || 1; return Math.max(0, Math.min(1, (v || 0) / s)); }
  function mm(conc, km) { return conc / (km + conc); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  /* Lee window.vals si existe; si no, fallback tipo-Tierra (modo preview) */
  function readVals() {
    if (global.vals && typeof global.vals === 'object' && global.vals.H2O != null) return global.vals;
    return { Ca:41, Fe:56, Si:282, P:1.0, Mg:23, Cu:60, S:350, Ni:84, V:120,
             O2:21, CO2:0.04, H2S:0, H2O:71, Temp:15, pH:7.2, gravity:1.0 };
  }

  /* ------------------------------- MODELO -------------------------------- */
  function model() {
    const v = readVals();

    const satP  = mm(v.P,  KM.P);
    const satFe = mm(v.Fe, KM.Fe);
    const satMg = mm(v.Mg, KM.Mg);
    const satCa = mm(v.Ca, KM.Ca);             // sustituto osmótico/estructural (rol del K)
    const satS  = mm(v.S,  KM.S);

    const photo = [satP, satFe, satMg];
    const photoNames = ['Fósforo', 'Hierro', 'Magnesio'];
    const limiting = Math.min(...photo);
    const limitingName = photoNames[photo.indexOf(limiting)];
    const mean = photo.reduce((a, b) => a + b, 0) / photo.length;
    const variance = photo.reduce((a, x) => a + (x - mean) * (x - mean), 0) / photo.length;
    const balance = Math.max(0, 1 - Math.sqrt(variance) * 1.6);

    const waterFactor = clamp01(1 - Math.pow((n('H2O', v.H2O) - 0.72) / 0.55, 2));
    const temp = v.Temp;
    let tempFactor;
    if (temp >= 5 && temp <= 35) tempFactor = 1;
    else if (temp >= -20 && temp <= 50) tempFactor = 0.55;
    else if (temp >= -60 && temp <= 80) tempFactor = 0.2;
    else tempFactor = 0.04;
    const o2 = v.O2;
    const o2Factor = o2 >= 15 ? 1 : o2 >= 5 ? 0.6 : (v.CO2 >= 1 || v.H2S >= 1) ? 0.3 : 0.12;
    const pH = v.pH;
    const pHFactor = (pH >= 5.5 && pH <= 9) ? 1 : (pH >= 3 && pH <= 11) ? 0.5 : 0.15;
    const co2pct = v.CO2;
    const co2sat = clamp01(co2pct / 5);
    const co2Factor = clamp01(1 - Math.max(0, co2pct - 1) * 0.18);
    const toxic = clamp01(v.H2S / 6);
    const toxFactor = clamp01(1 - toxic * 1.1);
    const sFactor = clamp01(0.75 + 0.5 * satS - 0.6 * Math.max(0, satS - 0.7));

    let gpp = (limiting * 0.7 + mean * 0.3) * (0.55 + 0.45 * balance);
    gpp *= (0.45 + 0.55 * waterFactor) * tempFactor * o2Factor * pHFactor * toxFactor * sFactor * co2Factor;
    gpp = clamp01(gpp);

    const veg = clamp01(gpp * 0.72 + satCa * 0.28 * waterFactor);
    const fauna = Math.pow(veg, 0.85) * (0.6 + 0.4 * satCa) * toxFactor * o2Factor;

    const floor = Math.min(satP, satFe, satMg, waterFactor, tempFactor, pHFactor);
    const viability = clamp01(gpp * 1.4);
    const stab = clamp01((balance * 0.4 + floor * 0.25 + gpp * 0.2 + waterFactor * 0.15)
                          * (0.3 + 0.7 * viability) * toxFactor);

    const chlorophyll = clamp01(satFe * 0.35 + satMg * 0.35 + satP * 0.2 + 0.1 * o2Factor);
    const ndvi   = 0.12 + veg * 0.8;
    const oceanPH = n('H2O', v.H2O) > 0.1
      ? Math.max(5.8, 8.15 - co2sat * 2.0 - toxic * 0.7)
      : pH;
    const carbonSeq = gpp * veg * 16;
    const shannon = (0.8 + veg * 2.0 + balance * 0.7).toFixed(2);
    const species = Math.round(20 + veg * 200 + fauna * 80);
    const biomass = clamp01(veg * 0.6 + gpp * 0.4);
    const tempAnomaly = Math.max(0, (temp - 15) * 0.3 + co2sat * 3).toFixed(1);
    const sustainability = clamp01((stab * 0.5 + biomass * 0.25 + (1 - toxic) * 0.15 + waterFactor * 0.1) * (0.25 + 0.75 * viability));
    const tippingRisk = clamp01(toxic * 0.45 + co2sat * 0.9 + (1 - waterFactor) * 0.35 + (1 - viability) * 0.3 + (1 - tempFactor) * 0.3);

    const cycles = {
      carbon:   clamp01(gpp * 0.6 + co2sat * 0.4),
      nitrogen: clamp01(satP * 0.5 + veg * 0.5),
      water:    clamp01(waterFactor * 0.7 + veg * 0.3),
      phosph:   clamp01(satP * 0.8 + veg * 0.2),
      sulfur:   clamp01(satS * 0.6 + (1 - toxic) * 0.4),
    };

    return { v, limiting, limitingName, balance, gpp, veg, fauna, stab,
      chlorophyll, ndvi, oceanPH, carbonSeq, shannon, species, biomass,
      tempAnomaly, sustainability, tippingRisk,
      waterFactor, tempFactor, o2Factor, pHFactor, co2Factor, toxFactor, sFactor, cycles };
  }

  /* --------------------------- COLOR HELPERS ----------------------------- */
  function health(x){ if(x>=0.66)return'#4ADE80'; if(x>=0.45)return'#F5A623'; if(x>=0.28)return'#F87171'; return'#DC2626'; }
  function pct(x){ return Math.round(x*100); }

  /* ------------------------------ TEMPLATE ------------------------------- */
  function template() {
    return `
<div class="pe-root scroll" style="height:100%;overflow-y:auto;padding:18px 20px 40px;background:radial-gradient(ellipse 90% 60% at 50% 0%,#081420 0%,var(--bg) 70%);">
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:25px;font-weight:700;letter-spacing:6px;color:var(--text);text-shadow:0 0 30px rgba(0,212,170,0.25);">PLANET EARTH</div>
    <div style="font-size:10px;letter-spacing:4px;color:var(--muted);text-transform:uppercase;margin-top:3px;">Ecosistema Global · Reacciona a los minerales del planeta en vivo</div>
  </div>
  <div class="pe-grid" style="display:grid;grid-template-columns:280px 1fr 300px;gap:16px;align-items:start;max-width:1400px;margin:0 auto;">
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="card" style="border-color:rgba(0,212,170,0.18);">
        <div class="label" style="color:var(--teal);">⬡ Entrada Mineral (vals)</div>
        <div style="font-size:9px;color:var(--muted);margin:-4px 0 10px;">Ajusta en la pestaña Planeta / Minerales</div>
        <div id="pe-inputs" style="display:flex;flex-direction:column;gap:7px;"></div>
        <div style="display:flex;gap:7px;margin-top:12px;">
          <button class="btn btn-teal" id="pe-opt" style="flex:1;font-size:11px;">Preset Tierra</button>
          <button class="btn" id="pe-goto" style="flex:1;font-size:11px;">Editar →</button>
        </div>
      </div>
      <div class="card">
        <div class="label">◐ Integridad Biosférica</div>
        <div style="display:flex;gap:14px;align-items:center;">
          <svg id="pe-biodonut" width="92" height="92" viewBox="0 0 92 92"></svg>
          <div style="flex:1;font-size:11px;line-height:1.7;">
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--muted);">Diversidad H′</span><b id="pe-shannon" style="font-family:'JetBrains Mono'">—</b></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--muted);">Especies</span><b id="pe-species" style="font-family:'JetBrains Mono'">—</b></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--muted);">Pérdida hábitat</span><b id="pe-habitat" style="font-family:'JetBrains Mono'">—</b></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--muted);">Clorofila</span><b id="pe-chloro" style="font-family:'JetBrains Mono'">—</b></div>
          </div>
        </div>
        <div class="label" style="margin-top:14px;">⌬ Cascada Trófica</div>
        <div id="pe-trophic" style="display:flex;flex-direction:column;gap:7px;"></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="card" style="padding:0;overflow:hidden;position:relative;">
        <div style="position:absolute;top:12px;left:14px;z-index:3;">
          <div class="label" style="margin:0;color:var(--teal);">◉ Biosfera Terrestre</div>
          <div id="pe-temp" style="font-size:9px;color:var(--muted);font-family:'JetBrains Mono';"></div>
        </div>
        <div style="position:absolute;top:12px;right:14px;z-index:3;text-align:right;">
          <div id="pe-co2-read" style="font-family:'JetBrains Mono';font-size:18px;font-weight:700;color:var(--amber);"></div>
          <div style="font-size:8px;color:var(--muted);letter-spacing:1px;">CO₂ ATMOSFÉRICO</div>
        </div>
        <div style="aspect-ratio:1/1;width:100%;background:radial-gradient(circle at 50% 50%,#040810 0%,#020509 100%);">
          <svg id="pe-earth" viewBox="0 0 460 460" style="width:100%;height:100%;display:block;"></svg>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);">
          ${['Estabilidad','Biomasa','Sostenibilidad','Riesgo Tipping'].map((l,i)=>`
            <div style="background:var(--bg2);padding:9px 8px;text-align:center;">
              <div id="pe-bigkpi-${i}" style="font-family:'JetBrains Mono';font-size:16px;font-weight:700;">—</div>
              <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-top:2px;">${l}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="label">◎ Indicadores de Salud del Sistema</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          ${['Estabilidad','Estab. Climática','Resiliencia'].map((l,i)=>`
            <div style="display:flex;flex-direction:column;align-items:center;">
              <svg id="pe-gauge-${i}" width="110" height="68" viewBox="0 0 110 68"></svg>
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;margin-top:-4px;">${l}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="card" style="border-color:rgba(96,165,250,0.18);">
        <div class="label" style="color:var(--blue);">☁ Clima & Atmósfera</div>
        <div style="display:flex;flex-direction:column;gap:9px;">
          <div class="pe-flowrow" data-k="oceanPH"></div>
          <div class="pe-flowrow" data-k="carbonSeq"></div>
          <div class="pe-flowrow" data-k="tempAnom"></div>
          <div class="pe-flowrow" data-k="o2"></div>
        </div>
      </div>
      <div class="card">
        <div class="label">♺ Ciclos Biogeoquímicos</div>
        <div id="pe-cycles" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>
      <div class="card" style="border-color:rgba(96,165,250,0.14);">
        <div class="label" style="color:var(--blue);">💧 Ciclo Global del Agua</div>
        <div id="pe-water" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>
      <div class="card" style="border-color:rgba(245,166,35,0.18);">
        <div class="label" style="color:var(--amber);">⚠ Puntos de Inflexión & Alertas</div>
        <div id="pe-alerts" style="display:flex;flex-direction:column;gap:7px;"></div>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin-top:22px;font-size:9px;color:var(--dim);font-family:'JetBrains Mono';letter-spacing:1px;">
    BIOPLANET · Liebig + Michaelis–Menten + Lindeman + ventana de habitabilidad (Temp · pH · O₂ · H₂O)
  </div>
</div>`;
  }

  const SHOWN = [
    ['P','K ppm'], ['Fe','K ppm'], ['Mg','K ppm'], ['Ca','K ppm'],
    ['S','ppm'], ['H2S','%'], ['H2O','%'], ['CO2','%'], ['O2','%'], ['Temp','°C'], ['pH',''],
  ];
  function renderInputs(root) {
    const v = readVals();
    root.querySelector('#pe-inputs').innerHTML = SHOWN.map(([sym,unit])=>{
      const raw = v[sym];
      const val = (typeof raw==='number') ? (raw<1 && raw!==0 ? raw.toFixed(2) : Math.round(raw)) : '—';
      const norm = SCALE[sym] ? clamp01((raw||0)/SCALE[sym]) : 0.5;
      return `<div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:10.5px;width:40px;"><b style="font-family:'JetBrains Mono';color:var(--teal);">${sym}</b></span>
        <span style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;"><i style="display:block;height:100%;width:${pct(norm)}%;background:var(--teal);opacity:.7;border-radius:3px;transition:width .3s;"></i></span>
        <span style="font-family:'JetBrains Mono';font-size:10px;width:62px;text-align:right;color:var(--muted);">${val} ${unit}</span>
      </div>`;
    }).join('');
  }

  function buildEarth(root) {
    const svg = root.querySelector('#pe-earth');
    svg.innerHTML = `
      <defs>
        <radialGradient id="peOcean" cx="38%" cy="35%" r="75%"><stop offset="0%" stop-color="#1a5a8a"/><stop offset="60%" stop-color="#0d3a5e"/><stop offset="100%" stop-color="#061f33"/></radialGradient>
        <radialGradient id="peAtm" cx="50%" cy="50%" r="50%"><stop offset="78%" stop-color="rgba(0,212,170,0)"/><stop offset="92%" stop-color="rgba(0,212,170,0.25)"/><stop offset="100%" stop-color="rgba(0,212,170,0)"/></radialGradient>
        <filter id="peGlow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <clipPath id="peClip"><circle cx="230" cy="230" r="150"/></clipPath>
      </defs>
      <circle cx="230" cy="230" r="178" fill="url(#peAtm)"/>
      <circle cx="230" cy="230" r="150" fill="url(#peOcean)"/>
      <g clip-path="url(#peClip)" id="pe-continents"></g>
      <circle cx="230" cy="230" r="150" fill="none" stroke="rgba(0,212,170,0.35)" stroke-width="1"/>
      <ellipse cx="230" cy="230" rx="150" ry="46" fill="none" stroke="rgba(0,212,170,0.18)" stroke-width="0.8" stroke-dasharray="3 4"/>
      <g id="pe-orbits"></g>`;
    const conts = [
      "M150,150 q40,-25 80,-10 q30,15 20,45 q-15,30 -55,28 q-45,-3 -55,-30 q-8,-22 10,-33 Z",
      "M250,250 q35,-8 50,18 q12,30 -10,52 q-28,22 -55,5 q-20,-18 -8,-45 q10,-25 23,-30 Z",
      "M120,250 q25,-10 38,12 q8,25 -12,40 q-25,15 -40,-8 q-10,-28 14,-44 Z",
      "M270,140 q30,-6 38,16 q5,22 -18,30 q-28,6 -34,-18 q-3,-20 14,-28 Z",
    ];
    root.querySelector('#pe-continents').innerHTML = conts.map((d,i)=>`<path id="pe-cont-${i}" d="${d}" fill="#1f6b2e" opacity="0.9"/>`).join('') +
      `<circle cx="230" cy="230" r="150" fill="#000" opacity="0" id="pe-oceanover"/>`;
  }
  function renderEarth(root, r) {
    for (let i=0;i<4;i++){
      const local = clamp01(r.veg + (i-1.5)*0.08);
      const el = root.querySelector('#pe-cont-'+i);
      if (el){ el.setAttribute('fill', health(local)); el.setAttribute('opacity', (0.55+local*0.4).toFixed(2)); }
    }
    const acid = clamp01((8.2 - r.oceanPH)/2.4);
    const ov = root.querySelector('#pe-oceanover');
    ov.setAttribute('opacity', (acid*0.4).toFixed(2));
    ov.setAttribute('fill', `rgb(${Math.round(120+acid*100)},${Math.round(90-acid*40)},40)`);
    const n2 = Math.round(3 + r.fauna*9); let dots='';
    for (let i=0;i<n2;i++){
      const a=(i/n2)*Math.PI*2, rad=150*(0.55+0.4*((i*7)%5)/5);
      const x=230+Math.cos(a)*rad, y=230+Math.sin(a)*rad*0.92;
      dots+=`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="2.6" fill="#A8E82C" filter="url(#peGlow)"/>`;
    }
    root.querySelector('#pe-orbits').innerHTML = dots;
  }

  function renderBioDonut(root, r) {
    const svg = root.querySelector('#pe-biodonut');
    const segs = [['Bosque',r.veg,'#4ADE80'],['Océano',r.waterFactor,'#60A5FA'],['Fauna',r.fauna,'#A8E82C'],['Clorofila',r.chlorophyll,'#00D4AA']];
    const total = segs.reduce((a,s)=>a+s[1],0)||1;
    let off=0, cx=46, cy=46, rad=34, parts='';
    segs.forEach(s=>{
      const frac=s[1]/total, ang=frac*Math.PI*2;
      const x1=cx+rad*Math.cos(off-Math.PI/2), y1=cy+rad*Math.sin(off-Math.PI/2);
      const x2=cx+rad*Math.cos(off+ang-Math.PI/2), y2=cy+rad*Math.sin(off+ang-Math.PI/2);
      const large=ang>Math.PI?1:0;
      parts+=`<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${rad},${rad} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${s[2]}" opacity="0.85"/>`;
      off+=ang;
    });
    svg.innerHTML = parts + `<circle cx="${cx}" cy="${cy}" r="18" fill="var(--bg2)"/><text x="${cx}" y="${cy+4}" text-anchor="middle" font-family="JetBrains Mono" font-size="13" font-weight="700" fill="${health(r.stab)}">${pct(r.stab)}</text>`;
  }

  function renderGauge(root, idx, vv) {
    const svg = root.querySelector('#pe-gauge-'+idx);
    const col = health(vv);
    const a0=Math.PI, a1=0, ang=a0+(a1-a0)*vv, cx=55, cy=58, rad=42;
    const nx=cx+rad*Math.cos(ang), ny=cy+rad*Math.sin(ang);
    const segCols=['#DC2626','#F87171','#F5A623','#4ADE80']; let bg='';
    for(let i=0;i<4;i++){
      const s=a0+(a1-a0)*(i/4), e=a0+(a1-a0)*((i+1)/4);
      const sx=cx+rad*Math.cos(s),sy=cy+rad*Math.sin(s),ex=cx+rad*Math.cos(e),ey=cy+rad*Math.sin(e);
      bg+=`<path d="M${sx.toFixed(1)},${sy.toFixed(1)} A${rad},${rad} 0 0 1 ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${segCols[i]}" stroke-width="6" opacity="0.4" stroke-linecap="round"/>`;
    }
    svg.innerHTML = bg + `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${col}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="${col}"/><text x="${cx}" y="${cy-10}" text-anchor="middle" font-family="JetBrains Mono" font-size="13" font-weight="700" fill="${col}">${pct(vv)}</text>`;
  }

  function flowRow(name, val, color, extra) {
    return `<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:10px;width:88px;color:var(--text);">${name}</span><span style="flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;"><i style="display:block;height:100%;width:${pct(val)}%;background:${color};border-radius:4px;transition:width .35s;"></i></span><span style="font-family:'JetBrains Mono';font-size:10px;width:48px;text-align:right;color:var(--muted);">${extra}</span></div>`;
  }

  function render(root) {
    if (!root || !root.querySelector('#pe-earth')) return;
    const r = model();
    renderInputs(root);
    renderEarth(root, r);
    root.querySelector('#pe-co2-read').textContent = (r.v.CO2<1?(+r.v.CO2).toFixed(2):(+r.v.CO2).toFixed(1)) + ' %';
    root.querySelector('#pe-temp').textContent = r.v.Temp + '°C · anomalía +' + r.tempAnomaly + '°C · NDVI ' + r.ndvi.toFixed(2);
    const bigs=[r.stab,r.biomass,r.sustainability,r.tippingRisk];
    bigs.forEach((val,i)=>{ const el=root.querySelector('#pe-bigkpi-'+i); const inv=i===3; el.textContent=pct(val)+'%'; el.style.color=inv?health(1-val):health(val); });
    renderBioDonut(root, r);
    root.querySelector('#pe-shannon').textContent = r.shannon;
    root.querySelector('#pe-species').textContent = r.species;
    root.querySelector('#pe-habitat').textContent = pct(1-r.veg)+'%';
    root.querySelector('#pe-chloro').textContent = pct(r.chlorophyll)+'%';
    const troph=[['Productores',r.gpp],['Biomasa vegetal',r.veg],['Herbívoros + Apex',r.fauna]];
    root.querySelector('#pe-trophic').innerHTML = troph.map(t=>flowRow(t[0],t[1],health(t[1]),pct(t[1])+'%')).join('');
    renderGauge(root,0,r.stab);
    renderGauge(root,1,clamp01(1-(+r.tempAnomaly)/5));
    renderGauge(root,2,r.sustainability);
    root.querySelectorAll('.pe-flowrow').forEach(el=>{
      const k=el.dataset.k;
      if(k==='oceanPH'){ const x=clamp01((r.oceanPH-6)/2.2); el.innerHTML=flowRow('pH oceánico',x,x>0.6?'#60A5FA':'#F87171',r.oceanPH.toFixed(2)); }
      if(k==='carbonSeq'){ const x=clamp01(r.carbonSeq/16); el.innerHTML=flowRow('Captura CO₂',x,'#4ADE80',r.carbonSeq.toFixed(1)); }
      if(k==='tempAnom'){ const x=clamp01(1-(+r.tempAnomaly)/5); el.innerHTML=flowRow('Estab. clima',x,health(x),'+'+r.tempAnomaly+'°'); }
      if(k==='o2'){ const x=clamp01(r.v.O2/35); el.innerHTML=flowRow('Oxígeno',x,'#00D4AA',r.v.O2+'%'); }
    });
    const cyc=[['Carbono',r.cycles.carbon,'#4ADE80'],['Nitrógeno',r.cycles.nitrogen,'#60A5FA'],['Agua',r.cycles.water,'#22D3EE'],['Fósforo',r.cycles.phosph,'#A78BFA'],['Azufre',r.cycles.sulfur,'#F5A623']];
    root.querySelector('#pe-cycles').innerHTML = cyc.map(c=>flowRow(c[0],c[1],c[2],pct(c[1])+'%')).join('');
    const w=[['Disponibilidad',r.waterFactor,'#60A5FA'],['Salud ríos',clamp01(r.waterFactor*r.veg+0.1),'#22D3EE'],['Hielo/glaciares',clamp01(1-(+r.tempAnomaly)/5),'#A8D4FF']];
    root.querySelector('#pe-water').innerHTML = w.map(x=>flowRow(x[0],x[1],x[2],pct(x[1])+'%')).join('');
    renderAlerts(root, r);
  }

  function renderAlerts(root, r) {
    const A=[];
    const ico=c=>({crit:'⛔',warn:'⚠',ok:'✓',info:'ℹ'}[c]);
    const col=c=>({crit:'var(--red)',warn:'var(--amber)',ok:'var(--green)',info:'var(--blue)'}[c]);
    if(r.tippingRisk>0.6) A.push(['crit','Punto de inflexión inminente — colapso sistémico']);
    else if(r.tippingRisk>0.4) A.push(['warn','Riesgo de inflexión elevado']);
    if(r.toxFactor<0.6) A.push(['crit','Toxicidad por H₂S — vida suprimida']);
    if(r.tempFactor<0.3) A.push(['crit','Temperatura fuera del rango habitable']);
    if(r.o2Factor<0.4) A.push(['warn','Oxígeno insuficiente para vida compleja']);
    if(r.pHFactor<0.6) A.push(['warn','pH extremo — química biológica comprometida']);
    if(r.limiting<0.3) A.push(['crit','Nutriente limitante: '+r.limitingName+' crítico']);
    else if(r.limiting<0.5) A.push(['warn',r.limitingName+' limita la producción']);
    if(r.oceanPH<7.7 && r.waterFactor>0.2) A.push(['warn','Acidificación oceánica (pH '+r.oceanPH.toFixed(2)+')']);
    if(r.waterFactor<0.4) A.push(['warn','Estrés hídrico — agua fuera de óptimo']);
    if(r.stab>=0.66 && A.length===0) A.push(['ok','Biosfera estable y resiliente']);
    if(A.length===0) A.push(['info','Sistema funcional · margen de mejora']);
    root.querySelector('#pe-alerts').innerHTML = A.slice(0,6).map(a=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;background:var(--bg3);border-left:3px solid ${col(a[0])};font-size:10.5px;color:${col(a[0])};"><span style="font-size:13px;">${ico(a[0])}</span><span style="color:var(--text);">${a[1]}</span></div>`).join('');
  }

  let _root=null, _timer=null;
  function renderPlanetEarth(container) {
    if (!container) { console.error('[PlanetEarth] container requerido'); return; }
    _root = container;
    container.innerHTML = template();
    buildEarth(container);
    render(container);
    const opt = container.querySelector('#pe-opt');
    if (opt) opt.onclick = () => { if (typeof global.applyPreset==='function'){ global.applyPreset('Tierra'); render(container);} };
    const goto = container.querySelector('#pe-goto');
    if (goto) goto.onclick = () => { if (typeof global.switchTab==='function') global.switchTab('minerals'); };
    if (_timer) clearInterval(_timer);
    _timer = setInterval(() => {
      if (document.body.contains(container) && container.querySelector('#pe-earth')) render(container);
      else { clearInterval(_timer); _timer=null; }
    }, 600);
    return { model };
  }
  function refreshPlanetEarth(){ if(_root) render(_root); }

  global.renderPlanetEarth  = renderPlanetEarth;
  global.refreshPlanetEarth = refreshPlanetEarth;
  global.PlanetEarthModel   = { model, readVals };

})(typeof window !== 'undefined' ? window : globalThis);
