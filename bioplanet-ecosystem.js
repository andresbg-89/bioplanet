/* ============================================================
   bioplanet-ecosystem.js
   ─────────────────────────────────────────────────────────────
   Monta el dashboard de ecosistema en la pestaña "Ecosystem"
   de BioPlanet. Lee el objeto global `vals` y se actualiza
   automáticamente cuando cambian los sliders de la pestaña
   Planeta (vía refreshBioPlanet, llamada desde setValDash).

   DEPENDENCIAS: Chart.js debe estar disponible globalmente.
   Se carga vía CDN en index.html antes de app.js.
   ============================================================ */

/* ── clasificador de planeta ─────────────────────────── */
function _bpClassify(p){
  if(p.H2S>5&&p.S>10000) return 'sulfuric';
  if(p.Temp>80&&p.S>5000) return 'volcanic';
  if(p.Temp<-40) return 'glacial';
  if(p.H2O<10&&p.Fe>60) return 'arid';
  if(p.O2<2&&p.CO2>5) return 'gaseous';
  return 'earth';
}

/* ── paletas por tipo ────────────────────────────────── */
const _BP_PAL={
  earth:   {name:'CLASS-M TERRESTRIAL', accent:'#00ffc3',glow:'rgba(0,255,195,0.3)',  s1:'#1a6b3a',s2:'#1a5a8a',s3:'#2d8a4e', band:'rgba(255,255,255,0.1)',  polar:true, lava:false,sulfur:false,bands:false},
  volcanic:{name:'VOLCANIC INFERNO',    accent:'#ff6b47',glow:'rgba(255,107,71,0.35)',s1:'#8b1a0a',s2:'#c43a10',s3:'#ff6b47', band:'rgba(255,60,0,0.16)',     polar:false,lava:true, sulfur:false,bands:false},
  glacial: {name:'CRYOGENIC WORLD',     accent:'#a0d8ff',glow:'rgba(160,216,255,0.3)',s1:'#c8e8ff',s2:'#a0c4e8',s3:'#e8f4ff', band:'rgba(200,240,255,0.16)',  polar:true, lava:false,sulfur:false,bands:false},
  sulfuric:{name:'TOXIC SULFUR WORLD',  accent:'#c8ff00',glow:'rgba(200,255,0,0.3)',  s1:'#6b7a00',s2:'#a0b800',s3:'#d4e800', band:'rgba(200,220,0,0.14)',    polar:false,lava:false,sulfur:true, bands:false},
  arid:    {name:'ARID DESERT WORLD',   accent:'#ffb347',glow:'rgba(255,179,71,0.3)', s1:'#8b5a2b',s2:'#c47a3a',s3:'#e8a060', band:'rgba(180,120,60,0.14)',   polar:false,lava:false,sulfur:false,bands:false},
  gaseous: {name:'GAS GIANT',           accent:'#b06cff',glow:'rgba(176,108,255,0.3)',s1:'#3a1a6b',s2:'#6b3a9a',s3:'#9a60c8', band:'rgba(140,80,200,0.16)',   polar:false,lava:false,sulfur:false,bands:true},
};

/* ── modelo ecológico ────────────────────────────────── */
function _bpCompute(p){
  const cl=v=>Math.max(0,Math.min(1,v));
  const wf=cl(1-Math.pow((p.H2O/100-0.72)/0.55,2));
  const tf=p.Temp>=5&&p.Temp<=35?1:p.Temp>=-20&&p.Temp<=50?.55:p.Temp>=-60&&p.Temp<=80?.2:.04;
  const o2f=p.O2>=15?1:p.O2>=5?.6:.15;
  const phf=p.pH>=5.5&&p.pH<=9?1:p.pH>=3&&p.pH<=11?.5:.15;
  const txf=cl(1-(p.H2S/6)*1.1);
  const hab=cl(wf*.3+tf*.25+o2f*.25+phf*.1+txf*.1);
  const gpp=cl(hab*.8*(1-Math.max(0,p.CO2-1)*.05));
  const bio=cl(Math.pow(gpp,.7)*txf);
  const stab=cl((hab*.5+bio*.3+wf*.2)*(0.3+0.7*cl(gpp*1.4)));
  const tip=cl((p.H2S/6)*.4+Math.max(0,p.CO2-1)*.08+(1-tf)*.3+(1-wf)*.3);
  return{hab,gpp,bio,stab,tip,wf,tf,o2f,phf,txf};
}

function _bpHc(v){
  if(v>=.66)return'#00ffc3';
  if(v>=.45)return'#ffb347';
  if(v>=.28)return'#ff6b47';
  return'#ff4560';
}

/* ── registro de instancias Chart.js activas ──────────── */
const _bpCharts={};
function _bpDestroyCharts(){
  Object.values(_bpCharts).forEach(c=>{try{c.destroy();}catch(e){}});
  Object.keys(_bpCharts).forEach(k=>delete _bpCharts[k]);
}

/* ── contenedor activo ────────────────────────────────── */
let _bpContainer=null;

/* ══════════════════════════════════════════════════════
   renderEcosystem — reemplaza la función original en app.js
   ══════════════════════════════════════════════════════ */
function renderEcosystem(el){
  _bpDestroyCharts();
  _bpContainer=el;
  const p=window.vals||{Ca:41,Fe:56,Si:282,P:1,Mg:23,S:350,H2S:0,H2O:71,CO2:0.04,O2:21,Temp:15,pH:7.2,gravity:1};
  const type=_bpClassify(p);
  const pal=_BP_PAL[type];
  const met=_bpCompute(p);

  el.innerHTML=_bpTemplate();
  _bpApplyStyles();
  _bpRenderAll(p,type,pal,met);
}

/* ── refresh en vivo (llamado desde setValDash) ─────── */
function refreshBioPlanet(){
  if(!_bpContainer||!document.body.contains(_bpContainer)) return;
  // Solo actualizar si la pestaña ecosistema está activa
  if(typeof currentTab!=='undefined'&&currentTab!=='ecosystem') return;
  const p=window.vals||{};
  const type=_bpClassify(p);
  const pal=_BP_PAL[type];
  const met=_bpCompute(p);
  _bpDestroyCharts();
  _bpRenderAll(p,type,pal,met);
}

/* ── render maestro ──────────────────────────────────── */
function _bpRenderAll(p,type,pal,met){
  _bpRenderHeader(p,pal,met);
  _bpRenderGlobe(p,type,pal);
  document.getElementById('bp-grav-val').textContent=(p.gravity||1).toFixed(2)+'g';
  _bpRenderKpiRow(p,met,pal);
  _bpRenderMineralPanel(p,pal);
  _bpRenderHabPanel(p,met);
  _bpRenderAtmPanel(p);
  _bpRenderMetricsPanel(p,met,pal);
  _bpRenderToxPanel(p);
  _bpRenderHydroPanel(p);
  _bpRenderThermalPanel(p,met);
  _bpRenderStabilityPanel(p);
  _bpRenderFooter(pal);
}

/* ── TEMPLATE HTML ───────────────────────────────────── */
function _bpTemplate(){
  return `
<div id="bp-root" style="width:100%;height:100%;display:flex;flex-direction:column;background:#030b1a;
  background-image:radial-gradient(ellipse 70% 60% at 50% 40%,rgba(0,60,120,0.25) 0%,transparent 65%),
  radial-gradient(ellipse 40% 40% at 10% 10%,rgba(0,100,180,0.08) 0%,transparent 60%);
  font-family:'JetBrains Mono',monospace;color:#e2eaf5;position:relative;overflow:hidden;">

  <!-- grid overlay -->
  <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(0,180,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,180,255,0.02) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0"></div>

  <!-- HEADER -->
  <div id="bp-header" style="position:relative;z-index:2;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:7px 18px;border-bottom:1px solid rgba(0,180,255,0.1);background:rgba(3,11,26,0.85)"></div>

  <!-- BODY -->
  <div style="position:relative;z-index:1;flex:1;display:flex;flex-direction:column;padding:8px 14px 0;gap:8px;min-height:0;overflow:hidden;">

    <!-- CENTER ROW -->
    <div style="display:grid;grid-template-columns:230px 1fr 230px;gap:8px;flex:1;min-height:0;">

      <!-- LEFT COL -->
      <div style="display:flex;flex-direction:column;gap:8px;min-height:0;">
        <div id="bp-p-mineral" class="bp-panel" style="flex:1;min-height:0"></div>
        <div id="bp-p-hab"     class="bp-panel" style="flex:1;min-height:0"></div>
      </div>

      <!-- GLOBE -->
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;z-index:5;">
          <div style="display:flex;gap:2px">${[16,10,6,3].map(w=>`<div style="width:${w}px;height:1px;background:rgba(0,212,255,0.35)"></div>`).join('')}</div>
          <span style="color:#00d4ff;font-size:7px;letter-spacing:.18em;opacity:.7">REAL-TIME TELEMETRY</span>
          <div style="display:flex;gap:2px">${[3,6,10,16].map(w=>`<div style="width:${w}px;height:1px;background:rgba(0,212,255,0.35)"></div>`).join('')}</div>
        </div>
        <div id="bp-globe" style="width:100%;height:100%;position:relative;display:flex;align-items:center;justify-content:center"></div>
        <div style="position:absolute;bottom:8px;display:flex;gap:10px;z-index:5;">
          <div class="bp-coord"><span style="color:#3a6080;font-size:7px">LAT</span><span style="color:#00d4ff;font-size:8px">0.000°N</span></div>
          <div class="bp-coord"><span style="color:#3a6080;font-size:7px">LON</span><span style="color:#00d4ff;font-size:8px">0.000°E</span></div>
          <div class="bp-coord"><span style="color:#3a6080;font-size:7px">GRAV</span><span id="bp-grav-val" style="color:#00d4ff;font-size:8px">1.00g</span></div>
        </div>
      </div>

      <!-- RIGHT COL -->
      <div style="display:flex;flex-direction:column;gap:8px;min-height:0;">
        <div id="bp-p-atm"     class="bp-panel" style="flex:1;min-height:0"></div>
        <div id="bp-p-metrics" class="bp-panel" style="flex:1;min-height:0"></div>
      </div>
    </div>

    <!-- KPI ROW bajo el globo -->
    <div id="bp-kpi-row" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;flex-shrink:0"></div>

    <!-- BOTTOM ROW -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;height:175px;flex-shrink:0;">
      <div id="bp-p-tox"    class="bp-panel"></div>
      <div id="bp-p-hydro"  class="bp-panel"></div>
      <div id="bp-p-thermal"class="bp-panel"></div>
      <div id="bp-p-stab"   class="bp-panel"></div>
    </div>
  </div>

  <!-- FOOTER -->
  <div id="bp-footer" style="position:relative;z-index:2;flex-shrink:0;display:flex;justify-content:space-between;align-items:center;padding:4px 18px;border-top:1px solid rgba(0,180,255,0.07);background:rgba(3,11,26,0.6)"></div>
</div>`;
}

function _bpApplyStyles(){
  if(document.getElementById('bp-styles')) return;
  const s=document.createElement('style');
  s.id='bp-styles';
  s.textContent=`
    .bp-panel{background:linear-gradient(135deg,rgba(5,15,35,0.95),rgba(8,20,45,0.95));
      border-radius:7px;padding:10px 12px;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;}
    .bp-ptitle{display:flex;align-items:center;gap:7px;margin-bottom:8px;flex-shrink:0;}
    .bp-pbar{width:3px;height:11px;border-radius:2px;flex-shrink:0;}
    .bp-ptspan{font-size:8px;letter-spacing:.16em;font-weight:700;flex:1;}
    .bp-pdot{width:5px;height:5px;border-radius:50%;animation:bpBlink 2s infinite;flex-shrink:0;}
    .bp-chip{display:flex;flex-direction:column;}
    .bp-cl{font-size:7px;color:#1e3550;letter-spacing:.1em;}
    .bp-cv{font-size:9px;font-weight:700;letter-spacing:.05em;}
    .bp-smrow{display:flex;gap:6px;margin-top:auto;padding-top:6px;flex-shrink:0;}
    .bp-sm .bp-sl{font-size:6px;color:#5a7a9a;letter-spacing:.07em;}
    .bp-sm .bp-sv{font-size:10px;font-weight:700;margin-top:1px;}
    .bp-kpic{background:rgba(3,11,26,0.7);border:1px solid rgba(0,212,255,0.12);
      border-radius:6px;padding:7px 8px;text-align:center;}
    .bp-kpic .bp-kl{font-size:6px;color:#5a7a9a;letter-spacing:.08em;text-transform:uppercase;}
    .bp-kpic .bp-kv{font-size:14px;font-weight:700;margin-top:2px;}
    .bp-barrow{display:flex;align-items:center;gap:5px;font-size:7px;}
    .bp-bt{flex:1;height:5px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;}
    .bp-bf{height:100%;border-radius:2px;transition:width .4s;}
    .bp-met{display:flex;flex-direction:column;gap:3px;margin-bottom:6px;}
    .bp-met-top{display:flex;justify-content:space-between;font-size:7px;}
    .bp-mt{height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;}
    .bp-mf{height:100%;border-radius:2px;transition:width .4s;}
    .bp-coord{display:flex;align-items:center;gap:4px;background:rgba(0,30,60,0.6);
      border:1px solid rgba(0,212,255,0.15);border-radius:3px;padding:2px 7px;}
    .bp-gm{position:absolute;display:flex;flex-direction:column;align-items:center;z-index:5;}
    .bp-gml{font-size:7px;color:#3a6080;letter-spacing:.08em;}
    .bp-gmv{font-size:9px;font-weight:700;}
    @keyframes bpBlink{0%,100%{opacity:1}50%{opacity:.2}}
    @keyframes bpScan{0%{top:20%;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:80%;opacity:0}}
    @keyframes bpOrbit{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
}

/* ── HEADER ──────────────────────────────────────────── */
function _bpRenderHeader(p,pal,met){
  const al=met.tip>.6?{l:'CRITICAL',c:'#ff4560'}:met.tip>.35?{l:'MODERATE',c:'#ffb347'}:{l:'NOMINAL',c:'#00ffc3'};
  const hc=met.hab>.6?'#00ffc3':met.hab>.35?'#ffb347':'#ff4560';
  document.getElementById('bp-header').innerHTML=`
    <div style="display:flex;gap:16px">
      <div class="bp-chip"><span class="bp-cl">PLANET TYPE</span><span class="bp-cv" style="color:${pal.accent}">${pal.name}</span></div>
      <div class="bp-chip"><span class="bp-cl">HABITABILITY</span><span class="bp-cv" style="color:${hc}">${Math.round(met.hab*100)}%</span></div>
      <div class="bp-chip"><span class="bp-cl">TEMP</span><span class="bp-cv" style="color:${p.Temp>50?'#ff4560':p.Temp<-20?'#a0d8ff':'#00ffc3'}">${p.Temp}°C</span></div>
    </div>
    <div style="text-align:center;position:absolute;left:50%;transform:translateX(-50%);">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:1px;background:linear-gradient(90deg,transparent,${pal.accent}88)"></div>
        <h1 style="color:#e8f4ff;font-size:16px;font-weight:700;letter-spacing:.3em;margin:0;text-shadow:0 0 20px ${pal.glow}">BIOPLANET · ECOSYSTEM</h1>
        <div style="width:36px;height:1px;background:linear-gradient(90deg,${pal.accent}88,transparent)"></div>
      </div>
      <div style="color:#3a6080;font-size:7px;letter-spacing:.2em;margin-top:1px">${pal.name} · GLOBAL ECOSYSTEM MONITORING SYSTEM</div>
    </div>
    <div style="display:flex;gap:16px;justify-content:flex-end">
      <div class="bp-chip" style="align-items:flex-end"><span class="bp-cl">ALERT LVL</span><span class="bp-cv" style="color:${al.c}">${al.l}</span></div>
      <div class="bp-chip" style="align-items:flex-end"><span class="bp-cl">STABILITY</span><span class="bp-cv" style="color:${_bpHc(met.stab)}">${Math.round(met.stab*100)}%</span></div>
      <div class="bp-chip" style="align-items:flex-end"><span class="bp-cl">UTC</span><span class="bp-cv" style="color:#a0c4ff">${new Date().toUTCString().slice(17,25)}</span></div>
    </div>`;
}

/* ── GLOBO ───────────────────────────────────────────── */
function _bpRenderGlobe(p,type,pal){
  const [c1,c2,c3]=[pal.s1,pal.s2,pal.s3];
  const surfs={
    earth:    `radial-gradient(circle at 38% 35%,${c3} 0%,${c1} 35%,${c2} 65%,#061020 100%)`,
    volcanic: `radial-gradient(circle at 40% 38%,#ff8c42 0%,${c2} 30%,${c1} 60%,#1a0500 100%)`,
    glacial:  `radial-gradient(circle at 35% 30%,#ffffff 0%,${c3} 25%,${c1} 60%,#0a1830 100%)`,
    sulfuric: `radial-gradient(circle at 42% 36%,#e8ff80 0%,${c2} 35%,${c1} 65%,#1a1e00 100%)`,
    arid:     `radial-gradient(circle at 38% 35%,#f0c060 0%,${c2} 35%,${c1} 65%,#1a0800 100%)`,
    gaseous:  `radial-gradient(circle at 50% 30%,${c3} 0%,${c2} 30%,${c1} 60%,#0a0020 100%)`,
  };
  const cloudO=Math.min(0.8,p.H2O/100*1.2);

  let extras='';
  if(pal.lava) extras+=`<div style="position:absolute;top:30%;left:15%;width:70%;height:40%;background:radial-gradient(ellipse,rgba(255,140,0,0.55) 0%,transparent 70%);filter:blur(5px)"></div><div style="position:absolute;top:55%;left:30%;width:40%;height:25%;background:radial-gradient(ellipse,rgba(255,80,0,0.45) 0%,transparent 70%);filter:blur(4px)"></div>`;
  if(pal.sulfur) extras+=`<div style="position:absolute;top:20%;left:20%;width:60%;height:60%;background:radial-gradient(ellipse,rgba(200,255,0,0.45) 0%,transparent 70%);filter:blur(5px)"></div>`;
  if(pal.bands) extras+=[22,42,58,74].map((t,i)=>`<div style="position:absolute;top:${t}%;left:0;right:0;height:8%;background:rgba(${i%2===0?'160,100,255':'100,60,200'},0.22);filter:blur(3px)"></div>`).join('');
  if(pal.polar){
    extras+=`<div style="position:absolute;top:0;left:25%;right:25%;height:20%;background:${type==='glacial'?'rgba(255,255,255,0.75)':'rgba(255,255,255,0.5)'};border-radius:50%;filter:blur(6px)"></div>`;
    extras+=`<div style="position:absolute;bottom:0;left:30%;right:30%;height:16%;background:${type==='glacial'?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.4)'};border-radius:50%;filter:blur(6px)"></div>`;
  }
  if(p.H2O>30) extras+=`<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(ellipse at 35% 28%,rgba(255,255,255,${cloudO*.5}) 0%,transparent 55%),radial-gradient(ellipse at 65% 62%,rgba(255,255,255,${cloudO*.35}) 0%,transparent 40%)"></div>`;

  const dots=[{t:'26%',l:'42%',c:pal.accent},{t:'54%',l:'68%',c:'#00d4ff'},{t:'37%',l:'72%',c:pal.accent},{t:'61%',l:'30%',c:'#a0c4ff'}];

  document.getElementById('bp-globe').innerHTML=`
    <div style="position:absolute;width:360px;height:360px;border-radius:50%;border:1px solid ${pal.accent}12;animation:bpOrbit 40s linear infinite"></div>
    <div style="position:absolute;width:320px;height:320px;border-radius:50%;border:1px solid ${pal.accent}20"></div>
    <div style="position:absolute;width:300px;height:84px;border-radius:50%;border:1px solid ${pal.accent}28;transform:rotateX(70deg)"></div>
    <div style="position:absolute;width:300px;height:84px;border-radius:50%;border:1px solid ${pal.accent}16;transform:rotateX(70deg) rotateY(60deg)"></div>
    <div style="position:absolute;width:275px;height:275px;border-radius:50%;background:radial-gradient(circle,${pal.glow} 0%,transparent 70%);filter:blur(14px)"></div>
    <div style="position:absolute;width:248px;height:248px;border-radius:50%;border:1px solid ${pal.accent}38;box-shadow:0 0 32px ${pal.glow}"></div>
    <div style="position:relative;width:228px;height:228px;border-radius:50%;overflow:hidden;
      box-shadow:0 0 50px ${pal.glow},inset -28px -10px 50px rgba(0,0,0,0.6);
      border:2px solid ${pal.accent}45;z-index:2;background:${surfs[type]}">
      <div style="position:absolute;top:36%;left:0;right:0;height:26%;background:${pal.band};filter:blur(8px)"></div>
      ${extras}
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 32% 30%,transparent 42%,rgba(0,0,20,0.55) 100%)"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 28%,rgba(180,230,255,0.15) 0%,transparent 42%)"></div>
    </div>
    <div style="position:absolute;width:228px;height:2px;background:linear-gradient(90deg,transparent,${pal.accent}99 30%,${pal.accent}cc 50%,${pal.accent}99 70%,transparent);animation:bpScan 3s ease-in-out infinite;z-index:3;filter:blur(1px)"></div>
    ${dots.map((d,i)=>`<div style="position:absolute;top:${d.t};left:${d.l};width:6px;height:6px;border-radius:50%;background:${d.c};box-shadow:0 0 8px ${d.c};z-index:4;animation:bpBlink ${1.5+i*.4}s ease-in-out infinite"></div>`).join('')}
    <div class="bp-gm" style="top:10%;right:6%"><span class="bp-gml">H₂O</span><span class="bp-gmv" style="color:#00d4ff">${p.H2O}%</span></div>
    <div class="bp-gm" style="top:38%;right:3%"><span class="bp-gml">O₂</span><span class="bp-gmv" style="color:#00ffc3">${p.O2}%</span></div>
    <div class="bp-gm" style="bottom:20%;right:6%"><span class="bp-gml">pH</span><span class="bp-gmv" style="color:#b06cff">${p.pH.toFixed(1)}</span></div>
    <div class="bp-gm" style="top:10%;left:6%"><span class="bp-gml">CO₂</span><span class="bp-gmv" style="color:#ffb347">${p.CO2.toFixed?p.CO2.toFixed(2):p.CO2}%</span></div>
    <div class="bp-gm" style="top:38%;left:3%"><span class="bp-gml">H₂S</span><span class="bp-gmv" style="color:${p.H2S>3?'#ff4560':'#a0c4ff'}">${p.H2S}%</span></div>
    <div class="bp-gm" style="bottom:20%;left:6%"><span class="bp-gml">TEMP</span><span class="bp-gmv" style="color:${p.Temp>50?'#ff6b47':p.Temp<-20?'#a0d8ff':'#00ffc3'}">${p.Temp}°</span></div>`;
}

/* ── KPI ROW ─────────────────────────────────────────── */
function _bpRenderKpiRow(p,met,pal){
  const items=[
    {l:'ESTABILIDAD',  v:Math.round(met.stab*100)+'%', c:_bpHc(met.stab)},
    {l:'BIOMASA',      v:Math.round(met.gpp*100)+'%',  c:_bpHc(met.gpp)},
    {l:'SOSTENIBILIDAD',v:Math.round(met.hab*100)+'%', c:_bpHc(met.hab)},
    {l:'RIESGO TIPPING',v:Math.round(met.tip*100)+'%', c:_bpHc(1-met.tip)},
  ];
  document.getElementById('bp-kpi-row').innerHTML=items.map(k=>`
    <div class="bp-kpic">
      <div class="bp-kl">${k.l}</div>
      <div class="bp-kv" style="color:${k.c}">${k.v}</div>
    </div>`).join('');
}

/* ── helper: cabecera de panel ──────────────────────── */
function _bpPH(id,title,color){
  const el=document.getElementById(id);
  el.innerHTML=`<div class="bp-ptitle"><div class="bp-pbar" style="background:${color};box-shadow:0 0 5px ${color}"></div><span class="bp-ptspan" style="color:${color};text-shadow:0 0 8px ${color}55">${title}</span><div class="bp-pdot" style="background:${color};box-shadow:0 0 5px ${color}"></div></div>`;
  return el;
}

/* ── helper: crear chart con id único ───────────────── */
function _bpChart(id,config){
  const c=document.createElement('canvas');
  c.id='bpc-'+id; c.setAttribute('role','img'); c.setAttribute('aria-label',id+' chart'); c.textContent=id;
  const w=document.createElement('div'); w.style.cssText='position:relative;flex:1;min-height:0;';
  w.appendChild(c);
  if(_bpCharts[id]) try{_bpCharts[id].destroy();}catch(e){}
  // Chart.js needs a short delay after DOM insert
  requestAnimationFrame(()=>{
    if(!c.isConnected) return;
    _bpCharts[id]=new Chart(c,config);
  });
  return w;
}

const _TTOPTS={plugins:{legend:{display:false}},scales:{
  x:{ticks:{color:'#3a5a7a',font:{size:6,family:'JetBrains Mono'}},grid:{color:'rgba(0,180,255,0.07)'},border:{display:false}},
  y:{ticks:{color:'#3a5a7a',font:{size:6,family:'JetBrains Mono'}},grid:{color:'rgba(0,180,255,0.07)'},border:{display:false}}}};

/* ── PANEL: Mineral Composition ─────────────────────── */
function _bpRenderMineralPanel(p,pal){
  const el=_bpPH('bp-p-mineral','MINERAL COMPOSITION',pal.accent);
  const items=[{n:'Si',v:Math.round(p.Si/10),c:'#00ffc3'},{n:'Fe',v:Math.round(p.Fe),c:'#ff6b47'},{n:'Ca',v:Math.round(p.Ca),c:'#00d4ff'},{n:'Mg',v:Math.round(p.Mg),c:'#b06cff'},{n:'S',v:Math.round(p.S/100),c:'#ffb347'},{n:'P',v:Math.round(p.P*10),c:'#39d353'}].filter(x=>x.v>0);
  const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;flex:1;min-height:0;overflow:hidden;';
  const cw=document.createElement('div'); cw.style.cssText='width:90px;height:90px;flex-shrink:0;position:relative;';
  const cv=document.createElement('canvas'); cv.id='bpc-donut'; cv.setAttribute('role','img'); cv.setAttribute('aria-label','Mineral composition donut chart'); cv.textContent='Mineral composition';
  cw.appendChild(cv); row.appendChild(cw);
  const leg=document.createElement('div'); leg.style.cssText='flex:1;display:flex;flex-direction:column;gap:3px;font-size:7px;';
  leg.innerHTML=items.map(x=>`<div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:4px"><div style="width:5px;height:5px;border-radius:1px;background:${x.c}"></div><span style="color:#7a9abf">${x.n}</span></div><span style="color:${x.c}">${x.v}</span></div>`).join('');
  row.appendChild(leg); el.appendChild(row);
  requestAnimationFrame(()=>{
    if(_bpCharts['donut'])try{_bpCharts['donut'].destroy();}catch(e){}
    _bpCharts['donut']=new Chart(cv,{type:'doughnut',data:{labels:items.map(x=>x.n),datasets:[{data:items.map(x=>x.v),backgroundColor:items.map(x=>x.c),borderWidth:0}]},options:{responsive:false,cutout:'62%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw}`}}}}});
  });
  const kpis=document.createElement('div'); kpis.style.cssText='display:flex;gap:4px;margin-top:auto;padding-top:7px;border-top:1px solid rgba(255,255,255,0.05);flex-shrink:0;';
  kpis.innerHTML=`<div style="flex:1;text-align:center"><div style="font-size:6px;color:#5a7a9a">Fe/Si RATIO</div><div style="font-size:11px;font-weight:700;color:#ff6b47">${(p.Fe/Math.max(1,p.Si/10)).toFixed(2)}</div></div><div style="width:1px;background:rgba(255,255,255,0.07)"></div><div style="flex:1;text-align:center"><div style="font-size:6px;color:#5a7a9a">SILICATE</div><div style="font-size:11px;font-weight:700;color:#00ffc3">${Math.round(p.Si/3.5)}%</div></div><div style="width:1px;background:rgba(255,255,255,0.07)"></div><div style="flex:1;text-align:center"><div style="font-size:6px;color:#5a7a9a">SULFUR</div><div style="font-size:11px;font-weight:700;color:#ffb347">${(p.S/250).toFixed(1)}%</div></div>`;
  el.appendChild(kpis);
}

/* ── PANEL: Habitability ────────────────────────────── */
function _bpRenderHabPanel(p,met){
  const el=_bpPH('bp-p-hab','HABITABILITY INDEX','#00d4ff');
  const bars=[{l:'H₂O',v:met.wf,c:'#00d4ff'},{l:'O₂',v:met.o2f,c:'#00ffc3'},{l:'TEMP',v:met.tf,c:p.Temp>50?'#ff4560':'#a0c4ff'},{l:'pH',v:met.phf,c:'#b06cff'},{l:'TOX',v:met.txf,c:met.txf<.5?'#ff4560':'#39d353'}];
  const wrap=document.createElement('div'); wrap.style.cssText='display:flex;flex-direction:column;gap:5px;flex:1;';
  wrap.innerHTML=bars.map(b=>`<div class="bp-barrow"><span style="color:#5a7a9a;width:26px">${b.l}</span><div class="bp-bt"><div class="bp-bf" style="width:${Math.round(b.v*100)}%;background:${b.c}"></div></div><span style="color:${b.c};width:26px;text-align:right">${Math.round(b.v*100)}%</span></div>`).join('');
  el.appendChild(wrap);
  const kpis=document.createElement('div'); kpis.style.cssText='display:flex;gap:4px;margin-top:auto;padding-top:7px;border-top:1px solid rgba(0,212,255,0.08);flex-shrink:0;';
  kpis.innerHTML=`<div style="flex:1;text-align:center"><div style="font-size:6px;color:#5a7a9a">OVERALL</div><div style="font-size:13px;font-weight:700;color:${_bpHc(met.hab)}">${Math.round(met.hab*100)}%</div></div><div style="width:1px;background:rgba(0,212,255,0.1)"></div><div style="flex:1;text-align:center"><div style="font-size:6px;color:#5a7a9a">GPP IDX</div><div style="font-size:13px;font-weight:700;color:#00ffc3">${Math.round(met.gpp*100)}</div></div>`;
  el.appendChild(kpis);
}

/* ── PANEL: Atmospheric Dynamics ───────────────────── */
function _bpRenderAtmPanel(p){
  const el=_bpPH('bp-p-atm','ATMOSPHERIC DYNAMICS','#ff6b47');
  const hdr=document.createElement('div'); hdr.style.cssText='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;flex-shrink:0;';
  hdr.innerHTML=`<div><div style="color:#ff6b47;font-size:15px;font-weight:700;line-height:1">${p.CO2.toFixed?p.CO2.toFixed(2):p.CO2}%</div><div style="color:#5a7a9a;font-size:7px;margin-top:1px">ATMOSPHERIC CO₂</div></div><div style="background:rgba(255,107,71,0.12);border:1px solid rgba(255,107,71,0.3);border-radius:4px;padding:2px 7px;color:#ff6b47;font-size:7px">${p.CO2>1?'▲ HIGH':p.CO2>0.1?'● NORM':'▼ LOW'}</div>`;
  el.appendChild(hdr);
  const labels=['T-6','T-5','T-4','T-3','T-2','T-1','NOW'];
  const co2d=labels.map((_,i)=>+Math.max(0,p.CO2+(i-6)*p.CO2*.03).toFixed(3));
  const o2d=labels.map((_,i)=>+Math.max(0,p.O2+(i-6)*.2).toFixed(1));
  const cw=el.appendChild(_bpChart('atm',{type:'line',data:{labels,datasets:[{label:'CO₂',data:co2d,borderColor:'#ff6b47',borderWidth:2,pointRadius:0,tension:.4,fill:false},{label:'O₂',data:o2d,borderColor:'#00ffc3',borderWidth:1.5,borderDash:[4,2],pointRadius:0,tension:.4,fill:false}]},options:{responsive:true,maintainAspectRatio:false,..._TTOPTS}}));
  const sm=document.createElement('div'); sm.className='bp-smrow';
  sm.innerHTML=`<div class="bp-sm"><div class="bp-sl">CO₂</div><div class="bp-sv" style="color:#ff6b47">${p.CO2.toFixed?p.CO2.toFixed(2):p.CO2}%</div></div><div class="bp-sm"><div class="bp-sl">O₂</div><div class="bp-sv" style="color:#00ffc3">${p.O2.toFixed?p.O2.toFixed(1):p.O2}%</div></div><div class="bp-sm"><div class="bp-sl">H₂S</div><div class="bp-sv" style="color:${p.H2S>3?'#ff4560':'#a0c4ff'}">${p.H2S.toFixed?p.H2S.toFixed(1):p.H2S}%</div></div>`;
  el.appendChild(sm);
}

/* ── PANEL: Planetary Metrics ───────────────────────── */
function _bpRenderMetricsPanel(p,met,pal){
  const el=_bpPH('bp-p-metrics','PLANETARY METRICS','#b06cff');
  const items=[{l:'HABITABILITY',v:met.hab,c:pal.accent},{l:'BIODIVERSITY',v:met.bio,c:'#39d353'},{l:'STABILITY IDX',v:met.stab,c:'#00d4ff'},{l:'TIPPING RISK',v:met.tip,c:met.tip>.6?'#ff4560':'#ffb347'}];
  const wrap=document.createElement('div'); wrap.style.cssText='display:flex;flex-direction:column;gap:7px;flex:1;';
  wrap.innerHTML=items.map(m=>`<div class="bp-met"><div class="bp-met-top"><span style="color:#5a7a9a">${m.l}</span><span style="color:${m.c};font-weight:700">${Math.round(m.v*100)}%</span></div><div class="bp-mt"><div class="bp-mf" style="width:${Math.round(m.v*100)}%;background:linear-gradient(90deg,${m.c}70,${m.c});box-shadow:0 0 4px ${m.c}50"></div></div></div>`).join('');
  el.appendChild(wrap);
  const kpis=document.createElement('div'); kpis.style.cssText='display:flex;gap:4px;margin-top:auto;padding-top:7px;border-top:1px solid rgba(176,108,255,0.1);flex-shrink:0;';
  kpis.innerHTML=`<div style="flex:1;text-align:center"><div style="font-size:6px;color:#5a7a9a">GRAVITY</div><div style="font-size:12px;font-weight:700;color:#ff6b47">${(p.gravity||1).toFixed(2)}g</div></div><div style="width:1px;background:rgba(176,108,255,0.12)"></div><div style="flex:1;text-align:center"><div style="font-size:6px;color:#5a7a9a">GPP IDX</div><div style="font-size:12px;font-weight:700;color:#00ffc3">${Math.round(met.gpp*100)}</div></div><div style="width:1px;background:rgba(176,108,255,0.12)"></div><div style="flex:1;text-align:center"><div style="font-size:6px;color:#5a7a9a">C-SEQ t/ha</div><div style="font-size:12px;font-weight:700;color:#00d4ff">${(met.gpp*(p.H2O/100)*16).toFixed(1)}</div></div>`;
  el.appendChild(kpis);
}

/* ── PANEL: Toxicity ────────────────────────────────── */
function _bpRenderToxPanel(p){
  const el=_bpPH('bp-p-tox','TOXICITY MONITOR','#ff4560');
  const labels=Array.from({length:12},(_,i)=>`${i+1}h`);
  const d=labels.map((_,i)=>+Math.max(0,p.H2S+Math.sin(i*.8)*p.H2S*.18).toFixed(2));
  el.appendChild(_bpChart('tox',{type:'line',data:{labels,datasets:[{label:'H₂S',data:d,borderColor:'#ff4560',borderWidth:1.5,fill:true,backgroundColor:'rgba(255,69,96,0.12)',pointRadius:0,tension:.4}]},options:{responsive:true,maintainAspectRatio:false,..._TTOPTS}}));
  const sm=document.createElement('div'); sm.className='bp-smrow';
  sm.innerHTML=`<div class="bp-sm"><div class="bp-sl">H₂S NOW</div><div class="bp-sv" style="color:${p.H2S>2?'#ff4560':'#00ffc3'}">${p.H2S.toFixed?p.H2S.toFixed(1):p.H2S}%</div></div><div class="bp-sm"><div class="bp-sl">SAFE LVL</div><div class="bp-sv" style="color:#5a7a9a">&lt;2%</div></div><div class="bp-sm"><div class="bp-sl">STATUS</div><div class="bp-sv" style="color:${p.H2S>5?'#ff4560':p.H2S>2?'#ffb347':'#00ffc3'}">${p.H2S>5?'DANGER':p.H2S>2?'WARN':'SAFE'}</div></div>`;
  el.appendChild(sm);
}

/* ── PANEL: Hydrology ───────────────────────────────── */
function _bpRenderHydroPanel(p){
  const el=_bpPH('bp-p-hydro','HYDROLOGY CYCLE','#00b4d8');
  const iceP=+(p.Temp<0?p.H2O*.5:p.H2O*.1).toFixed(1);
  el.appendChild(_bpChart('hydro',{type:'bar',data:{labels:['Vapor','Liquid','Ice'],datasets:[{data:[+(p.H2O*.05).toFixed(1),+(p.H2O*.7).toFixed(1),iceP],backgroundColor:['#a0c4ff','#00d4ff','#e0f0ff'],borderRadius:2,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,..._TTOPTS}}));
  const sm=document.createElement('div'); sm.className='bp-smrow';
  sm.innerHTML=`<div class="bp-sm"><div class="bp-sl">COVERAGE</div><div class="bp-sv" style="color:#00b4d8">${p.H2O}%</div></div><div class="bp-sm"><div class="bp-sl">pH</div><div class="bp-sv" style="color:#00ffc3">${p.pH.toFixed?p.pH.toFixed(2):p.pH}</div></div><div class="bp-sm"><div class="bp-sl">ICE%</div><div class="bp-sv" style="color:#a0c4ff">${Math.round(iceP)}%</div></div>`;
  el.appendChild(sm);
}

/* ── PANEL: Thermal ─────────────────────────────────── */
function _bpRenderThermalPanel(p,met){
  const el=_bpPH('bp-p-thermal','THERMAL PROFILE','#ffd166');
  const labels=Array.from({length:10},(_,i)=>`${i*10}°`);
  const d=labels.map((_,i)=>Math.round(Math.max(0,met.hab*100*Math.exp(-Math.pow((i*10-20)/30,2)))));
  el.appendChild(_bpChart('thermal',{type:'line',data:{labels,datasets:[{label:'Hab%',data:d,borderColor:'#ffd166',borderWidth:1.5,fill:true,backgroundColor:'rgba(255,209,102,0.1)',pointRadius:0,tension:.5}]},options:{responsive:true,maintainAspectRatio:false,..._TTOPTS}}));
  const sm=document.createElement('div'); sm.className='bp-smrow';
  sm.innerHTML=`<div class="bp-sm"><div class="bp-sl">TEMP</div><div class="bp-sv" style="color:${p.Temp>50?'#ff4560':p.Temp<-20?'#a0d8ff':'#ffd166'}">${p.Temp}°C</div></div><div class="bp-sm"><div class="bp-sl">HAB ZONE</div><div class="bp-sv" style="color:${met.tf===1?'#00ffc3':met.tf>.4?'#ffb347':'#ff4560'}">${met.tf===1?'OPTIMAL':met.tf>.4?'MARGINAL':'OUTSIDE'}</div></div><div class="bp-sm"><div class="bp-sl">ANOMALY</div><div class="bp-sv" style="color:#a0c4ff">${p.Temp>15?'+':''}${(p.Temp-15).toFixed(1)}°</div></div>`;
  el.appendChild(sm);
}

/* ── PANEL: Mineral Stability ───────────────────────── */
function _bpRenderStabilityPanel(p){
  const el=_bpPH('bp-p-stab','MINERAL STABILITY','#39d353');
  const items=[{n:'Fe',v:Math.min(100,p.Fe),c:'#ff6b47'},{n:'Ca',v:Math.min(100,p.Ca),c:'#00d4ff'},{n:'Mg',v:Math.min(100,p.Mg),c:'#b06cff'},{n:'P',v:Math.min(100,p.P*20),c:'#39d353'},{n:'S',v:Math.min(100,p.S/250),c:'#ffb347'}];
  const wrap=document.createElement('div'); wrap.style.cssText='display:flex;flex-direction:column;gap:5px;flex:1;';
  wrap.innerHTML=items.map(m=>`<div class="bp-barrow"><span style="color:#5a7a9a;width:16px">${m.n}</span><div class="bp-bt"><div class="bp-bf" style="width:${Math.round(m.v)}%;background:${m.c};box-shadow:0 0 3px ${m.c}55"></div></div><span style="color:${m.c};width:22px;text-align:right">${Math.round(m.v)}</span></div>`).join('');
  el.appendChild(wrap);
  const sm=document.createElement('div'); sm.className='bp-smrow';
  sm.innerHTML=`<div class="bp-sm"><div class="bp-sl">DIVERSITY</div><div class="bp-sv" style="color:#39d353">${[p.Fe,p.Ca,p.Mg,p.P,p.S].filter(x=>x>0).length}/5</div></div><div class="bp-sm"><div class="bp-sl">SOIL IDX</div><div class="bp-sv" style="color:#00ffc3">${((p.P*p.Ca*p.Mg)/10000).toFixed(2)}</div></div>`;
  el.appendChild(sm);
}

/* ── FOOTER ─────────────────────────────────────────── */
function _bpRenderFooter(pal){
  document.getElementById('bp-footer').innerHTML=`
    <span style="font-size:7px;color:#1e3550;letter-spacing:.1em">BIOPLANET · ECOSYSTEM v1.0 · ${pal.name}</span>
    <div style="display:flex;gap:3px">${Array.from({length:12},(_,i)=>`<div style="width:3px;height:8px;border-radius:1px;background:${i<9?pal.accent:i<11?'#ffb347':'#ff4560'};opacity:.5"></div>`).join('')}</div>
    <span style="font-size:7px;color:#1e3550;letter-spacing:.1em">Liebig + Michaelis–Menten + Lindeman</span>`;
}

/* exponer globalmente */
window.renderEcosystem   = renderEcosystem;
window.refreshBioPlanet  = refreshBioPlanet;
