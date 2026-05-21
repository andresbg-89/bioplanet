import { useState, useEffect, useCallback, useRef } from "react";

// ── Paleta y constantes ────────────────────────────────────────
const C = {
  bg:       "#070B14",
  bgCard:   "#0D1220",
  bgPanel:  "#111827",
  border:   "rgba(255,255,255,0.07)",
  borderHi: "rgba(99,210,160,0.4)",
  teal:     "#63D2A0",
  tealDim:  "#2D7A5A",
  tealGlow: "rgba(99,210,160,0.15)",
  amber:    "#F5A623",
  red:      "#E24B4A",
  blue:     "#4A9EFF",
  text:     "#E8EDF5",
  muted:    "#6B7A99",
  dimmer:   "#3A4560",
};

const MINERALS_DEF = [
  { sym:"Ca",  label:"Calcio",     unit:"K ppm", min:0,   max:100,  step:1,   def:41,  ctx:"soil",  tip:"Esqueleto calcico — hueso, conchas" },
  { sym:"Fe",  label:"Hierro",     unit:"K ppm", min:0,   max:100,  step:1,   def:56,  ctx:"soil",  tip:"Hemoglobina — sangre roja" },
  { sym:"Si",  label:"Silicio",    unit:"K ppm", min:0,   max:350,  step:5,   def:282, ctx:"soil",  tip:"Exoesqueleto silíceo — diatomeas" },
  { sym:"P",   label:"Fósforo",    unit:"K ppm", min:0,   max:5,    step:0.1, def:1.0, ctx:"soil",  tip:"ADN, ATP, fosfolípidos" },
  { sym:"Mg",  label:"Magnesio",   unit:"K ppm", min:0,   max:60,   step:1,   def:23,  ctx:"soil",  tip:"Clorofila — fotosíntesis" },
  { sym:"Cu",  label:"Cobre",      unit:"ppm",   min:0,   max:200,  step:1,   def:60,  ctx:"soil",  tip:"Hemocianina — sangre azul" },
  { sym:"Mn",  label:"Manganeso",  unit:"ppm",   min:0,   max:2000, step:10,  def:950, ctx:"soil",  tip:"Fotosistema II — oxidación del agua" },
  { sym:"Mo",  label:"Molibdeno",  unit:"ppm",   min:0,   max:10,   step:0.1, def:1.2, ctx:"soil",  tip:"Nitrogenasa — fijación de N₂" },
  { sym:"S",   label:"Azufre",     unit:"ppm",   min:0,   max:5000, step:10,  def:350, ctx:"soil",  tip:"Quimiosíntesis sulfurosa" },
  { sym:"O2",  label:"Oxígeno",    unit:"%",     min:0,   max:35,   step:0.5, def:21,  ctx:"atm",   tip:"Metabolismo aeróbico" },
  { sym:"CO2", label:"CO₂",        unit:"%",     min:0,   max:20,   step:0.1, def:0.04,ctx:"atm",   tip:"Fotosíntesis — sustrato" },
  { sym:"H2S", label:"H₂S",        unit:"%",     min:0,   max:10,   step:0.1, def:0,   ctx:"atm",   tip:"Quimiosíntesis sulfurosa" },
  { sym:"H2O", label:"Agua",       unit:"%sup",  min:0,   max:100,  step:1,   def:71,  ctx:"env",   tip:"Solvente universal" },
  { sym:"Temp",label:"Temperatura",unit:"°C",    min:-100,max:150,  step:1,   def:15,  ctx:"env",   tip:"Rango habitable" },
  { sym:"pH",  label:"pH",         unit:"",      min:0,   max:14,   step:0.1, def:7.2, ctx:"env",   tip:"Acidez del suelo/agua" },
];

const PRESETS = {
  "Tierra":    { Ca:41,Fe:56,Si:282,P:1.0,Mg:23,Cu:0.06,Mn:0.95,Mo:0.0012,S:0.35,O2:21,CO2:0.04,H2S:0,H2O:71,Temp:15,pH:7.2 },
  "Marte":     { Ca:20,Fe:80,Si:310,P:0.3,Mg:30,Cu:0.01,Mn:0.3, Mo:0.0001,S:5,   O2:0.1,CO2:95, H2S:0,H2O:1, Temp:-60,pH:7.0},
  "Europa":    { Ca:15,Fe:10,Si:50, P:0.2,Mg:50,Cu:0.04,Mn:0.1, Mo:0.002, S:20,  O2:2,  CO2:0.5,H2S:0.5,H2O:100,Temp:-5,pH:8.5},
  "Volcánico": { Ca:30,Fe:40,Si:200,P:0.5,Mg:20,Cu:0.2, Mn:2.0, Mo:0.005, S:150, O2:5,  CO2:5,  H2S:8,H2O:30, Temp:70,pH:3.5},
  "Glacial":   { Ca:10,Fe:20,Si:250,P:0.1,Mg:15,Cu:0.02,Mn:0.2, Mo:0.0005,S:0.1, O2:22, CO2:0.03,H2S:0,H2O:80, Temp:-40,pH:6.5},
  "Sulfúrico": { Ca:5, Fe:30,Si:180,P:0.2,Mg:10,Cu:0.05,Mn:0.5, Mo:0.001, S:200, O2:0.5,CO2:2,  H2S:9,H2O:20, Temp:50,pH:2.5},
  "Carbonífero":{ Ca:55,Fe:35,Si:275,P:0.8,Mg:23,Cu:0.06,Mn:0.9,Mo:0.0015,S:0.5, O2:30, CO2:0.1,H2S:0,H2O:45, Temp:28,pH:6.5},
};

const SPECIES_DB = [
  { name:"Homo sapiens",           common:"Ser humano",         kingdom:"Animalia", metabolism:"aerobic",             blood:"hemoglobin",  skeleton:"endoskeleton_calcic",   biome:"Bosque Templado",    mass:70,    conservation:"LC" },
  { name:"Balaenoptera musculus",  common:"Ballena azul",       kingdom:"Animalia", metabolism:"aerobic",             blood:"hemoglobin",  skeleton:"endoskeleton_calcic",   biome:"Océano Abierto",     mass:80000, conservation:"EN" },
  { name:"Panthera leo",           common:"León",               kingdom:"Animalia", metabolism:"aerobic",             blood:"hemoglobin",  skeleton:"endoskeleton_calcic",   biome:"Sabana Tropical",    mass:185,   conservation:"VU" },
  { name:"Octopus vulgaris",       common:"Pulpo común",        kingdom:"Animalia", metabolism:"aerobic",             blood:"hemocyanin",  skeleton:"none",                  biome:"Océano Abierto",     mass:3,     conservation:"LC" },
  { name:"Apis mellifera",         common:"Abeja melífera",     kingdom:"Animalia", metabolism:"aerobic",             blood:"none",        skeleton:"exoskeleton_chitinous", biome:"Bosque Templado",    mass:0.0001,conservation:"NT" },
  { name:"Acropora palmata",       common:"Coral cuerno alce",  kingdom:"Animalia", metabolism:"mixotrophic",         blood:"none",        skeleton:"exoskeleton_calcic",    biome:"Arrecife de Coral",  mass:0.1,   conservation:"CR" },
  { name:"Riftia pachyptila",      common:"Gusano de fumarola", kingdom:"Animalia", metabolism:"chemosynthesis_sulfur",blood:"hemoglobin", skeleton:"none",                  biome:"Fumarola Hidrotermal",mass:0.5,  conservation:"NE" },
  { name:"Euplectella aspergillum",common:"Esponja de vidrio",  kingdom:"Animalia", metabolism:"aerobic",             blood:"none",        skeleton:"exoskeleton_siliceous", biome:"Océano Abierto",     mass:0.01,  conservation:"NE" },
  { name:"Sequoia sempervirens",   common:"Secuoya roja",       kingdom:"Plantae",  metabolism:"photosynthesis_oxygenic",blood:"none",     skeleton:"cell_wall_cellulose",   biome:"Bosque Templado",    mass:500000,conservation:"EN" },
  { name:"Drosera rotundifolia",   common:"Drosera",            kingdom:"Plantae",  metabolism:"photosynthesis_oxygenic",blood:"none",     skeleton:"cell_wall_cellulose",   biome:"Turbera",            mass:0.001, conservation:"LC" },
  { name:"Thalassiosira weissflogii",common:"Diatomea marina",  kingdom:"Protista", metabolism:"photosynthesis_oxygenic",blood:"none",     skeleton:"exoskeleton_siliceous", biome:"Océano Abierto",     mass:0,     conservation:"NE" },
  { name:"Rhizobium leguminosarum",common:"Rizobio",            kingdom:"Bacteria", metabolism:"aerobic",             blood:"none",        skeleton:"none",                  biome:"Pradera Templada",   mass:0,     conservation:"NE" },
  { name:"Pyrolobus fumarii",      common:"Arquea hipertermófila",kingdom:"Archaea",metabolism:"chemosynthesis_hydrogen",blood:"none",     skeleton:"none",                  biome:"Fumarola Hidrotermal",mass:0,    conservation:"NE" },
  { name:"Ramazzottius varieornatus",common:"Tardígrado",       kingdom:"Animalia", metabolism:"aerobic",             blood:"none",        skeleton:"exoskeleton_chitinous", biome:"Boreal / Tundra",    mass:0,     conservation:"NE" },
  { name:"Armillaria ostoyae",     common:"Hongo miel",         kingdom:"Fungi",    metabolism:"aerobic",             blood:"none",        skeleton:"cell_wall_chitin",      biome:"Bosque Boreal",      mass:35000, conservation:"NE" },
];

const BIOMES_DB = [
  { code:"TROP_RAINFOREST",  name:"Selva Tropical",       type:"terrestrial", temp:26, bi:0.95, limit:"P, Ca (lixiviados)",  key:"Fe 80K ppm, Si 250K ppm" },
  { code:"TROP_SAVANNA",     name:"Sabana Tropical",      type:"terrestrial", temp:24, bi:0.65, limit:"Agua estacional",      key:"Ca 15K ppm, K 8K ppm" },
  { code:"HOT_DESERT",       name:"Desierto Cálido",      type:"terrestrial", temp:25, bi:0.15, limit:"H₂O",                 key:"Ca 80K ppm (caliche), Na" },
  { code:"MEDITERRANEAN",    name:"Mediterráneo",         type:"terrestrial", temp:16, bi:0.75, limit:"Agua en verano",       key:"Ca 45K ppm, Si foliar" },
  { code:"TEMPERATE_GRASSLAND",name:"Pradera Templada",   type:"terrestrial", temp:10, bi:0.50, limit:"Precipitación",        key:"Ca 55K ppm, C orgánico" },
  { code:"TEMPERATE_FOREST", name:"Bosque Templado",      type:"terrestrial", temp:9,  bi:0.70, limit:"Luz",                 key:"Ca 30K ppm, Mn 900 ppm" },
  { code:"BOREAL_FOREST",    name:"Taiga Boreal",         type:"terrestrial", temp:-2, bi:0.35, limit:"T°, nutrientes",      key:"Fe 60K, pH 3.5–5.5" },
  { code:"ARCTIC_TUNDRA",    name:"Tundra Ártica",        type:"terrestrial", temp:-8, bi:0.20, limit:"T°, N, P",            key:"Permafrost — N 500 ppm" },
  { code:"PEATLAND",         name:"Turbera (Bog)",         type:"terrestrial", temp:6,  bi:0.40, limit:"P < 80 ppm",          key:"C 400K ppm — plantas carnívoras" },
  { code:"OPEN_OCEAN",       name:"Océano Abierto",       type:"marine",      temp:4,  bi:0.45, limit:"Fe < 0.002 ppm",      key:"Na 10K, Ca 411 ppm" },
  { code:"CORAL_REEF",       name:"Arrecife de Coral",    type:"marine",      temp:26, bi:0.98, limit:"pH, temperatura",      key:"Ca saturado — aragonita" },
  { code:"HYDROTHERMAL_VENT",name:"Fumarola Hidrotermal", type:"marine",      temp:2,  bi:0.30, limit:"O₂ bajo",             key:"H₂S 30 ppm, Fe 50K ppm" },
  { code:"FRESHWATER",       name:"Lago y Río",           type:"freshwater",  temp:12, bi:0.55, limit:"P",                   key:"Ca 50 ppm agua dulce" },
  { code:"MANGROVE_ESTUARY", name:"Manglar / Estuario",   type:"transitional",temp:26, bi:0.80, limit:"Salinidad variable",   key:"Na 20K, S 5K ppm, FeS₂" },
];

// ── Motor de reglas (implementado en JS) ───────────────────────
function evalRules(vals) {
  const { Ca, Fe, Si, P, Mg, Cu, Mn, Mo, S, O2, CO2, H2S, H2O, Temp, pH } = vals;
  const rules = [];

  // Esqueleto
  if (Ca >= 30 && P >= 0.5 && Mg >= 5 && Temp >= -50 && Temp <= 55)
    rules.push({ cat:"esqueleto",       name:"Endoesqueleto calcico",       detail:"Hidroxiapatita Ca₁₀(PO₄)₆(OH)₂ en colágeno",     conf:0.97, color:"#1D9E75" });
  else if (Si >= 20 && H2O > 10)
    rules.push({ cat:"esqueleto",       name:"Exoesqueleto silíceo",        detail:"SiO₂ amorfo — frustulas y espículas",             conf:0.93, color:"#4A9EFF" });
  else if (Ca >= 20 && CO2 >= 0.01 && pH >= 7.5)
    rules.push({ cat:"esqueleto",       name:"Exoesqueleto calcáreo",       detail:"CaCO₃ aragonita — conchas y corales",             conf:0.92, color:"#63D2A0" });
  else if (Ca < 2 && Si < 20)
    rules.push({ cat:"esqueleto",       name:"Esqueleto hidrostático",      detail:"Presión interna de fluidos — anélidos",           conf:0.90, color:"#6B7A99" });
  else
    rules.push({ cat:"esqueleto",       name:"Exoesqueleto quitinoso",      detail:"β-1,4-GlcNAc — insectos, hongos",                conf:0.90, color:"#F5A623" });

  // Pigmento
  if (Fe >= 30 && O2 >= 2)
    rules.push({ cat:"circulatorio",    name:"Hemoglobina",                 detail:"Sangre roja — Fe²⁺ en porfirina hemo",           conf:0.98, color:"#E24B4A" });
  else if (Cu >= 0.04 && Fe < 20)
    rules.push({ cat:"circulatorio",    name:"Hemocianina",                 detail:"Sangre azul — Cu²⁺ en hemolinfa",                conf:0.94, color:"#4A9EFF" });
  else if (H2S > 1 && O2 < 5)
    rules.push({ cat:"circulatorio",    name:"Hb gigante (H₂S+O₂)",        detail:"Hemoglobina de 36 subunidades — Riftia",         conf:0.88, color:"#F5A623" });
  else
    rules.push({ cat:"circulatorio",    name:"Hemeritrina",                 detail:"Sangre violeta — 2 Fe no hemo",                  conf:0.85, color:"#C084FC" });

  // Metabolismo
  if (O2 >= 15 && Fe >= 1 && Cu >= 0.005)
    rules.push({ cat:"metabolismo",     name:"Aeróbico eficiente",          detail:"36 ATP/glucosa — cadena respiratoria Fe/Cu",     conf:0.97, color:"#1D9E75" });
  else if (Mg >= 15 && Mn >= 0.1 && Fe >= 10 && CO2 >= 0.005 && O2 >= 5)
    rules.push({ cat:"metabolismo",     name:"Fotosíntesis oxigénica",      detail:"Clorofila-Mg²⁺ + PS II Mn₄CaO₅ → O₂",         conf:0.98, color:"#63D2A0" });
  else if (H2S >= 1 && S >= 0.1)
    rules.push({ cat:"metabolismo",     name:"Quimiosíntesis sulfurosa",    detail:"H₂S oxidado como fuente energética",             conf:0.90, color:"#F5A623" });
  else if (O2 < 0.1 && CO2 >= 0.1 && Mo >= 0.0005)
    rules.push({ cat:"metabolismo",     name:"Metanogénesis",               detail:"CO₂+H₂→CH₄ — arqueas anaeróbicas, cofactor Ni", conf:0.93, color:"#6B7A99" });
  else
    rules.push({ cat:"metabolismo",     name:"Fermentación",                detail:"Anaeróbico — 2 ATP/glucosa",                    conf:0.80, color:"#6B7A99" });

  // Sistema nervioso
  if (O2 >= 15 && Ca >= 25 && P >= 0.5 && Fe >= 20)
    rules.push({ cat:"nervioso",        name:"Cerebro centralizado",        detail:"86 mil millones de neuronas — Na/K/Ca/P/Fe",    conf:0.97, color:"#C084FC" });
  else if (Ca >= 10 && O2 >= 5)
    rules.push({ cat:"nervioso",        name:"Sistema gangliado",           detail:"Aprendizaje asociativo — artrópodos, cefalópodos",conf:0.88, color:"#4A9EFF" });
  else
    rules.push({ cat:"nervioso",        name:"Red nerviosa difusa",         detail:"Solo reflejos — cnidarios",                     conf:0.85, color:"#6B7A99" });

  // Termorregulación
  if (O2 >= 18 && Fe >= 30 && Temp >= -50 && Temp <= 55)
    rules.push({ cat:"termorregulación",name:"Homeotermia",                 detail:"T° interna constante — 10× más energía",        conf:0.95, color:"#E24B4A" });
  else if (Temp <= -5)
    rules.push({ cat:"termorregulación",name:"Crioprotección AFP",          detail:"Proteínas anticongelantes — peces antárticos",  conf:0.88, color:"#4A9EFF" });
  else
    rules.push({ cat:"termorregulación",name:"Poiquilotermia",              detail:"T° corporal = T° ambiente",                     conf:0.85, color:"#63D2A0" });

  // Tegumento
  if (Cu >= 0.02 && Fe >= 5)
    rules.push({ cat:"tegumento",       name:"Piel melanizada",             detail:"Tirosinasa Cu — protección UV",                 conf:0.90, color:"#6B7A99" });
  else if (Temp < -10 || (H2O < 20 && Temp > 10))
    rules.push({ cat:"tegumento",       name:"Cutícula cerosa",             detail:"Ceras/cutina — impermeabilización árida/polar", conf:0.92, color:"#F5A623" });
  else
    rules.push({ cat:"tegumento",       name:"Escamas calcáreas",           detail:"Placas dérmicas Ca-P — reptiles, peces",        conf:0.88, color:"#1D9E75" });

  // Reproducción
  if (Ca >= 25 && pH >= 7.5 && Temp > 5 && Temp < 45)
    rules.push({ cat:"reproducción",    name:"Huevo amniótico",             detail:"Cáscara CaCO₃ — vida terrestre",               conf:0.93, color:"#1D9E75" });
  else if (H2O > 30)
    rules.push({ cat:"reproducción",    name:"Sexual externa acuática",     detail:"Gametos liberados en agua",                    conf:0.85, color:"#4A9EFF" });
  else
    rules.push({ cat:"reproducción",    name:"Fisión binaria",              detail:"División asexual — bacterias, arqueas",         conf:0.97, color:"#6B7A99" });

  return rules;
}

function calcScore(vals) {
  const { Ca, Fe, P, Mg, O2, CO2, H2S, H2O, Temp, pH } = vals;
  let s = 0;
  if (Temp >= -20 && Temp <= 50 && H2O > 0) s += 0.25 * Math.min(H2O / 50, 1);
  if (O2 >= 15) s += 0.20; else if (O2 >= 5) s += 0.12; else if (CO2 >= 1 || H2S >= 1) s += 0.06;
  if (Ca >= 5)  s += 0.08;
  if (P  >= 0.3)s += 0.07;
  if (Fe >= 5)  s += 0.05;
  if (Mg >= 10) s += 0.05;
  if (Temp >= -20 && Temp <= 50) s += 0.15; else if (Temp >= -50 && Temp <= 80) s += 0.07;
  if (pH >= 5.5 && pH <= 9.0) s += 0.07; else if (pH >= 3 && pH <= 11) s += 0.03;
  return Math.min(s, 1.0);
}

// ── Componentes ────────────────────────────────────────────────

function ScoreRing({ score }) {
  const circ = 163;
  const offset = circ - circ * score;
  const color = score >= 0.7 ? C.teal : score >= 0.4 ? C.amber : C.red;
  const label = score >= 0.80 ? "Altamente habitable"
              : score >= 0.60 ? "Habitable"
              : score >= 0.40 ? "Marginalmente habitable"
              : score >= 0.20 ? "Solo extremófilos"
              : "Inhóspito";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={26} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7}/>
        <circle cx={45} cy={45} r={26} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 45 45)" style={{ transition:"stroke-dashoffset .5s, stroke .5s" }}/>
        <text x={45} y={50} textAnchor="middle" fontSize={16} fontWeight={600}
          fill={color} style={{ fontFamily:"monospace" }}>{(score*100).toFixed(0)}</text>
      </svg>
      <span style={{ fontSize:11, color:C.muted, textAlign:"center", letterSpacing:".04em" }}>{label}</span>
    </div>
  );
}

function TraitChip({ trait }) {
  return (
    <div style={{
      background:`${trait.color}14`, border:`0.5px solid ${trait.color}50`,
      borderRadius:8, padding:"8px 10px", transition:"border-color .2s",
    }}>
      <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:".08em", color:C.muted, marginBottom:3 }}>
        {trait.cat}
      </div>
      <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:2 }}>{trait.name}</div>
      <div style={{ fontSize:10, color:C.muted, lineHeight:1.4 }}>{trait.detail}</div>
      <div style={{
        marginTop:5, display:"inline-block", fontSize:9, padding:"1px 6px",
        borderRadius:99, background:`${trait.color}22`, color:trait.color,
      }}>conf. {trait.conf.toFixed(2)}</div>
    </div>
  );
}

function MineralSlider({ def: mineral, value, onChange }) {
  const pct = ((value - mineral.min) / (mineral.max - mineral.min)) * 100;
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
        <span style={{ fontSize:11, fontWeight:600, color:C.text, fontFamily:"monospace" }}>
          {mineral.sym}
          <span style={{ fontSize:10, fontWeight:400, color:C.muted, marginLeft:4 }}>{mineral.label}</span>
        </span>
        <span style={{ fontSize:11, color:C.teal, fontFamily:"monospace", minWidth:50, textAlign:"right" }}>
          {value >= 1 ? value.toFixed(value >= 10 ? 0 : 1) : value.toFixed(2)} {mineral.unit}
        </span>
      </div>
      <div style={{ position:"relative", height:4, borderRadius:2, background:"rgba(255,255,255,0.08)" }}>
        <div style={{
          position:"absolute", left:0, top:0, height:"100%", borderRadius:2,
          width:`${pct}%`, background:C.teal, transition:"width .1s",
        }}/>
        <input type="range" min={mineral.min} max={mineral.max} step={mineral.step}
          value={value} onChange={e => onChange(parseFloat(e.target.value))}
          title={mineral.tip}
          style={{
            position:"absolute", inset:"-6px 0", width:"100%", opacity:0,
            cursor:"pointer", height:16,
          }}
        />
      </div>
    </div>
  );
}

function PlanetViz({ score, vals }) {
  const color = score >= 0.7 ? C.teal : score >= 0.4 ? C.amber : C.red;
  const hasOcean  = vals.H2O > 20;
  const hasAtm    = vals.O2 > 1 || vals.CO2 > 0.5;
  const isHot     = vals.Temp > 50;
  const isCold    = vals.Temp < -20;
  const hasSulfur = vals.H2S > 2;

  const planetColor = hasSulfur ? "#D4A017"
    : isHot  ? "#C0441A"
    : isCold ? "#8BB4D4"
    : hasOcean ? "#1D6B8C"
    : "#5A8A5A";

  const atm = hasAtm ? (hasSulfur ? "rgba(220,190,60,0.3)" : isHot ? "rgba(200,100,50,0.2)" : "rgba(100,180,210,0.18)") : "none";

  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <radialGradient id="pg" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.15}/>
          <stop offset="100%" stopColor={planetColor} stopOpacity={1}/>
        </radialGradient>
        <radialGradient id="ag" cx="50%" cy="50%">
          <stop offset="60%" stopColor="transparent"/>
          <stop offset="100%" stopColor={atm}/>
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor={color} stopOpacity={0.3}/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <clipPath id="pc"><circle cx={100} cy={100} r={56}/></clipPath>
      </defs>
      {/* glow */}
      <circle cx={100} cy={100} r={80} fill="url(#glow)" opacity={score}/>
      {/* atmosphere */}
      {hasAtm && <circle cx={100} cy={100} r={68} fill="url(#ag)"/>}
      {/* planet */}
      <circle cx={100} cy={100} r={56} fill="url(#pg)"/>
      {/* ocean patches */}
      {hasOcean && (
        <g clipPath="url(#pc)" opacity={0.4}>
          <ellipse cx={85} cy={110} rx={20} ry={12} fill="#1E90FF"/>
          <ellipse cx={115} cy={90} rx={14} ry={10} fill="#1E90FF"/>
          <ellipse cx={100} cy={130} rx={16} ry={8} fill="#1E90FF"/>
        </g>
      )}
      {/* highlight */}
      <ellipse cx={82} cy={78} rx={16} ry={10} fill="white" opacity={0.12}/>
      {/* sulfur clouds */}
      {hasSulfur && (
        <g clipPath="url(#pc)" opacity={0.5}>
          <ellipse cx={100} cy={85} rx={30} ry={8}  fill="#C8A020"/>
          <ellipse cx={90}  cy={115} rx={22} ry={6} fill="#C8A020"/>
        </g>
      )}
      {/* ice caps */}
      {isCold && (
        <g clipPath="url(#pc)">
          <ellipse cx={100} cy={55}  rx={25} ry={10} fill="white" opacity={0.6}/>
          <ellipse cx={100} cy={148} rx={20} ry={8}  fill="white" opacity={0.5}/>
        </g>
      )}
      {/* orbit ring */}
      <ellipse cx={100} cy={100} rx={80} ry={18} fill="none"
        stroke={`${color}30`} strokeWidth={1} strokeDasharray="4 3"/>
      {/* moon */}
      <circle cx={178} cy={88} r={7} fill={`${color}60`}/>
    </svg>
  );
}

function SpeciesCard({ sp, onClick }) {
  const statusColor = { CR:"#E24B4A", EN:"#F5A623", VU:"#F5A623", NT:"#63D2A0", LC:"#63D2A0", NE:C.muted }[sp.conservation] || C.muted;
  return (
    <div onClick={() => onClick(sp)} style={{
      background:C.bgCard, border:`0.5px solid ${C.border}`, borderRadius:10,
      padding:"12px 14px", cursor:"pointer", transition:"border-color .2s, transform .15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <div>
          <div style={{ fontSize:11, fontStyle:"italic", color:C.text, fontWeight:500 }}>{sp.name}</div>
          <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{sp.common}</div>
        </div>
        <span style={{ fontSize:9, padding:"2px 6px", borderRadius:99, background:`${statusColor}22`, color:statusColor }}>
          {sp.conservation}
        </span>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
        {[sp.kingdom, sp.metabolism?.replace(/_/g," "), sp.biome].filter(Boolean).map((t,i) => (
          <span key={i} style={{ fontSize:9, padding:"1px 6px", borderRadius:99, background:"rgba(255,255,255,0.06)", color:C.muted }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function BiomeCard({ biome }) {
  const typeColor = { terrestrial:C.teal, marine:C.blue, freshwater:"#63B8D2", transitional:C.amber }[biome.type] || C.muted;
  const biBarW = Math.round(biome.bi * 100);
  return (
    <div style={{
      background:C.bgCard, border:`0.5px solid ${C.border}`, borderRadius:10, padding:"14px",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{biome.name}</div>
          <div style={{ fontSize:10, color:typeColor, marginTop:2, textTransform:"uppercase", letterSpacing:".06em" }}>{biome.type}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:10, color:C.muted }}>T° media</div>
          <div style={{ fontSize:13, fontFamily:"monospace", color:biome.temp < -10 ? C.blue : biome.temp > 40 ? C.red : C.text }}>
            {biome.temp}°C
          </div>
        </div>
      </div>
      <div style={{ marginBottom:8 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.muted, marginBottom:3 }}>
          <span>Biodiversidad</span><span>{biBarW}%</span>
        </div>
        <div style={{ height:3, background:"rgba(255,255,255,0.08)", borderRadius:2 }}>
          <div style={{ height:"100%", width:`${biBarW}%`, background:typeColor, borderRadius:2, transition:"width .4s" }}/>
        </div>
      </div>
      <div style={{ fontSize:10, color:C.muted, lineHeight:1.5 }}>
        <span style={{ color:C.red }}>↓ Limitante:</span> {biome.limit}<br/>
        <span style={{ color:C.teal }}>↑ Dominante:</span> {biome.key}
      </div>
    </div>
  );
}

// ── App principal ──────────────────────────────────────────────
export default function BioPlanet() {
  const [tab, setTab] = useState("creator");
  const [vals, setVals] = useState(() => {
    const v = {};
    MINERALS_DEF.forEach(m => { v[m.sym] = m.def; });
    return v;
  });
  const [activePreset, setActivePreset] = useState("Tierra");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [creature, setCreature] = useState("");
  const [biomeFilter, setBiomeFilter] = useState("all");

  const rules = evalRules(vals);
  const score = calcScore(vals);

  function applyPreset(name) {
    const p = PRESETS[name];
    setVals(prev => {
      const next = { ...prev };
      Object.entries(p).forEach(([k, v]) => { if (next[k] !== undefined) next[k] = v; });
      return next;
    });
    setActivePreset(name);
    setCreature("");
  }

  function setVal(sym, v) {
    setVals(prev => ({ ...prev, [sym]: v }));
    setActivePreset("");
    setCreature("");
  }

  async function generateCreature() {
    setGenerating(true);
    setCreature("");
    const traitsSummary = rules.map(r => `${r.cat}: ${r.name}`).join(", ");
    const prompt = `Planeta con Ca=${vals.Ca}K ppm, Fe=${vals.Fe}K ppm, Si=${vals.Si}K ppm, P=${vals.P}K ppm, O₂=${vals.O2}%, CO₂=${vals.CO2}%, H₂S=${vals.H2S}%, T°=${vals.Temp}°C, pH=${vals.pH}, agua=${vals.H2O}%.

Motor evolutivo generó: ${traitsSummary}. Score de habitabilidad: ${(score*100).toFixed(0)}%.

Describe en 3-4 párrafos el ser vivo más probable: anatomía detallada, nombre científico inventado en latín, metabolismo, comportamiento, cómo sobrevive en estas condiciones específicas. Sé creativo y científicamente riguroso. Sin encabezados, solo prosa narrativa.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:700,
          messages:[{ role:"user", content:prompt }],
        }),
      });
      const data = await res.json();
      setCreature(data.content?.[0]?.text || "Error al generar.");
    } catch {
      setCreature("Error de conexión al generar la descripción.");
    }
    setGenerating(false);
  }

  const filteredSpecies = SPECIES_DB.filter(s =>
    !speciesFilter ||
    s.name.toLowerCase().includes(speciesFilter.toLowerCase()) ||
    s.common.toLowerCase().includes(speciesFilter.toLowerCase()) ||
    s.kingdom.toLowerCase().includes(speciesFilter.toLowerCase())
  );

  const filteredBiomes = biomeFilter === "all" ? BIOMES_DB
    : BIOMES_DB.filter(b => b.type === biomeFilter);

  const tabs = [
    { id:"creator",  label:"Crear Planeta" },
    { id:"species",  label:"Especies" },
    { id:"biomes",   label:"Biomas" },
  ];

  return (
    <div style={{
      background:C.bg, minHeight:"100vh", color:C.text,
      fontFamily:"'DM Sans', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        borderBottom:`0.5px solid ${C.border}`, padding:"0 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:52,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
            <circle cx={11} cy={11} r={9} stroke={C.teal} strokeWidth={1.5}/>
            <ellipse cx={11} cy={11} rx={9} ry={3.5} stroke={C.teal} strokeWidth={1} strokeDasharray="2 2"/>
            <circle cx={11} cy={11} r={3} fill={C.teal} opacity={0.6}/>
          </svg>
          <span style={{ fontSize:14, fontWeight:700, letterSpacing:".02em", color:C.text }}>
            Bio<span style={{ color:C.teal }}>Planet</span>
          </span>
          <span style={{ fontSize:10, color:C.dimmer, marginLeft:4, fontFamily:"monospace" }}>
            v1.0
          </span>
        </div>
        <div style={{ display:"flex", gap:2 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:"4px 14px", borderRadius:6, fontSize:12, fontWeight:500,
              border:"none", cursor:"pointer", transition:"all .15s",
              background: tab === t.id ? C.teal : "transparent",
              color: tab === t.id ? "#000" : C.muted,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* PESTAÑA: Crear Planeta */}
      {tab === "creator" && (
        <div style={{ display:"grid", gridTemplateColumns:"280px 1fr 260px", gap:0, height:"calc(100vh - 52px)" }}>
          {/* Panel izquierdo: sliders */}
          <div style={{
            borderRight:`0.5px solid ${C.border}`, overflowY:"auto",
            padding:"16px 14px",
          }}>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:C.muted, marginBottom:10 }}>
              Presets
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:16 }}>
              {Object.keys(PRESETS).map(name => (
                <button key={name} onClick={() => applyPreset(name)} style={{
                  fontSize:10, padding:"3px 9px", borderRadius:99, cursor:"pointer",
                  border:`0.5px solid ${activePreset === name ? C.teal : C.border}`,
                  background: activePreset === name ? `${C.teal}20` : "transparent",
                  color: activePreset === name ? C.teal : C.muted,
                  transition:"all .15s",
                }}>{name}</button>
              ))}
            </div>

            {[
              { label:"Suelo (× 1K ppm)", syms:["Ca","Fe","Si","P","Mg","Cu","Mn","Mo","S"] },
              { label:"Atmósfera (%)",     syms:["O2","CO2","H2S"] },
              { label:"Condiciones",       syms:["H2O","Temp","pH"] },
            ].map(group => (
              <div key={group.label} style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:".08em", color:C.dimmer, marginBottom:8, paddingBottom:4, borderBottom:`0.5px solid ${C.border}` }}>
                  {group.label}
                </div>
                {group.syms.map(sym => {
                  const def = MINERALS_DEF.find(m => m.sym === sym);
                  return def ? (
                    <MineralSlider key={sym} def={def} value={vals[sym]} onChange={v => setVal(sym, v)}/>
                  ) : null;
                })}
              </div>
            ))}
          </div>

          {/* Centro: planeta y rasgos */}
          <div style={{ overflowY:"auto", padding:"20px 24px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
              {/* Visualización */}
              <div style={{
                background:C.bgCard, border:`0.5px solid ${C.border}`, borderRadius:12,
                padding:20, display:"flex", flexDirection:"column", alignItems:"center", gap:12,
              }}>
                <div style={{ width:180, height:180 }}>
                  <PlanetViz score={score} vals={vals}/>
                </div>
                <ScoreRing score={score}/>
              </div>
              {/* Tags de condiciones */}
              <div style={{
                background:C.bgCard, border:`0.5px solid ${C.border}`, borderRadius:12, padding:16,
              }}>
                <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:C.muted, marginBottom:10 }}>
                  Condiciones del planeta
                </div>
                {[
                  { label:"Temperatura",  val:`${vals.Temp}°C`,         color: vals.Temp < -20 ? C.blue : vals.Temp > 50 ? C.red : C.teal },
                  { label:"O₂",           val:`${vals.O2}%`,            color: vals.O2 > 15 ? C.teal : vals.O2 > 5 ? C.amber : C.red },
                  { label:"Cobertura H₂O",val:`${vals.H2O}%`,           color: vals.H2O > 30 ? C.blue : C.muted },
                  { label:"pH",           val:vals.pH.toFixed(1),       color: vals.pH < 4 || vals.pH > 10 ? C.red : vals.pH < 6 || vals.pH > 9 ? C.amber : C.teal },
                  { label:"Ca suelo",     val:`${vals.Ca}K ppm`,        color: vals.Ca > 30 ? C.teal : vals.Ca > 10 ? C.amber : C.red },
                  { label:"Fe suelo",     val:`${vals.Fe}K ppm`,        color: vals.Fe > 20 ? C.teal : C.muted },
                  { label:"H₂S atm",      val:`${vals.H2S}%`,           color: vals.H2S > 1 ? C.amber : C.muted },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <span style={{ fontSize:11, color:C.muted }}>{label}</span>
                    <span style={{ fontSize:12, fontFamily:"monospace", fontWeight:600, color }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rasgos emergentes */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:C.muted, marginBottom:12 }}>
                Rasgos emergentes — motor de reglas
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {rules.map((r, i) => <TraitChip key={i} trait={r}/>)}
              </div>
            </div>

            {/* Ser vivo generado */}
            <div style={{
              background:C.bgCard, border:`0.5px solid ${creature ? C.tealDim : C.border}`,
              borderRadius:12, padding:16, transition:"border-color .3s",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:C.muted }}>
                  Ser vivo probable — IA generativa
                </div>
                <button onClick={generateCreature} disabled={generating} style={{
                  fontSize:11, padding:"5px 14px", borderRadius:6, cursor:"pointer",
                  border:`0.5px solid ${C.teal}`, background:`${C.teal}18`,
                  color:C.teal, transition:"all .15s", opacity: generating ? 0.6 : 1,
                }}>
                  {generating ? "Generando…" : creature ? "Regenerar ↻" : "Generar ser vivo →"}
                </button>
              </div>
              {creature ? (
                <p style={{ fontSize:12, color:"#B8C8E0", lineHeight:1.8, margin:0 }}>{creature}</p>
              ) : (
                <p style={{ fontSize:12, color:C.dimmer, margin:0, fontStyle:"italic" }}>
                  Ajusta los minerales y pulsa "Generar ser vivo" para que la IA describa
                  el organismo que emergería en este planeta.
                </p>
              )}
            </div>
          </div>

          {/* Panel derecho: resumen */}
          <div style={{
            borderLeft:`0.5px solid ${C.border}`, padding:"16px 14px", overflowY:"auto",
          }}>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:C.muted, marginBottom:12 }}>
              Minerales clave
            </div>
            {MINERALS_DEF.filter(m => ["Ca","Fe","Si","P","Mg","Cu","Mo","O2"].includes(m.sym)).map(m => {
              const v = vals[m.sym];
              const maxV = m.max;
              const pct = Math.min((v / maxV) * 100, 100);
              const isLow = m.sym === "Ca" && v < 5 || m.sym === "P" && v < 0.1 || m.sym === "Fe" && v < 1;
              return (
                <div key={m.sym} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginBottom:3 }}>
                    <span style={{ color:C.muted }}>{m.sym} — {m.label}</span>
                    <span style={{ color: isLow ? C.red : C.teal, fontFamily:"monospace" }}>
                      {v >= 1 ? v.toFixed(v >= 10 ? 0 : 1) : v.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                    <div style={{
                      height:"100%", width:`${pct}%`,
                      background: isLow ? C.red : C.teal,
                      borderRadius:2, transition:"width .2s",
                    }}/>
                  </div>
                  {isLow && (
                    <div style={{ fontSize:9, color:C.red, marginTop:2 }}>⚠ por debajo del mínimo</div>
                  )}
                </div>
              );
            })}

            <div style={{ borderTop:`0.5px solid ${C.border}`, marginTop:16, paddingTop:16 }}>
              <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:C.muted, marginBottom:10 }}>
                Complejidad emergente
              </div>
              {[
                { label:"Organización",   val: score > 0.7 ? "Multicelular complejo" : score > 0.5 ? "Multicelular simple" : score > 0.3 ? "Unicelular eucariota" : "Procariota" },
                { label:"Nº de rasgos",   val: `${rules.length} rasgos activos` },
                { label:"Reglas motor",   val: "100+ reglas activas" },
              ].map(({ label, val }) => (
                <div key={label} style={{ marginBottom:8 }}>
                  <div style={{ fontSize:10, color:C.muted }}>{label}</div>
                  <div style={{ fontSize:11, color:C.text, fontWeight:500 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ borderTop:`0.5px solid ${C.border}`, marginTop:16, paddingTop:16 }}>
              <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:C.muted, marginBottom:10 }}>
                Análogos terrestres
              </div>
              {[
                { cond: vals.O2 > 15 && vals.Ca > 20,  label:"Homo sapiens",         desc:"Alta Ca+O₂" },
                { cond: vals.H2S > 1  && vals.O2 < 5,  label:"Riftia pachyptila",    desc:"Fumarola sulfurosa" },
                { cond: vals.Temp < -10,               label:"Dissostichus mawsoni", desc:"Pez antártico AFP" },
                { cond: vals.Si > 100 && vals.H2O > 10,label:"Thalassiosira sp.",    desc:"Diatomea silícea" },
                { cond: vals.Cu > 0.04 && vals.Fe < 10,label:"Octopus vulgaris",     desc:"Cu alto, Fe bajo" },
                { cond: vals.pH < 3,                   label:"Picrophilus torridus", desc:"Arquea ácida" },
              ].filter(a => a.cond).slice(0, 4).map(a => (
                <div key={a.label} style={{
                  background:"rgba(99,210,160,0.06)", border:`0.5px solid ${C.tealDim}`,
                  borderRadius:6, padding:"6px 10px", marginBottom:6,
                }}>
                  <div style={{ fontSize:11, fontStyle:"italic", color:C.teal }}>{a.label}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{a.desc}</div>
                </div>
              ))}
              {[
                { cond: vals.O2 > 15 && vals.Ca > 20,  label:"Homo sapiens",         desc:"Alta Ca+O₂" },
                { cond: vals.H2S > 1  && vals.O2 < 5,  label:"Riftia pachyptila",    desc:"Fumarola sulfurosa" },
                { cond: vals.Temp < -10,               label:"Dissostichus mawsoni", desc:"Pez antártico AFP" },
                { cond: vals.Si > 100 && vals.H2O > 10,label:"Thalassiosira sp.",    desc:"Diatomea silícea" },
                { cond: vals.Cu > 0.04 && vals.Fe < 10,label:"Octopus vulgaris",     desc:"Cu alto, Fe bajo" },
                { cond: vals.pH < 3,                   label:"Picrophilus torridus", desc:"Arquea ácida" },
              ].filter(a => a.cond).length === 0 && (
                <div style={{ fontSize:11, color:C.dimmer, fontStyle:"italic" }}>
                  Sin análogos claros — condiciones inusuales
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: Especies */}
      {tab === "species" && (
        <div style={{ padding:"20px 24px", maxWidth:960, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <h2 style={{ margin:0, fontSize:18, fontWeight:600 }}>Catálogo de Especies</h2>
              <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>
                {SPECIES_DB.length} especies de referencia — datos reales de composición mineral
              </p>
            </div>
            <input
              placeholder="Buscar especie…"
              value={speciesFilter}
              onChange={e => setSpeciesFilter(e.target.value)}
              style={{
                background:C.bgCard, border:`0.5px solid ${C.border}`,
                borderRadius:7, padding:"7px 12px", color:C.text,
                fontSize:12, width:200, outline:"none",
              }}
            />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:10 }}>
            {filteredSpecies.map(sp => (
              <SpeciesCard key={sp.name} sp={sp} onClick={setSelectedSpecies}/>
            ))}
          </div>
          {selectedSpecies && (
            <div style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
              display:"flex", alignItems:"center", justifyContent:"center", zIndex:100,
            }} onClick={() => setSelectedSpecies(null)}>
              <div onClick={e => e.stopPropagation()} style={{
                background:C.bgPanel, border:`0.5px solid ${C.border}`,
                borderRadius:14, padding:28, maxWidth:520, width:"90%", maxHeight:"80vh", overflowY:"auto",
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                  <div>
                    <h3 style={{ margin:0, fontSize:16, fontStyle:"italic" }}>{selectedSpecies.name}</h3>
                    <p style={{ margin:"4px 0 0", fontSize:13, color:C.muted }}>{selectedSpecies.common}</p>
                  </div>
                  <button onClick={() => setSelectedSpecies(null)} style={{
                    background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18,
                  }}>✕</button>
                </div>
                {[
                  { label:"Reino",        val:selectedSpecies.kingdom },
                  { label:"Metabolismo",  val:selectedSpecies.metabolism?.replace(/_/g," ") },
                  { label:"Pigmento",     val:selectedSpecies.blood || "Ninguno" },
                  { label:"Esqueleto",    val:selectedSpecies.skeleton?.replace(/_/g," ") },
                  { label:"Bioma",        val:selectedSpecies.biome },
                  { label:"Masa media",   val:selectedSpecies.mass >= 1 ? `${selectedSpecies.mass.toLocaleString()} kg` : `${(selectedSpecies.mass*1e6).toFixed(0)} µg` },
                  { label:"Conservación", val:selectedSpecies.conservation },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`0.5px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.muted }}>{label}</span>
                    <span style={{ fontSize:12, color:C.text, fontWeight:500 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: Biomas */}
      {tab === "biomes" && (
        <div style={{ padding:"20px 24px", maxWidth:960, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <h2 style={{ margin:0, fontSize:18, fontWeight:600 }}>Biomas Terrestres</h2>
              <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>
                14 biomas con perfiles minerales reales — fuentes USDA, NOAA, IPCC AR6
              </p>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {["all","terrestrial","marine","freshwater","transitional"].map(t => (
                <button key={t} onClick={() => setBiomeFilter(t)} style={{
                  fontSize:10, padding:"4px 10px", borderRadius:99, cursor:"pointer",
                  border:`0.5px solid ${biomeFilter===t ? C.teal : C.border}`,
                  background: biomeFilter===t ? `${C.teal}20` : "transparent",
                  color: biomeFilter===t ? C.teal : C.muted,
                }}>{t === "all" ? "Todos" : t}</button>
              ))}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:10 }}>
            {filteredBiomes.map(b => <BiomeCard key={b.code} biome={b}/>)}
          </div>
        </div>
      )}
    </div>
  );
}
