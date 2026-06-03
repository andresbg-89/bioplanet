/* ============================================================================
   BIOPLANET · VISTA "PLANET EARTH"  (v3 — INFOGRAFÍA DENSA)
   ----------------------------------------------------------------------------
   Replica el estilo de infográfico global: gráficas de líneas con series
   temporales, diagrama de presupuesto energético solar, ilustraciones de los
   ciclos del carbono y nitrógeno (islas + flechas), recuadros enmarcados.
   Todo reacciona al objeto global `vals` de la app (símbolos Ca,Fe,P,Mg,S,
   H2S,H2O,CO2,O2,Temp,pH...).

   Integración (ya aplicada en index.html + app.js):
     <script src="planet-earth.js" defer></script>  (antes de app.js)
     renderMain():  else if(currentTab==='planetearth') renderPlanetEarth(el);
     buildTabBtns(): 'planetearth' en tabIds + etiqueta en t('tabs').

   Modelo: Liebig + Michaelis–Menten + Lindeman + ventana de habitabilidad.
   ============================================================================ */
(function (global) {
  'use strict';

  const SCALE = { Ca:100, Fe:100, Si:350, P:5, Mg:60, Cu:300, S:25000, Ni:500, V:1000,
                  O2:35, CO2:20, H2S:10, H2O:100, Temp:200, pH:14, gravity:5 };
  const KM = { Ca:18, Fe:22, P:0.45, Mg:14, S:4000 };

  function nrm(sym, v){ const s=SCALE[sym]||1; return Math.max(0,Math.min(1,(v||0)/s)); }
  function mm(c,k){ return c/(k+c); }
  function clamp01(v){ return Math.max(0,Math.min(1,v)); }
  function pct(x){ return Math.round(x*100); }

  function readVals(){
    if (global.vals && typeof global.vals==='object' && global.vals.H2O!=null) return global.vals;
    return { Ca:41,Fe:56,Si:282,P:1.0,Mg:23,Cu:60,S:350,Ni:84,V:120,
             O2:21,CO2:0.04,H2S:0,H2O:71,Temp:15,pH:7.2,gravity:1.0 };
  }

  /* ------------------------------- MODELO -------------------------------- */
  function model(){
    const v = readVals();
    const satP=mm(v.P,KM.P), satFe=mm(v.Fe,KM.Fe), satMg=mm(v.Mg,KM.Mg), satCa=mm(v.Ca,KM.Ca), satS=mm(v.S,KM.S);
    const photo=[satP,satFe,satMg], names=['Fósforo','Hierro','Magnesio'];
    const limiting=Math.min(...photo), limitingName=names[photo.indexOf(limiting)];
    const mean=photo.reduce((a,b)=>a+b,0)/photo.length;
    const variance=photo.reduce((a,x)=>a+(x-mean)*(x-mean),0)/photo.length;
    const balance=Math.max(0,1-Math.sqrt(variance)*1.6);

    const waterFactor=clamp01(1-Math.pow((nrm('H2O',v.H2O)-0.72)/0.55,2));
    const temp=v.Temp; let tempFactor;
    if(temp>=5&&temp<=35)tempFactor=1; else if(temp>=-20&&temp<=50)tempFactor=0.55;
    else if(temp>=-60&&temp<=80)tempFactor=0.2; else tempFactor=0.04;
    const o2=v.O2, o2Factor=o2>=15?1:o2>=5?0.6:(v.CO2>=1||v.H2S>=1)?0.3:0.12;
    const pH=v.pH, pHFactor=(pH>=5.5&&pH<=9)?1:(pH>=3&&pH<=11)?0.5:0.15;
    const co2pct=v.CO2, co2sat=clamp01(co2pct/5), co2Factor=clamp01(1-Math.max(0,co2pct-1)*0.18);
    const toxic=clamp01(v.H2S/6), toxFactor=clamp01(1-toxic*1.1);
    const sFactor=clamp01(0.75+0.5*satS-0.6*Math.max(0,satS-0.7));

    let gpp=(limiting*0.7+mean*0.3)*(0.55+0.45*balance);
    gpp*=(0.45+0.55*waterFactor)*tempFactor*o2Factor*pHFactor*toxFactor*sFactor*co2Factor;
    gpp=clamp01(gpp);
    const veg=clamp01(gpp*0.72+satCa*0.28*waterFactor);
    const fauna=Math.pow(veg,0.85)*(0.6+0.4*satCa)*toxFactor*o2Factor;
    const floor=Math.min(satP,satFe,satMg,waterFactor,tempFactor,pHFactor);
    const viability=clamp01(gpp*1.4);
    const stab=clamp01((balance*0.4+floor*0.25+gpp*0.2+waterFactor*0.15)*(0.3+0.7*viability)*toxFactor);

    const chlorophyll=clamp01(satFe*0.35+satMg*0.35+satP*0.2+0.1*o2Factor);
    const ndvi=0.12+veg*0.8;
    const oceanPH=nrm('H2O',v.H2O)>0.1?Math.max(5.8,8.15-co2sat*2.0-toxic*0.7):pH;
    const carbonSeq=gpp*veg*16;
    const shannon=(0.8+veg*2.0+balance*0.7).toFixed(2);
    const species=Math.round(20+veg*200+fauna*80);
    const biomass=clamp01(veg*0.6+gpp*0.4);
    const tempAnomaly=Math.max(0,(temp-15)*0.3+co2sat*3);
    const sustainability=clamp01((stab*0.5+biomass*0.25+(1-toxic)*0.15+waterFactor*0.1)*(0.25+0.75*viability));
    const tippingRisk=clamp01(toxic*0.45+co2sat*0.9+(1-waterFactor)*0.35+(1-viability)*0.3+(1-tempFactor)*0.3);
    const extremeWeather=clamp01(co2sat*0.7+tempAnomaly/8+(1-waterFactor)*0.3);
    const freshwater=clamp01(waterFactor*0.8+(1-co2sat)*0.2);
    const glacier=clamp01(1-tempAnomaly/6);

    const cycles={ carbon:clamp01(gpp*0.6+co2sat*0.4), nitrogen:clamp01(satP*0.5+veg*0.5),
      water:clamp01(waterFactor*0.7+veg*0.3), phosph:clamp01(satP*0.8+veg*0.2), sulfur:clamp01(satS*0.6+(1-toxic)*0.4) };

    return { v,limiting,limitingName,balance,gpp,veg,fauna,stab,chlorophyll,ndvi,oceanPH,
      carbonSeq,shannon,species,biomass,tempAnomaly,sustainability,tippingRisk,extremeWeather,
      freshwater,glacier,waterFactor,tempFactor,o2Factor,pHFactor,co2Factor,toxFactor,sFactor,cycles };
  }

  /* --------------------------- COLOR HELPERS ----------------------------- */
  function health(x){ if(x>=0.66)return'#4ADE80'; if(x>=0.45)return'#F5A623'; if(x>=0.28)return'#F87171'; return'#DC2626'; }

  /* ---- generador de series temporales que TERMINAN en el valor actual ---- */
  function series(end, vol, trend, n){
    n=n||30; const pts=[]; let val=clamp01(end-trend*0.6+ (Math.random()*0+0));
    // construimos hacia atrás para que el último punto sea exactamente `end`
    for(let i=0;i<n;i++){
      const t=i/(n-1);
      const base=clamp01((end-trend*0.6)*(1-t)+end*t);          // tendencia lineal
      const wobble=Math.sin(i*0.9+end*7)*vol + Math.sin(i*2.3+end*3)*vol*0.4;
      pts.push(clamp01(base+wobble));
    }
    pts[n-1]=clamp01(end);                                       // anclar al valor real
    return pts;
  }
  /* dibuja un sparkline/area como path SVG dentro de un viewBox 100x34 */
  function linePath(pts, h){ h=h||34; const n=pts.length;
    return pts.map((p,i)=>`${(i*(100/(n-1))).toFixed(1)},${((1-p)*(h-3)+1.5).toFixed(1)}`).join(' ');
  }

  /* ------------------------------ TEMPLATE ------------------------------- */
  function template(){
    return `
<div class="pe-root scroll" style="height:100%;overflow-y:auto;padding:0;background:
     radial-gradient(ellipse 70% 50% at 18% 12%,rgba(96,165,250,0.06) 0%,transparent 55%),
     radial-gradient(ellipse 60% 50% at 88% 90%,rgba(167,139,250,0.06) 0%,transparent 55%),
     radial-gradient(ellipse 90% 70% at 50% 0%,#0a1828 0%,var(--bg) 65%);position:relative;">

  <!-- textura de fondo: hélices ADN + células difusas (como la imagen) -->
  <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0.5;z-index:0;" preserveAspectRatio="none">
    <defs>
      <radialGradient id="peCell" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(96,165,250,0.10)"/><stop offset="70%" stop-color="rgba(96,165,250,0.02)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
    </defs>
    <circle cx="6%" cy="22%" r="60" fill="url(#peCell)"/><circle cx="4%" cy="60%" r="42" fill="url(#peCell)"/>
    <circle cx="95%" cy="30%" r="55" fill="url(#peCell)"/><circle cx="92%" cy="78%" r="48" fill="url(#peCell)"/>
    <g stroke="rgba(0,212,170,0.10)" stroke-width="1" fill="none" id="pe-dna-left"></g>
    <g stroke="rgba(0,212,170,0.10)" stroke-width="1" fill="none" id="pe-dna-right"></g>
  </svg>

  <div style="position:relative;z-index:1;padding:16px 18px 40px;">
    <!-- título -->
    <div style="text-align:center;margin-bottom:14px;">
      <div style="font-family:'JetBrains Mono';font-size:24px;font-weight:700;letter-spacing:8px;color:#dfeaff;text-shadow:0 0 26px rgba(96,165,250,0.4);">PLANET EARTH</div>
      <div style="font-size:9px;letter-spacing:5px;color:var(--muted);text-transform:uppercase;margin-top:2px;">Ecosistema Global Completo e Interconectado · Modelo Mineral en Vivo</div>
    </div>

    <!-- ===== FILA SUPERIOR: 3 columnas como la imagen ===== -->
    <div class="pe-cols" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:start;">

      <!-- IZQUIERDA: integridad biosférica -->
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${frame('BIOSPHERIC INTEGRITY','#4ADE80',`
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
            <svg id="pe-biodonut" width="84" height="84" viewBox="0 0 84 84"></svg>
            <div style="flex:1;">
              <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;">Species Diversity Index</div>
              <div id="pe-divbars" style="display:flex;flex-direction:column;gap:4px;"></div>
            </div>
          </div>
          <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin:8px 0 4px;">Habitat Loss Rate</div>
          <svg id="pe-habitat-chart" viewBox="0 0 100 34" style="width:100%;height:34px;"></svg>
          <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin:8px 0 4px;">Trophic Cascade</div>
          <div id="pe-trophic" style="display:flex;align-items:flex-end;justify-content:space-between;gap:3px;height:46px;"></div>
        `)}
      </div>

      <!-- CENTRO: la Tierra + métricas grandes -->
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="position:relative;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:radial-gradient(circle at 50% 45%,#06101e 0%,#020509 100%);">
          <div style="aspect-ratio:1/0.92;width:100%;">
            <svg id="pe-earth" viewBox="0 0 420 380" style="width:100%;height:100%;display:block;"></svg>
          </div>
          <div style="position:absolute;top:10px;left:12px;font-family:'JetBrains Mono';font-size:8px;color:rgba(0,212,170,0.7);line-height:1.7;">
            <div id="pe-hud-temp">TEMP —</div><div id="pe-hud-ndvi">NDVI —</div><div id="pe-hud-ph">OCEAN pH —</div>
          </div>
          <div style="position:absolute;top:10px;right:12px;text-align:right;">
            <div id="pe-co2-read" style="font-family:'JetBrains Mono';font-size:17px;font-weight:700;color:var(--amber);">—</div>
            <div style="font-size:7px;color:var(--muted);letter-spacing:1px;">ATMOSPHERIC CO₂</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">
          ${['Stability','Biomass','Sustain.','Tipping'].map((l,i)=>`
            <div style="background:var(--bg2);border:0.5px solid var(--border);border-radius:8px;padding:7px 4px;text-align:center;">
              <div id="pe-big-${i}" style="font-family:'JetBrains Mono';font-size:15px;font-weight:700;">—</div>
              <div style="font-size:7px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-top:1px;">${l}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- DERECHA: clima & atmósfera -->
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${frame('CLIMATE &amp; ATMOSPHERE','#60A5FA',`
          <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Global Energy Budget</div>
          <svg id="pe-energy" viewBox="0 0 200 78" style="width:100%;height:78px;margin-bottom:8px;"></svg>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="flex:1;">
              <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;">Ocean Acidification (pH)</div>
              <div id="pe-ph-pill" style="margin-top:3px;font-family:'JetBrains Mono';font-size:16px;font-weight:700;text-align:center;border:1px solid var(--border);border-radius:6px;padding:4px;">—</div>
            </div>
          </div>
          <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin:4px 0;">Carbon Sequestration</div>
          <svg id="pe-carbon-chart" viewBox="0 0 100 34" style="width:100%;height:34px;"></svg>
        `)}
      </div>
    </div>

    <!-- ===== FILA MEDIA: temperatura global + biomasa (gráficas grandes) ===== -->
    <div class="pe-cols2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
      ${frame('GLOBAL AVERAGE TEMPERATURE','#F87171',`
        <svg id="pe-temp-chart" viewBox="0 0 100 60" style="width:100%;height:80px;"></svg>
        <div style="display:flex;justify-content:space-between;font-size:8px;color:var(--muted);font-family:'JetBrains Mono';margin-top:2px;"><span>1900</span><span id="pe-temp-now">—</span><span>2030</span></div>
      `)}
      ${frame('TOTAL BIOMASS TREND','#4ADE80',`
        <svg id="pe-biomass-chart" viewBox="0 0 100 60" style="width:100%;height:80px;"></svg>
        <div style="display:flex;justify-content:space-between;font-size:8px;color:var(--muted);font-family:'JetBrains Mono';margin-top:2px;"><span>1900</span><span id="pe-biomass-now">—</span><span>2030</span></div>
      `)}
    </div>

    <!-- ===== FILA INFERIOR: ciclos (carbono / nitrógeno) + agua ===== -->
    <div class="pe-cols3" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px;">
      ${frame('CARBON CYCLE','#4ADE80',`<svg id="pe-carbon-cycle" viewBox="0 0 220 150" style="width:100%;height:150px;"></svg>`)}
      ${frame('NITROGEN CYCLE','#60A5FA',`<svg id="pe-nitrogen-cycle" viewBox="0 0 220 150" style="width:100%;height:150px;"></svg>`)}
      ${frame('GLOBAL WATER CYCLE','#22D3EE',`
        <div id="pe-water" style="display:flex;flex-direction:column;gap:9px;"></div>
        <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin:8px 0 4px;">Extreme Weather Frequency</div>
        <svg id="pe-weather-chart" viewBox="0 0 100 30" style="width:100%;height:30px;"></svg>
      `)}
    </div>

    <!-- ===== INDICADORES DE SALUD (gauges) + ALERTAS ===== -->
    <div class="pe-cols4" style="display:grid;grid-template-columns:1.4fr 1fr;gap:12px;margin-top:12px;">
      ${frame('SYSTEM HEALTH INDICATORS','#A78BFA',`
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          ${['Earth Stability','Rate of Change','Resilience'].map((l,i)=>`
            <div style="display:flex;flex-direction:column;align-items:center;">
              <svg id="pe-gauge-${i}" width="100" height="62" viewBox="0 0 100 62"></svg>
              <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;text-align:center;margin-top:-2px;">${l}</div>
            </div>`).join('')}
        </div>
      `)}
      ${frame('TIPPING POINTS &amp; ALERTS','#F5A623',`<div id="pe-alerts" style="display:flex;flex-direction:column;gap:6px;"></div>`)}
    </div>

    <!-- entrada mineral compacta abajo -->
    ${frame('MINERAL INPUT (vals)','#00D4AA',`
      <div id="pe-inputs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px 16px;"></div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn btn-teal" id="pe-opt" style="font-size:11px;">Preset Tierra</button>
        <button class="btn" id="pe-goto" style="font-size:11px;">Editar minerales →</button>
      </div>
    `)}

    <div style="text-align:center;margin-top:16px;font-size:8px;color:var(--dim);font-family:'JetBrains Mono';letter-spacing:1px;">
      BIOPLANET · Liebig + Michaelis–Menten + Lindeman + ventana de habitabilidad · las series temporales convergen al estado actual de los minerales
    </div>
  </div>
</div>`;
  }

  /* recuadro enmarcado con título tipo infografía */
  function frame(title, color, inner){
    return `<div style="background:linear-gradient(180deg,rgba(10,18,32,0.92),rgba(6,12,20,0.92));border:1px solid ${color}33;border-radius:12px;overflow:hidden;backdrop-filter:blur(2px);">
      <div style="padding:7px 12px;border-bottom:1px solid ${color}22;background:${color}11;">
        <span style="font-family:'JetBrains Mono';font-size:10px;font-weight:700;letter-spacing:1.5px;color:${color};">${title}</span>
      </div>
      <div style="padding:12px;">${inner}</div>
    </div>`;
  }

  /* ------------------------- COMPONENTES SVG ----------------------------- */
  function buildEarth(root){
    const svg=root.querySelector('#pe-earth');
    svg.innerHTML=`
      <defs>
        <radialGradient id="peO" cx="40%" cy="35%" r="72%"><stop offset="0%" stop-color="#2a7bb5"/><stop offset="55%" stop-color="#155a8a"/><stop offset="100%" stop-color="#0a2f4e"/></radialGradient>
        <radialGradient id="peA" cx="50%" cy="50%" r="50%"><stop offset="74%" stop-color="rgba(96,165,250,0)"/><stop offset="90%" stop-color="rgba(120,200,255,0.30)"/><stop offset="100%" stop-color="rgba(120,200,255,0)"/></radialGradient>
        <filter id="peG"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <clipPath id="peC"><circle cx="210" cy="190" r="135"/></clipPath>
      </defs>
      <circle cx="210" cy="190" r="160" fill="url(#peA)"/>
      <circle cx="210" cy="190" r="135" fill="url(#peO)"/>
      <g clip-path="url(#peC)" id="pe-cont"></g>
      <g clip-path="url(#peC)" id="pe-clouds" opacity="0.5"></g>
      <circle cx="210" cy="190" r="135" fill="none" stroke="rgba(120,200,255,0.4)" stroke-width="1"/>
      <ellipse cx="210" cy="190" rx="135" ry="42" fill="none" stroke="rgba(120,200,255,0.16)" stroke-width="0.7" stroke-dasharray="3 5"/>
      <ellipse cx="210" cy="190" rx="100" ry="135" fill="none" stroke="rgba(120,200,255,0.10)" stroke-width="0.7" stroke-dasharray="3 5"/>
      <g id="pe-orbits"></g>`;
    // continentes
    const conts=["M120,120 q40,-22 78,-8 q34,16 24,46 q-16,30 -58,28 q-46,-3 -56,-32 q-8,-24 12,-34 Z",
      "M230,210 q34,-8 50,16 q14,30 -10,52 q-28,22 -56,4 q-20,-18 -8,-46 q12,-24 24,-26 Z",
      "M100,210 q24,-10 38,12 q8,26 -14,40 q-26,14 -40,-10 q-9,-28 16,-42 Z",
      "M240,108 q30,-6 38,16 q5,22 -18,30 q-28,6 -34,-18 q-3,-20 14,-28 Z"];
    root.querySelector('#pe-cont').innerHTML=conts.map((d,i)=>`<path id="pe-c-${i}" d="${d}" fill="#1f6b2e"/>`).join('')+
      `<circle cx="210" cy="190" r="135" fill="#000" opacity="0" id="pe-acid"/>`;
    // nubes
    root.querySelector('#pe-clouds').innerHTML=[[150,130,28],[260,170,34],[180,240,30],[110,200,22]]
      .map(c=>`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${c[2]}" ry="${c[2]*0.45}" fill="rgba(255,255,255,0.5)"/>`).join('');
  }
  function renderEarth(root,r){
    for(let i=0;i<4;i++){ const local=clamp01(r.veg+(i-1.5)*0.08); const el=root.querySelector('#pe-c-'+i);
      if(el){ el.setAttribute('fill',health(local)); el.setAttribute('opacity',(0.6+local*0.35).toFixed(2)); } }
    const acid=clamp01((8.2-r.oceanPH)/2.4), ov=root.querySelector('#pe-acid');
    ov.setAttribute('opacity',(acid*0.4).toFixed(2));
    ov.setAttribute('fill',`rgb(${Math.round(120+acid*100)},${Math.round(90-acid*40)},40)`);
    const n2=Math.round(3+r.fauna*9); let dots='';
    for(let i=0;i<n2;i++){ const a=(i/n2)*Math.PI*2, rad=135*(0.5+0.42*((i*7)%5)/5);
      const x=210+Math.cos(a)*rad, y=190+Math.sin(a)*rad*0.9;
      dots+=`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="2.4" fill="#A8E82C" filter="url(#peG)"/>`; }
    root.querySelector('#pe-orbits').innerHTML=dots;
  }

  function areaChart(svg, pts, color, h){
    h=h||34; const line=linePath(pts,h);
    svg.innerHTML=`<polyline points="${line} 100,${h} 0,${h}" fill="${color}22" stroke="none"/>
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <circle cx="100" cy="${((1-pts[pts.length-1])*(h-3)+1.5).toFixed(1)}" r="2" fill="${color}"/>`;
  }
  function bigLineChart(svg, pts, color){
    const h=60, line=linePath(pts,h);
    // rejilla
    let grid=''; for(let g=1;g<4;g++){ const y=(g/4)*h; grid+=`<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>`; }
    svg.innerHTML=grid+`<polyline points="${line} 100,${h} 0,${h}" fill="${color}1e" stroke="none"/>
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
      <circle cx="100" cy="${((1-pts[pts.length-1])*(h-3)+1.5).toFixed(1)}" r="2.4" fill="${color}"/>`;
  }

  function renderBioDonut(root,r){
    const svg=root.querySelector('#pe-biodonut');
    const segs=[['Forest',r.veg,'#4ADE80'],['Ocean',r.waterFactor,'#60A5FA'],['Fauna',r.fauna,'#A8E82C'],['Chloro',r.chlorophyll,'#00D4AA']];
    const total=segs.reduce((a,s)=>a+s[1],0)||1; let off=0,cx=42,cy=42,rad=31,parts='';
    segs.forEach(s=>{ const ang=(s[1]/total)*Math.PI*2;
      const x1=cx+rad*Math.cos(off-Math.PI/2), y1=cy+rad*Math.sin(off-Math.PI/2);
      const x2=cx+rad*Math.cos(off+ang-Math.PI/2), y2=cy+rad*Math.sin(off+ang-Math.PI/2);
      parts+=`<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${rad},${rad} 0 ${ang>Math.PI?1:0} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${s[2]}" opacity="0.85"/>`; off+=ang; });
    svg.innerHTML=parts+`<circle cx="${cx}" cy="${cy}" r="16" fill="var(--bg2)"/><text x="${cx}" y="${cy+4}" text-anchor="middle" font-family="JetBrains Mono" font-size="12" font-weight="700" fill="${health(r.stab)}">${pct(r.stab)}</text>`;
  }

  function renderGauge(root,idx,vv){
    const svg=root.querySelector('#pe-gauge-'+idx); const col=health(vv);
    const a0=Math.PI,a1=0,ang=a0+(a1-a0)*vv,cx=50,cy=52,rad=38;
    const nx=cx+rad*Math.cos(ang),ny=cy+rad*Math.sin(ang);
    const segCols=['#DC2626','#F87171','#F5A623','#4ADE80']; let bg='';
    for(let i=0;i<4;i++){ const s=a0+(a1-a0)*(i/4),e=a0+(a1-a0)*((i+1)/4);
      const sx=cx+rad*Math.cos(s),sy=cy+rad*Math.sin(s),ex=cx+rad*Math.cos(e),ey=cy+rad*Math.sin(e);
      bg+=`<path d="M${sx.toFixed(1)},${sy.toFixed(1)} A${rad},${rad} 0 0 1 ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${segCols[i]}" stroke-width="5" opacity="0.4" stroke-linecap="round"/>`; }
    svg.innerHTML=bg+`<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${col}" stroke-width="2.2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="3.5" fill="${col}"/><text x="${cx}" y="${cy-8}" text-anchor="middle" font-family="JetBrains Mono" font-size="12" font-weight="700" fill="${col}">${pct(vv)}</text>`;
  }

  /* diagrama de presupuesto energético solar (flechas sol→tierra→espacio) */
  function renderEnergy(root,r){
    const svg=root.querySelector('#pe-energy');
    const absorbed=clamp01(r.veg*0.5+0.3), reflected=clamp01(1-absorbed-r.co2Factor*0.1+0.15), greenhouse=clamp01(r.tippingRisk*0.5+0.3);
    svg.innerHTML=`
      <circle cx="22" cy="20" r="11" fill="#F5A623" filter="url(#peG)"/>
      ${[0,1,2,3,4,5,6,7].map(i=>{const a=i*Math.PI/4;return `<line x1="${22+Math.cos(a)*13}" y1="${20+Math.sin(a)*13}" x2="${22+Math.cos(a)*17}" y2="${20+Math.sin(a)*17}" stroke="#F5A623" stroke-width="1.2"/>`;}).join('')}
      <rect x="80" y="48" width="60" height="22" rx="4" fill="#155a8a" stroke="#2a7bb5"/>
      <text x="110" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#cfe8ff">EARTH</text>
      <line x1="34" y1="24" x2="80" y2="52" stroke="#F5A623" stroke-width="${1+absorbed*2.5}" marker-end="url(#peArrow)"/>
      <text x="52" y="34" font-family="JetBrains Mono" font-size="6" fill="#F5A623">Incoming ${Math.round(absorbed*340)}W</text>
      <line x1="120" y1="48" x2="150" y2="20" stroke="#F87171" stroke-width="${1+reflected*2.5}" marker-end="url(#peArrow)"/>
      <text x="128" y="30" font-family="JetBrains Mono" font-size="6" fill="#F87171">Reflected</text>
      <line x1="110" y1="48" x2="110" y2="30" stroke="#A78BFA" stroke-width="${1+greenhouse*2.5}" marker-end="url(#peArrow)"/>
      <text x="113" y="38" font-family="JetBrains Mono" font-size="6" fill="#A78BFA">GHG ${Math.round(greenhouse*100)}%</text>
      <defs><marker id="peArrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="#888"/></marker></defs>`;
  }

  /* ciclo del carbono / nitrógeno: islas + flechas curvas (estilo imagen) */
  function renderCycle(root, id, r, opts){
    const svg=root.querySelector(id); const c=opts.color, intensity=opts.intensity;
    const aw=1+intensity*3;                            // grosor de flecha según flujo
    svg.innerHTML=`
      <defs><marker id="cyc-${opts.key}" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${c}"/></marker></defs>
      <!-- atmósfera -->
      <ellipse cx="110" cy="26" rx="60" ry="15" fill="${c}18" stroke="${c}55"/>
      <text x="110" y="29" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="${c}">${opts.top}</text>
      <!-- islas / suelo -->
      <ellipse cx="55" cy="120" rx="40" ry="16" fill="#1f5e3a" stroke="#2c7d4e"/>
      <ellipse cx="165" cy="120" rx="40" ry="16" fill="#2a5e6e" stroke="#3a7d8e"/>
      <text x="55" y="123" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#cfe8ff">${opts.left}</text>
      <text x="165" y="123" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#cfe8ff">${opts.right}</text>
      <!-- flechas curvas de flujo -->
      <path d="M70,108 C70,70 90,46 105,40" fill="none" stroke="${c}" stroke-width="${aw}" marker-end="url(#cyc-${opts.key})" opacity="0.85"/>
      <path d="M115,40 C130,46 150,70 150,108" fill="none" stroke="${c}" stroke-width="${aw}" marker-end="url(#cyc-${opts.key})" opacity="0.85"/>
      <path d="M95,124 C110,134 110,134 130,124" fill="none" stroke="${c}99" stroke-width="${aw*0.8}" marker-end="url(#cyc-${opts.key})"/>
      <text x="110" y="145" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="${c}">Flujo ${pct(intensity)}%</text>`;
  }

  const SHOWN=[['P','K ppm'],['Fe','K ppm'],['Mg','K ppm'],['Ca','K ppm'],['S','ppm'],['H2S','%'],['H2O','%'],['CO2','%'],['O2','%'],['Temp','°C'],['pH','']];
  function renderInputs(root){
    const v=readVals();
    root.querySelector('#pe-inputs').innerHTML=SHOWN.map(([sym,unit])=>{
      const raw=v[sym]; const val=(typeof raw==='number')?(raw<1&&raw!==0?raw.toFixed(2):Math.round(raw)):'—';
      const norm=SCALE[sym]?clamp01((raw||0)/SCALE[sym]):0.5;
      return `<div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:9.5px;width:34px;"><b style="font-family:'JetBrains Mono';color:var(--teal);">${sym}</b></span>
        <span style="flex:1;height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;"><i style="display:block;height:100%;width:${pct(norm)}%;background:var(--teal);opacity:.7;"></i></span>
        <span style="font-family:'JetBrains Mono';font-size:9px;width:54px;text-align:right;color:var(--muted);">${val} ${unit}</span></div>`;
    }).join('');
  }

  /* ----------------------------- RENDER ---------------------------------- */
  function render(root){
    if(!root||!root.querySelector('#pe-earth')) return;
    const r=model();
    renderInputs(root);
    renderEarth(root,r);

    // HUD planeta
    root.querySelector('#pe-hud-temp').textContent='TEMP '+r.v.Temp+'°C';
    root.querySelector('#pe-hud-ndvi').textContent='NDVI '+r.ndvi.toFixed(2);
    root.querySelector('#pe-hud-ph').textContent='OCEAN pH '+r.oceanPH.toFixed(2);
    root.querySelector('#pe-co2-read').textContent=(r.v.CO2<1?(+r.v.CO2).toFixed(2):(+r.v.CO2).toFixed(1))+' %';

    // big KPIs
    [r.stab,r.biomass,r.sustainability,r.tippingRisk].forEach((val,i)=>{
      const el=root.querySelector('#pe-big-'+i); el.textContent=pct(val)+'%';
      el.style.color=(i===3)?health(1-val):health(val); });

    // biodonut + diversidad
    renderBioDonut(root,r);
    const groups=[['Rainforest',r.veg],['Wetlands',r.waterFactor],['Coral',r.oceanPH/8.2*r.waterFactor],['Apex',r.fauna]];
    root.querySelector('#pe-divbars').innerHTML=groups.map(g=>{
      const val=clamp01(g[1]); return `<div style="display:flex;align-items:center;gap:5px;">
        <span style="font-size:7.5px;color:var(--muted);width:48px;">${g[0]}</span>
        <span style="flex:1;height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;"><i style="display:block;height:100%;width:${pct(val)}%;background:${health(val)};"></i></span></div>`; }).join('');

    // habitat loss chart (inverso de veg, con tendencia)
    areaChart(root.querySelector('#pe-habitat-chart'), series(clamp01(1-r.veg),0.04,0.2), '#F87171');

    // trophic cascade barras verticales
    const troph=[['Plants',r.gpp],['Herb',r.veg*0.8],['Meso',r.fauna*0.9],['Apex',r.fauna],['Dec',r.cycles.carbon]];
    root.querySelector('#pe-trophic').innerHTML=troph.map(t=>{
      const val=clamp01(t[1]); return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:2px;">
        <div style="width:100%;background:${health(val)};border-radius:2px 2px 0 0;height:${Math.round(8+val*34)}px;transition:height .35s;"></div>
        <span style="font-size:6px;color:var(--muted);">${t[0]}</span></div>`; }).join('');

    // clima & atmósfera
    renderEnergy(root,r);
    const phEl=root.querySelector('#pe-ph-pill'); phEl.textContent=r.oceanPH.toFixed(2);
    phEl.style.color=r.oceanPH>=7.8?'#60A5FA':r.oceanPH>=7.3?'#F5A623':'#F87171';
    areaChart(root.querySelector('#pe-carbon-chart'), series(clamp01(r.carbonSeq/16),0.05,0.25), '#4ADE80');

    // gráficas grandes
    bigLineChart(root.querySelector('#pe-temp-chart'), series(clamp01(r.tempAnomaly/6+0.3),0.05,0.35), '#F87171');
    root.querySelector('#pe-temp-now').textContent='+'+r.tempAnomaly.toFixed(1)+'°C';
    bigLineChart(root.querySelector('#pe-biomass-chart'), series(r.biomass,0.05,r.biomass>0.5?0.25:-0.2), '#4ADE80');
    root.querySelector('#pe-biomass-now').textContent=pct(r.biomass)+'%';

    // ciclos
    renderCycle(root,'#pe-carbon-cycle',r,{key:'c',color:'#4ADE80',intensity:r.cycles.carbon,top:'ATMÓSFERA CO₂',left:'Bosques',right:'Océano'});
    renderCycle(root,'#pe-nitrogen-cycle',r,{key:'n',color:'#60A5FA',intensity:r.cycles.nitrogen,top:'N₂ ATMOSFÉRICO',left:'Fijación',right:'Suelo'});

    // agua
    const w=[['Freshwater',r.freshwater,'#60A5FA'],['River Health',clamp01(r.freshwater*r.veg+0.1),'#22D3EE'],['Glaciers',r.glacier,'#A8D4FF']];
    root.querySelector('#pe-water').innerHTML=w.map(x=>`<div style="display:flex;align-items:center;gap:7px;">
      <span style="font-size:9px;width:72px;color:var(--text);">${x[0]}</span>
      <span style="flex:1;height:7px;background:var(--bg3);border-radius:4px;overflow:hidden;"><i style="display:block;height:100%;width:${pct(x[1])}%;background:${x[2]};transition:width .35s;"></i></span>
      <span style="font-family:'JetBrains Mono';font-size:9px;width:30px;text-align:right;color:var(--muted);">${pct(x[1])}%</span></div>`).join('');
    areaChart(root.querySelector('#pe-weather-chart'), series(r.extremeWeather,0.06,0.3), '#F5A623',30);

    // gauges
    renderGauge(root,0,r.stab);
    renderGauge(root,1,clamp01(1-(r.tippingRisk*0.5+r.tempAnomaly/8)));
    renderGauge(root,2,r.sustainability);

    renderAlerts(root,r);
  }

  function renderAlerts(root,r){
    const A=[]; const ico=c=>({crit:'⛔',warn:'⚠',ok:'✓',info:'ℹ'}[c]);
    const col=c=>({crit:'var(--red)',warn:'var(--amber)',ok:'var(--green)',info:'var(--blue)'}[c]);
    if(r.tippingRisk>0.6)A.push(['crit','Inflexión inminente — colapso sistémico']);
    else if(r.tippingRisk>0.4)A.push(['warn','Riesgo de inflexión elevado']);
    if(r.toxFactor<0.6)A.push(['crit','Toxicidad por H₂S — vida suprimida']);
    if(r.tempFactor<0.3)A.push(['crit','Temperatura fuera de rango habitable']);
    if(r.o2Factor<0.4)A.push(['warn','Oxígeno insuficiente para vida compleja']);
    if(r.pHFactor<0.6)A.push(['warn','pH extremo — química comprometida']);
    if(r.limiting<0.3)A.push(['crit','Nutriente limitante: '+r.limitingName]);
    else if(r.limiting<0.5)A.push(['warn',r.limitingName+' limita la producción']);
    if(r.oceanPH<7.7&&r.waterFactor>0.2)A.push(['warn','Acidificación oceánica (pH '+r.oceanPH.toFixed(2)+')']);
    if(r.extremeWeather>0.6)A.push(['warn','Alta frecuencia de clima extremo']);
    if(r.stab>=0.66&&A.length===0)A.push(['ok','Biosfera estable y resiliente']);
    if(A.length===0)A.push(['info','Sistema funcional · margen de mejora']);
    root.querySelector('#pe-alerts').innerHTML=A.slice(0,7).map(a=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:6px;background:var(--bg3);border-left:3px solid ${col(a[0])};font-size:10px;color:${col(a[0])};"><span style="font-size:12px;">${ico(a[0])}</span><span style="color:var(--text);">${a[1]}</span></div>`).join('');
  }

  /* hélices ADN decorativas del fondo */
  function buildDNA(root){
    function helix(n){ let p1='',p2=''; for(let i=0;i<=n;i++){ const y=i*22; const x=Math.sin(i*0.6)*14;
      p1+=(i?'L':'M')+(20+x)+','+y+' '; p2+=(i?'L':'M')+(20-x)+','+y+' '; } return p1+'" /><path d="'+p2; }
    const L=root.querySelector('#pe-dna-left'), R=root.querySelector('#pe-dna-right');
    if(L) L.innerHTML='<path transform="translate(10,40)" d="'+helix(18)+'"/>';
    if(R) R.innerHTML='<path transform="translate(0,120)" d="'+helix(16)+'"/>';
  }

  /* ----------------------------- ENTRY ----------------------------------- */
  let _root=null,_timer=null;
  function renderPlanetEarth(container){
    if(!container){ console.error('[PlanetEarth] container requerido'); return; }
    _root=container; container.innerHTML=template();
    buildEarth(container); buildDNA(container); render(container);
    const opt=container.querySelector('#pe-opt');
    if(opt)opt.onclick=()=>{ if(typeof global.applyPreset==='function'){ global.applyPreset('Tierra'); render(container);} };
    const goto=container.querySelector('#pe-goto');
    if(goto)goto.onclick=()=>{ if(typeof global.switchTab==='function') global.switchTab('minerals'); };
    if(_timer)clearInterval(_timer);
    _timer=setInterval(()=>{ if(document.body.contains(container)&&container.querySelector('#pe-earth')) render(container);
      else { clearInterval(_timer); _timer=null; } },700);
    return { model };
  }
  function refreshPlanetEarth(){ if(_root) render(_root); }

  global.renderPlanetEarth=renderPlanetEarth;
  global.refreshPlanetEarth=refreshPlanetEarth;
  global.PlanetEarthModel={ model, readVals };
})(typeof window!=='undefined'?window:globalThis);
