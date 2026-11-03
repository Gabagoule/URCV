/* =====================================================================
   protocoles/ilc.js — Infections liées aux cathéters (version mobile)
   Arbre diagnostique selon E. PILLY 2025 (logigramme F17-1),
   KT veineux central ou artériel — repris de infection_kt.js (annuaire).

   Deux situations de départ, chacune avec sa propre branche
   (rien n'est mis en commun entre les deux) :
     A. Sepsis / choc septique inexpliqué ou pus / tunnellite
        → KT retiré d'emblée → 3 critères à toucher :
          culture KT (+ / − / non réalisée), hémoc périph (+ / −),
          amélioration après ablation (oui / non) — toujours cliquable,
          ne tranche que si la culture n'a pas été faite et hémoc −
     B. Fièvre isolée chez un porteur de KT central
        → hémocultures couplées : positive / négative + délai de
          positivité (h, min) → DTP = délai périph − délai KT

   Adaptations URCV :
     - DTP seul (pas de ratio quantitatif)
     - voie B : bactériémie liée au KT → ablation du KT systématique
       (branches « type de germe » et « courte / longue durée » supprimées)
     - SCN : 7 j ; pas de stratégie conservative
   ===================================================================== */
(() => {
"use strict";
const { ui } = window.URCV;

ui.css("ilc", `
.ilc-starts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ilc-start{--c:var(--blue);display:flex;flex-direction:column;align-items:flex-start;gap:9px;padding:13px 13px 14px;border-radius:20px;text-align:left;cursor:pointer;
  background:var(--glass);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);
  border:.5px solid var(--hair);box-shadow:inset 0 1px 0 var(--hi), var(--shadow);
  transition:opacity .25s, transform .15s, background .25s, box-shadow .25s}
.ilc-start:active{transform:scale(.97)}
.ilc-start .tile{width:32px;height:32px;border-radius:9px;font-size:18px}
.ilc-start b{font-size:15px;line-height:1.25;font-weight:650}
.ilc-start small{font-size:13px;line-height:1.3;color:var(--ink2);margin-top:-5px}
.ilc-start.on{background:color-mix(in srgb, var(--c) 11%, var(--glass));box-shadow:inset 0 0 0 1.5px var(--c), var(--shadow)}
.ilc.choisi .ilc-start:not(.on){opacity:.5}
.ilc-voie{animation:u-rise .3s ease-out}
/* la 1re ligne part du centre de la carte choisie */
.ilc-voie > .u-flow:first-child > .u-link:first-child{margin-right:auto}
.ilc-voie[data-v="A"] > .u-flow:first-child > .u-link:first-child{margin-left:calc((100% - 10px) / 4 - 1px)}
.ilc-voie[data-v="B"] > .u-flow:first-child > .u-link:first-child{margin-left:calc(75% + 2.5px - 1px)}
.ilc-voie[hidden]{display:none}
.ilc-pick{margin:18px 4px 0;text-align:center;color:var(--ink2);font-size:14px}
.ilc.choisi .ilc-pick{display:none}

/* hémocultures couplées */
.ilc-hc + .ilc-hc{margin-top:16px;padding-top:14px;border-top:.5px solid var(--hair)}
.ilc-ttp{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease, opacity .25s;opacity:0}
.ilc-ttp.on{grid-template-rows:1fr;opacity:1}
.ilc-ttp > div{overflow:hidden}
.ilc-ttp-in{display:flex;align-items:center;gap:7px;padding-top:10px;font-size:14px;color:var(--ink2)}
.ilc-ttp-in label{flex:1}
.ilc-ttp input{width:54px;height:38px;border:0;border-radius:11px;background:var(--fill);color:var(--ink);text-align:center;
  font:17px var(--font);font-variant-numeric:tabular-nums;outline:none}
.ilc-ttp input:focus{box-shadow:0 0 0 2px var(--blue)}
.ilc-ttp input::placeholder{color:var(--ink3)}

/* jauge DTP */
.ilc-dtp{--c:var(--ink3);margin-top:16px;padding-top:13px;border-top:.5px solid var(--hair)}
.ilc-dtp[hidden]{display:none}
.ilc-dtp-l{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.ilc-dtp-l span{font-size:13px;color:var(--ink2)}
.ilc-dtp-l b{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--c);transition:color .25s}
.ilc-track{position:relative;height:6px;border-radius:3px;background:var(--fill);margin:10px 0 5px}
.ilc-track i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--c);width:var(--w,0%);transition:width .35s cubic-bezier(.3,1.1,.5,1), background .25s}
.ilc-track em{position:absolute;left:50%;top:-4px;bottom:-4px;width:2px;margin-left:-1px;border-radius:1px;background:var(--ink2)}
.ilc-scale{display:flex;justify-content:space-between;font-size:11px;color:var(--ink3);font-variant-numeric:tabular-nums}
.ilc-scale span:nth-child(2){color:var(--ink2);font-weight:600}
`);

/* ---------------- cadres de fin de branche « bactériémie liée au KT » ---------------- */
const ATB = () => ui.node({
  tone: "green", titre: "ATB systémique", sous: "à compter de la 1<sup>re</sup> hémoc négative",
  corps: ui.durees([["BGN", "7 j"], ["SCN", "7 j"], ["<i>S. aureus</i>", "14 j"], ["Levures", "14 j"]]) +
         `<div class="u-node-n">ETT si <i>S. aureus</i> / <i>Candida</i></div>`
});
const SUIVI = () => ui.node({
  tone: "teal", titre: "Sepsis ou hémoc + &gt; 3 j", sous: "Doppler + ETO (≥ 5–7 j)",
  corps: ui.durees([["Endocardite", "4–6 sem"], ["Thrombophlébite", "3–4 sem"], ["Ostéomyélite", "6 sem"]], "ATB si")
});
const AUTRE_GERME = "bactériémie à interpréter selon le germe et le nombre d'hémocultures positives";

/* ---------------- voie A : sepsis / choc (KT retiré d'emblée) ---------------- */
const RES_A = {
  // culture KT − · hémoc −
  a0:   () => [ui.node({ dx: true, tone: "grey", titre: "Pas d'infection liée au KT", sous: "Autre cause +++" })],
  // culture non réalisée · hémoc − · pas d'amélioration
  a0nr: () => [ui.node({ dx: true, tone: "grey", titre: "Pas d'argument pour une infection liée au KT", sous: "Autre cause +++" })],
  // (culture KT + ou, culture non réalisée, amélioration) · hémoc −
  a1:   () => [
    ui.node({ dx: true, tone: "orange", titre: "Infection liée au KT sans bactériémie" }),
    ui.node({ tone: "green", titre: "Durée de traitement à voir", sous: "selon clinique, germe et terrain" })
  ],
  // culture KT + · hémoc +  (KT déjà retiré : pas de seconde ablation)
  a2:   () => [ui.node({ dx: true, tone: "red", titre: "Bactériémie liée au KT" }), ATB(), SUIVI()],
  // culture KT − · hémoc +
  np:   () => [ui.node({ dx: true, tone: "yellow", titre: "Chercher une autre cause", sous: AUTRE_GERME })],
  // culture non réalisée · hémoc +
  nrp:  () => [ui.node({ dx: true, tone: "yellow", titre: "Bactériémie, lien avec le KT non documenté",
                         sous: "culture KT non réalisée · " + AUTRE_GERME })]
};

function evalA(a) {
  if (a.kt === null && a.hc === null) return { aide: "Renseigner la culture du KT et les hémocultures" };
  if (a.kt === null) return { aide: "Renseigner la culture du KT" };
  if (a.hc === null) return { aide: "Renseigner les hémocultures périphériques" };
  if (a.hc === "+") return { cle: a.kt === "+" ? "a2" : a.kt === "-" ? "np" : "nrp" };
  // hémocultures négatives
  if (a.kt === "+") return { cle: "a1" };
  if (a.kt === "-") return { cle: "a0" };
  // culture non réalisée : l'amélioration après ablation tranche
  if (a.am === "oui") return { cle: "a1" };
  if (a.am === "non") return { cle: "a0nr" };
  return { aide: "Culture non réalisée : renseigner l'amélioration après ablation" };
}

/* ---------------- voie B : fièvre isolée, porteur de KT ---------------- */
const RES_B = {
  blc:   () => [
    ui.node({ dx: true, tone: "red", titre: "Bactériémie liée au KT", sous: "DTP ≥ 2 h" }),
    ui.node({ tone: "blue", titre: "Ablation du KT" }),
    ATB(), SUIVI()
  ],
  autre: () => [ui.node({ dx: true, tone: "yellow", titre: "Bactériémie d'une autre origine ?", sous: "DTP &lt; 2 h",
                          corps: `<div class="u-warn"><i>S. aureus</i>, <i>Candida</i> : DTP peu fiable (DTP &lt; 2 h = mauvaise VPN)</div>` })],
  dx3:   () => [ui.node({ dx: true, tone: "purple", titre: "3 diagnostics possibles", sous: "Hémoc KT + / périph −",
                          corps: `<ul class="u-ul">
                            <li><b>Contamination</b><span>1–2 flacons +, flore cutanée</span></li>
                            <li><b>Colonisation du KT</b><span>multiples flacons +</span></li>
                            <li><b>Infection liée au KT probable</b><span>multiples flacons + et fièvre inexpliquée → traiter comme une bactériémie liée au KT</span></li>
                          </ul>` })],
  neg:   () => [ui.node({ dx: true, tone: "grey", titre: "Pas de bactériémie" })],
  hp:    () => [ui.node({ dx: true, tone: "yellow", titre: "Raisonner selon le germe", sous: "et le nombre d'hémocultures positives · hémoc périph + / KT −" })]
};

// délai de positivité en minutes (null si non saisi ou invalide)
function ttp(x) {
  if (x.pos !== true || (x.h === "" && x.m === "")) return null;
  const h = x.h === "" ? 0 : +x.h, m = x.m === "" ? 0 : +x.m;
  if (!(m >= 0 && m < 60)) return null;
  return h * 60 + m;
}
const fmtMin = min => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

function evalB(b) {
  const c = b.c.pos, p = b.p.pos;
  if (c === null && p === null) return { aide: "Renseigner les deux hémocultures" };
  if (c === null) return { aide: "Renseigner l'hémoculture KT" };
  if (p === null) return { aide: "Renseigner l'hémoculture périphérique" };
  if (c && p) {
    const tc = ttp(b.c), tp = ttp(b.p);
    if (tc == null || tp == null) return { aide: "Saisir les deux délais de positivité" };
    return { cle: tp - tc >= 120 ? "blc" : "autre" };
  }
  if (c) return { cle: "dx3" };
  if (p) return { cle: "hp" };
  return { cle: "neg" };
}

/* ---------------- page ---------------- */
function blocHemoc(h, titre) {
  return `<div class="ilc-hc">
    ${ui.field(titre, ui.seg("b." + h, [["pos", "Positive"], ["neg", "Négative"]]))}
    <div class="ilc-ttp" data-ttp="${h}"><div><div class="ilc-ttp-in">
      <label>Délai de positivité</label>
      <input type="text" inputmode="numeric" maxlength="3" placeholder="h" aria-label="heures" data-h="${h}" data-f="h">
      <span>h</span>
      <input type="text" inputmode="numeric" maxlength="2" placeholder="min" aria-label="minutes" data-h="${h}" data-f="m">
    </div></div></div>
  </div>`;
}

function render(root) {
  const S = {
    voie: null,
    a: { kt: null, hc: null, am: null },
    b: { c: { pos: null, h: "", m: "" }, p: { pos: null, h: "", m: "" } }
  };

  root.className += " ilc";
  root.innerHTML = `
    <div class="ilc-starts">
      <button type="button" class="ilc-start" data-voie="A" style="--c:var(--red)">
        <span class="tile" style="--c:var(--red)">${ui.icon("pouls")}</span>
        <b>Sepsis / choc septique inexpliqué</b><small>ou pus / tunnellite</small>
      </button>
      <button type="button" class="ilc-start" data-voie="B" style="--c:var(--blue)">
        <span class="tile" style="--c:var(--blue)">${ui.icon("thermo")}</span>
        <b>Fièvre isolée</b><small>porteur d'un KT central</small>
      </button>
    </div>
    <p class="ilc-pick">Choisir la situation de départ</p>

    <section class="ilc-voie" data-v="A" hidden>
      ${ui.chain([ui.node({ tone: "red", titre: "Ablation KT + culture KT",
        sous: "Hémoc périph · vanco/dapto + β-lactamine ± aminoside · ± antifongique" })])}
      <div class="u-link"></div>
      <div class="u-card">
        ${ui.field("Culture du KT", ui.seg("a.kt", [["+", "Positive"], ["-", "Négative"], ["nr", "Non réalisée"]]))}
        ${ui.field("Hémocultures périphériques", ui.seg("a.hc", [["+", "Positives"], ["-", "Négatives"]]))}
        ${ui.field("Amélioration après ablation", ui.seg("a.am", [["oui", "Oui"], ["non", "Non"]]))}
        <div class="u-hint" data-aide="A"></div>
      </div>
      <div data-res="A"></div>
    </section>

    <section class="ilc-voie" data-v="B" hidden>
      ${ui.chain([ui.node({ tone: "blue", titre: "Hémocultures couplées KT + périph", sous: "Rechercher une autre cause de fièvre" })])}
      <div class="u-link"></div>
      <div class="u-card">
        ${blocHemoc("c", "Hémoculture KT (centrale)")}
        ${blocHemoc("p", "Hémoculture périphérique")}
        <div class="ilc-dtp" hidden>
          <div class="ilc-dtp-l"><span>DTP = délai périph − délai KT</span><b>—</b></div>
          <div class="ilc-track"><i></i><em></em></div>
          <div class="ilc-scale"><span>0</span><span>2 h</span><span>4 h</span></div>
        </div>
        <div class="u-hint" data-aide="B"></div>
      </div>
      <div data-res="B"></div>
    </section>

    <p class="u-foot">
      SCN : staphylocoques à coagulase négative · BGN : bacilles à Gram négatif ·
      DTP : délai différentiel de positivité (délai périphérique − délai KT) ·
      ETO / ETT : échographie transœsophagienne / transthoracique · VPN : valeur prédictive négative.<br>
      Protocole URCV : DTP seul (pas de ratio quantitatif), ablation systématique du KT en cas de bactériémie liée au KT, SCN 7 j.
    </p>`;

  const q = s => root.querySelector(s);

  // ne reconstruit l'organigramme que si la branche change (sinon l'animation se rejouerait)
  function majRes(zone, cle, table) {
    if ((zone.dataset.cle || "") === (cle || "")) return;
    zone.dataset.cle = cle || "";
    zone.innerHTML = cle ? ui.chain(table[cle]()) : "";
  }

  function syncVoie() {
    root.classList.toggle("choisi", !!S.voie);
    root.querySelectorAll(".ilc-start").forEach(b => b.classList.toggle("on", b.dataset.voie === S.voie));
    root.querySelectorAll(".ilc-voie").forEach(s => { s.hidden = s.dataset.v !== S.voie; });
  }

  function syncA() {
    const r = evalA(S.a);
    q('[data-aide="A"]').textContent = r.aide || "";
    majRes(q('[data-res="A"]'), r.cle, RES_A);
  }

  function syncB() {
    const b = S.b;
    ["c", "p"].forEach(h => q(`[data-ttp="${h}"]`).classList.toggle("on", b[h].pos === true));
    // jauge DTP (seulement si les deux hémoc sont positives)
    const g = q(".ilc-dtp");
    g.hidden = !(b.c.pos && b.p.pos);
    if (!g.hidden) {
      const tc = ttp(b.c), tp = ttp(b.p);
      const val = g.querySelector("b"), bar = g.querySelector(".ilc-track i");
      if (tc == null || tp == null) {
        val.textContent = "—"; g.style.setProperty("--c", "var(--ink3)"); bar.style.setProperty("--w", "0%");
      } else {
        const d = tp - tc;
        val.textContent = (d < 0 ? "− " : "") + fmtMin(Math.abs(d));
        g.style.setProperty("--c", d >= 120 ? "var(--red)" : "var(--orange)");
        bar.style.setProperty("--w", Math.min(100, Math.max(0, d / 240 * 100)) + "%");
      }
    }
    const r = evalB(b);
    q('[data-aide="B"]').textContent = r.aide || "";
    majRes(q('[data-res="B"]'), r.cle, RES_B);
  }

  // situation de départ (re-toucher la carte active la referme)
  root.addEventListener("click", e => {
    const st = e.target.closest(".ilc-start");
    if (!st) return;
    S.voie = S.voie === st.dataset.voie ? null : st.dataset.voie;
    syncVoie();
  });

  ui.onSeg(root, (name, v) => {
    const [voie, k] = name.split(".");
    if (voie === "a") { S.a[k] = v; syncA(); }
    else { S.b[k].pos = v === null ? null : v === "pos"; syncB(); }
  });

  // délais : chiffres uniquement, minutes ≤ 59
  root.addEventListener("input", e => {
    const i = e.target.closest("input[data-h]");
    if (!i) return;
    let v = i.value.replace(/\D/g, "");
    if (i.dataset.f === "m" && v !== "" && +v > 59) v = "59";
    if (v !== i.value) i.value = v;
    S.b[i.dataset.h][i.dataset.f] = v;
    syncB();
  });

  syncVoie(); syncA(); syncB();
}

window.URCV.register({
  id: "ilc",
  titre: "Infections liées aux cathéters",
  court: "Infections de KT",
  sous: "Arbre diagnostique selon E. PILLY 2025",
  cat: "Infectiologie",
  couleur: "teal",
  icone: "goutte",
  mots: "ilc kt cvc cathéter catheter hémoculture hemoc dtp bactériémie sepsis choc fièvre pilly",
  render
});
})();
