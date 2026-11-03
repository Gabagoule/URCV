/* =====================================================================
   protocoles/scores.js — Scores et calculs (version mobile)
   Repris de scores.js (annuaire) : pour l'instant clairance de la
   créatinine (recueil urinaire, U et P en µmol/L) et EuroSCORE II.
   Les autres scores (SAVE, IABP-SHOCK II, HScore, Thakar, KDIGO) se
   rajoutent dans SCORES ci-dessous, sur le même modèle.

   Chaque score : { id, titre, resume, ref?, formule?, items[], calc(st) }
   Types d'items :
     num  : saisie numérique (virgule acceptée)       → st[k] = nombre | null
     seg  : contrôle segmenté, opts [[libellé, pts]]   → st[k] = index | null
     sel  : menu (roue iOS), opts [[libellé, pts]]     → st[k] = index | null
     bool : interrupteur, pts                          → st[k] = true | false
   calc(st) renvoie { miss: [...] } s'il manque des données, sinon
   { val, unit, label, lvl ("ok" | "warn" | "bad" | ""), sub }.
   Tous les scores sont repliés par défaut ; le résultat reste visible
   dans la pastille de l'en-tête.
   ===================================================================== */
(() => {
"use strict";
const { ui } = window.URCV;

ui.css("sc", `
.sc-head{display:flex;align-items:center;gap:12px;width:100%;padding:18px 16px 18px 18px;border:0;background:none;text-align:left;cursor:pointer;transition:background .2s}
.sc-head:active{background:var(--fill)}
.sc-ht{flex:1;min-width:0}
.sc-ht b{display:block;font:600 19px/1.25 var(--serif)}
.sc-ht small{display:block;font-size:13px;color:var(--ink2);margin-top:3px}
.sc-chev{color:var(--ink);font-size:16px;transition:transform .3s var(--ease)}
.sc-card.open .sc-chev{transform:rotate(90deg)}
.sc-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .34s var(--ease)}
.sc-card.open .sc-body{grid-template-rows:1fr}
.sc-body > div{overflow:hidden}
.sc-in{border-top:1px solid var(--line)}
.sc-desc{font:italic 14px/1.45 var(--serif);color:var(--ink2);padding:14px 18px 4px}
.sc-res{--c:var(--ink);padding:18px;border-top:1px solid var(--line)}
.sc-res.ok{--c:var(--green)} .sc-res.warn{--c:var(--orange)} .sc-res.bad{--c:var(--red)}
.sc-val{display:flex;align-items:baseline;gap:7px}
.sc-val b{font:600 40px/1 var(--serif);font-variant-numeric:tabular-nums}
.sc-val span{font-size:15px;color:var(--ink2)}
.sc-lab{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase}
.sc-lab::before{content:"";flex:none;width:7px;height:7px;background:var(--c)}
.sc-res.vide .sc-lab{margin:0;font:italic 14px var(--serif);letter-spacing:0;text-transform:none;color:var(--ink2)}
.sc-res.vide .sc-lab::before{display:none}
.sc-sub{font-size:13px;color:var(--ink2);margin-top:5px;line-height:1.45}
.sc-ref{font-size:11.5px;color:var(--ink3);padding:0 18px 16px;line-height:1.45}
`);

/* ---------------- définitions ---------------- */
const SCORES = [
  /* ---------- clairance mesurée sur recueil urinaire ---------- */
  {
    id: "clcr",
    titre: "Clairance de la créatinine",
    resume: "Mesurée sur la diurèse des 24 h",
    formule: "Clairance = (U × V) / (P × 1440) — U et P en µmol/L, V en mL/24 h",
    items: [
      { k: "u", type: "num", label: "Créat. urinaire (U)", unit: "µmol/L" },
      { k: "v", type: "num", label: "Diurèse 24 h (V)", unit: "mL" },
      { k: "p", type: "num", label: "Créat. plasmatique (P)", unit: "µmol/L" }
    ],
    calc(st) {
      const miss = [];
      if (st.u == null) miss.push("U");
      if (st.v == null) miss.push("V");
      if (st.p == null) miss.push("P");
      if (miss.length) return { miss };
      if (st.p <= 0) return { miss: ["P > 0"] };
      const cl = (st.u * st.v) / (st.p * 1440);
      let label, lvl;
      if (cl >= 90)      { label = "Normale"; lvl = "ok"; }
      else if (cl >= 60) { label = "Diminution légère"; lvl = "ok"; }
      else if (cl >= 30) { label = "Diminution modérée"; lvl = "warn"; }
      else if (cl >= 15) { label = "Diminution sévère"; lvl = "bad"; }
      else               { label = "Insuffisance rénale terminale"; lvl = "bad"; }
      return { val: ui.fmt(cl, 0), unit: "mL/min", label, lvl,
               sub: "Recueil incomplet = clairance sous-estimée. Non indexée sur la surface corporelle." };
    }
  },

  /* ---------- EuroSCORE II ---------- */
  {
    id: "euro2",
    titre: "EuroSCORE II",
    resume: "Mortalité hospitalière après chirurgie cardiaque",
    ref: "Nashef SAM et al. Eur J Cardiothorac Surg 2012;41:734-45 — clairance de Cockcroft-Gault calculée à partir de l'âge, du poids, du sexe et de la créatinine.",
    items: [
      { k: "age", type: "num", label: "Âge", unit: "ans" },
      { k: "poids", type: "num", label: "Poids", unit: "kg" },
      { k: "creat", type: "num", label: "Créatinine", unit: "µmol/L" },
      { k: "sexe", type: "seg", label: "Sexe", opts: [["Homme", 0], ["Femme", 0.2196434]] },
      { k: "nyha", type: "seg", label: "NYHA", def: 0, opts: [["I", 0], ["II", 0.1070545], ["III", 0.2958358], ["IV", 0.5597929]] },
      { k: "fevg", type: "seg", label: "FEVG", def: 0, opts: [["> 50 %", 0], ["31–50", 0.3150652], ["21–30", 0.8084096], ["≤ 20", 0.9346919]] },
      { k: "htap", type: "seg", label: "PAP systolique (mmHg)", def: 0, opts: [["< 31", 0], ["31–55", 0.1788899], ["> 55", 0.3491475]] },
      { k: "urg", type: "sel", label: "Urgence", def: 0, opts: [["Programmée", 0], ["Urgente", 0.3174673], ["Urgence", 0.7039121], ["Sauvetage", 1.362947]] },
      { k: "geste", type: "sel", label: "Poids de l'intervention", def: 0,
        opts: [["PAC isolé", 0], ["1 geste non-PAC", 0.0062118], ["2 gestes", 0.5521478], ["3 gestes ou plus", 0.9724533]] },
      { k: "dial", type: "bool", pts: 0, label: "Dialyse chronique" },
      { k: "artere", type: "bool", pts: 0.5360268, label: "Artériopathie extracardiaque",
        hint: "Claudication, sténose carotide > 50 %, amputation, chirurgie aorte abdominale / carotide / membres" },
      { k: "mobil", type: "bool", pts: 0.2407181, label: "Mobilité réduite", hint: "Atteinte musculo-squelettique ou neurologique sévère" },
      { k: "redux", type: "bool", pts: 1.118599, label: "Chirurgie cardiaque antérieure" },
      { k: "bpco", type: "bool", pts: 0.1886564, label: "Pathologie pulmonaire chronique", hint: "Bronchodilatateurs ou corticoïdes au long cours" },
      { k: "endo", type: "bool", pts: 0.6194522, label: "Endocardite active" },
      { k: "crit", type: "bool", pts: 1.086517, label: "État préopératoire critique",
        hint: "TV/FV ou mort subite récupérée, MCE, ventilation avant le bloc, inotropes ou BCPIA, IRA oligo-anurique" },
      { k: "insul", type: "bool", pts: 0.3542749, label: "Diabète insulinotraité" },
      { k: "ccs4", type: "bool", pts: 0.2226147, label: "Angor CCS 4" },
      { k: "idm", type: "bool", pts: 0.1528943, label: "Infarctus ≤ 90 jours" },
      { k: "aorte", type: "bool", pts: 0.6527205, label: "Chirurgie de l'aorte thoracique" }
    ],
    calc(st, sc) {
      const miss = [];
      if (st.age == null) miss.push("âge");
      if (st.sexe == null) miss.push("sexe");
      if (!st.dial) {
        if (st.poids == null) miss.push("poids");
        if (st.creat == null) miss.push("créatinine");
      }
      if (miss.length) return { miss };
      if (!st.dial && st.creat <= 0) return { miss: ["créatinine > 0"] };

      let y = -5.324537 + somme(sc, st);
      const age = st.age;
      y += 0.0285181 * (age <= 60 ? 1 : age - 59);

      let sub;
      if (st.dial) {
        y += 0.6421508;
        sub = "Dialyse chronique (quelle que soit la clairance)";
      } else {
        const cc = (140 - age) * st.poids * (st.sexe === 1 ? 0.85 : 1) / (72 * st.creat / 88.4);
        y += cc <= 50 ? 0.8592256 : cc <= 85 ? 0.303553 : 0;
        sub = `Clairance de Cockcroft-Gault : ${ui.fmt(Math.max(cc, 0), 0)} mL/min`;
      }
      const p = 100 / (1 + Math.exp(-y));
      return { val: ui.fmt(p, 2), unit: "%", label: "Mortalité hospitalière prédite", lvl: "", sub };
    }
  }
];

// somme des points des items seg / sel / bool
function somme(sc, st) {
  let t = 0;
  sc.items.forEach(it => {
    const v = st[it.k];
    if ((it.type === "seg" || it.type === "sel") && v != null) t += it.opts[v][1];
    else if (it.type === "bool" && v) t += it.pts;
  });
  return t;
}

/* ---------------- rendu ---------------- */
function itemHTML(sc, it) {
  const name = `${sc.id}.${it.k}`;
  if (it.type === "num") return ui.numRow(name, it.label, it.unit || "");
  if (it.type === "bool") return ui.swRow(name, it.label, false, it.hint || "");
  const opts = it.opts.map(([lab], i) => [String(i), lab]);
  const def = it.def != null ? String(it.def) : null;
  if (it.type === "sel") return ui.selRow(name, it.label, opts, def);
  // valeur par défaut → toujours une option choisie (re-toucher n'efface pas)
  const seg = ui.seg(name, opts, def).replace('class="u-seg', `${def != null ? "data-fixed " : ""}class="u-seg`);
  return `<div class="u-li u-li-col"><div class="u-f-l" style="margin:0 0 0 1px">${it.label}</div>${seg}</div>`;
}

function render(root) {
  const etats = {};
  SCORES.forEach(sc => {
    const st = {};
    sc.items.forEach(it => { st[it.k] = it.type === "bool" ? false : it.def != null ? it.def : null; });
    etats[sc.id] = st;
  });

  root.innerHTML = SCORES.map(sc => `
    <div class="u-card sc-card" data-sc="${sc.id}" style="padding:0">
      <button type="button" class="sc-head" aria-expanded="false">
        <span class="sc-ht"><b>${sc.titre}</b><small>${sc.resume}</small></span>
        ${ui.pill("—")}
        <svg class="sc-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5l6.5 6.5L9 18.5"/></svg>
      </button>
      <div class="sc-body"><div>
        <div class="sc-in">
          ${sc.formule ? `<div class="sc-desc">${sc.formule}</div>` : ""}
          <div class="u-list flat">${sc.items.map(it => itemHTML(sc, it)).join("")}</div>
          <div class="sc-res vide"></div>
          ${sc.ref ? `<div class="sc-ref">${sc.ref}</div>` : ""}
        </div>
      </div></div>
    </div>`).join("") +
    `<p class="u-foot">Les autres scores de l'annuaire (SAVE, IABP-SHOCK II, HScore, Thakar, KDIGO) seront ajoutés ici.</p>`;

  function maj(id) {
    const sc = SCORES.find(s => s.id === id);
    const card = root.querySelector(`.sc-card[data-sc="${id}"]`);
    const r = sc.calc(etats[id], sc);
    const res = card.querySelector(".sc-res");
    const pill = card.querySelector(".sc-head .u-pill");
    if (r.miss) {
      res.className = "sc-res vide";
      res.innerHTML = `<div class="sc-lab">À renseigner : ${r.miss.join(", ")}</div>`;
      pill.className = "u-pill"; pill.textContent = "—";
      return;
    }
    res.className = "sc-res " + (r.lvl || "");
    res.innerHTML = `<div class="sc-val"><b>${r.val}</b><span>${r.unit}</span></div>
      <div class="sc-lab">${r.label}</div>${r.sub ? `<div class="sc-sub">${r.sub}</div>` : ""}`;
    pill.className = "u-pill " + ({ ok: "green", warn: "orange", bad: "red" }[r.lvl] || "blue");
    pill.textContent = `${r.val} ${r.unit}`;
  }

  // déplier / replier
  root.addEventListener("click", e => {
    const h = e.target.closest(".sc-head");
    if (!h) return;
    const card = h.closest(".sc-card");
    const ouvert = card.classList.toggle("open");
    h.setAttribute("aria-expanded", String(ouvert));
  });

  const pose = (name, v) => {
    const [id, k] = name.split(".");
    etats[id][k] = v;
    maj(id);
  };
  ui.onNum(root, (name, v) => pose(name, v));
  ui.onSw(root, (name, on) => pose(name, on));
  ui.onSel(root, (name, v) => pose(name, v == null ? null : +v));
  ui.onSeg(root, (name, v) => pose(name, v == null ? null : +v));

  SCORES.forEach(sc => maj(sc.id));
}

window.URCV.register({
  id: "scores",
  titre: "Scores et calculs",
  court: "Scores",
  sous: "Clairance de la créatinine · EuroSCORE II",
  cat: "Scores",
  couleur: "indigo",
  icone: "calc",
  mots: "score calcul clairance créatinine creat urinaire euroscore euro chirurgie cardiaque mortalité cockcroft",
  render
});
})();
