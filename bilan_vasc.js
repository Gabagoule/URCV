/* =====================================================================
   protocoles/bilan_vasc.js — Bilan préopératoire en chirurgie vasculaire
   (version mobile). Logique reprise telle quelle de bilan_vasc.js
   (annuaire, version du 28/10/2026).

   Saisie : chirurgie (à risque / non à risque, + ATA, aorte/pontage)
            → clinique (symptomatique, cardiopathie, Lee, MET)
            → biologie (troponine J-1, NT-proBNP)
   Résultat : 4 examens avec verdict (OUI, NON, À COMPLÉTER, À DÉTERMINER)
   + une capsule flottante qui résume les 4 verdicts pendant la saisie.

   Hors protocole : chirurgie non à risque avec NT-proBNP ≥ 125 (→ ETT) ou
   troponine augmentée (→ évaluation coronaire) = « À DÉTERMINER », cas par cas.
   Symptomatique → ETT et évaluation coronaire quelle que soit la chirurgie.
   ===================================================================== */
(() => {
"use strict";
const { ui } = window.URCV;

const CHIR_RISQUE = "Aorte (open ou endo), pontage MI, ischémie critique ou aiguë de MI sous AG, trépied fémoral, carotide (CEA ou CAS), debranching TSAo, amputation de membre";
const CHIR_NON = "ATP MI, ATP viscérale, FAV, chirurgie veineuse, amputation des extrémités";

ui.css("bv", `
.bv{padding-bottom:80px}
.bv-chir-l{font-size:13px;line-height:1.5;color:var(--ink2);margin:12px 0 0}
.bv-chir-l b{color:var(--ink);font-weight:600}
.bv-card{padding:16px 18px}
.bv-ch{display:flex;align-items:center;gap:12px}
.bv-ct{flex:1;font:600 18px/1.25 var(--serif)}
.bv-crit{font-size:12.5px;line-height:1.45;color:var(--ink2);margin-top:5px}
.bv-bleu{color:var(--blue);font-weight:600}
.bv-rouge{color:var(--red);font-weight:600}
.bv-com{font-size:14px;line-height:1.45;margin-top:9px}
.bv-com:empty{display:none}
.bv-note{font-size:12.5px;color:var(--ink2);margin-top:7px}
.bv-note b{color:var(--ink);font-weight:600}

/* capsule flottante : les 4 verdicts en direct */
.bv-dock{position:fixed;z-index:25;left:50%;bottom:calc(16px + var(--sb));transform:translateX(-50%);display:flex;padding:4px;border-radius:999px;
  background:#fff;border:1px solid var(--ink);box-shadow:0 10px 30px rgba(0,0,0,.08);
  transition:opacity .25s, transform .3s var(--ease)}
.bv-dock.cache{opacity:0;transform:translate(-50%, 24px);pointer-events:none}
.bv-dock button{display:flex;align-items:center;gap:7px;border:0;background:none;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:500;letter-spacing:.06em;cursor:pointer}
.bv-dock button:active{background:var(--fill)}
.bv-dot{width:8px;height:8px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--ink3);transition:background .2s, box-shadow .2s}
.bv-dot.OUI{background:var(--ink);box-shadow:none}
.bv-dot.NON{background:var(--fill2);box-shadow:none}
.bv-dot.DET{background:var(--orange);box-shadow:none}
.bv-dot.ATT{box-shadow:inset 0 0 0 1.5px var(--ink)}

/* feuille d'aide MET / Lee */
.bv-met{display:grid;grid-template-columns:auto 1fr;gap:11px 14px;font-size:14px;line-height:1.35}
.bv-met b{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
.bv-met span small{display:block;color:var(--ink2);font-size:13px}
.bv-sh-t{font-size:11px;font-weight:500;color:var(--ink2);text-transform:uppercase;letter-spacing:.18em;margin:6px 0 12px}
.bv-sh-t + .bv-met{margin-bottom:26px}
.bv-lee{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
.bv-lee span{font-size:13.5px;padding:5px 10px;border:1px solid var(--line2)}
.bv-mort{font-size:13px;color:var(--ink2);padding-top:14px;border-top:1px solid var(--line)}
`);

const AIDE = `
  <div class="bv-sh-t">Capacité fonctionnelle · activité réalisable sans symptôme</div>
  <div class="bv-met">
    <b>&gt; 10 MET</b><span>Excellente<small>natation, basket, tennis en simple, ski de fond, course</small></span>
    <b>7–10 MET</b><span>Très bonne<small>tennis en double, football, danse, gros travaux, colline, ≥ 2 étages, marche rapide</small></span>
    <b>4–7 MET</b><span>Modérée<small>monter 1 à 2 étages, ménage</small></span>
    <b>&lt; 4 MET</b><span>Faible<small>marche à plat (3–5 km/h), à domicile, toilette, habillage, repas</small></span>
    <b>—</b><span>Non évaluable<small>aucune activité</small></span>
  </div>
  <div class="bv-sh-t">Score de Lee clinique · 1 point par item</div>
  <div class="bv-lee"><span>Coronaropathie</span><span>Insuffisance cardiaque</span><span>AVC ou AIT</span><span>Diabète (tout type)</span><span>DFG &lt; 60 mL/min/1,73 m²</span></div>
  <div class="bv-mort">Complications cardiovasculaires majeures : 0 : 0,4 % – 1 : 6,0 % – 2 : 10,1 % – ≥ 3 : 15 %</div>`;

/* ---------------- logique (identique à l'annuaire) ----------------
   état : chir null|"risque"|"non" ; ata, aorte : booléens
          sympt 0|1 ; cardio 0|1|2 ; lee 0..3|null ; met 0..4|null (3 = < 4 MET, 4 = non évaluable)
          tropo 0|1|2 (non dosée, normale, augmentée) ; nt 0|1|2 (non dosé, < 125, ≥ 125)
   v : "OUI" | "NON" | "ATT" (à compléter) | "DET" (à déterminer) | "—"            */
function evaluer(BV) {
  const choisi = BV.chir != null;
  const risk = BV.chir === "risque";
  const nonRisk = BV.chir === "non";
  const sympt = BV.sympt === 1;
  const ntHaut = BV.nt === 2, ntBas = BV.nt === 1;
  const tropoHaute = BV.tropo === 2;

  /* ETT : indication clinico-biologique */
  let ett;
  if (sympt || (risk && (ntHaut || BV.cardio === 2))) {
    ett = { v: "OUI", com: "Urgence du jour : ETT possible par le MAR au bloc, en préinduction" };
  } else if (nonRisk && ntHaut) {
    ett = { v: "DET", com: "NT-proBNP réalisé hors protocole pour chirurgie non à risque : cas par cas" };
  } else if (!choisi) {
    ett = { v: "—", com: "" };
  } else if (risk && BV.cardio !== 1 && !ntBas) {
    ett = { v: "ATT", com: "NT-proBNP à doser" };
  } else {
    ett = { v: "NON", com: "" };
  }

  /* Troponine et NT-proBNP : en fonction de la chirurgie */
  const tropo = !choisi ? { v: "—", com: "" }
    : risk ? { v: "OUI", com: "À faire la veille de l'intervention, en service" }
    : { v: "NON", com: "" };
  const bnp = !choisi ? { v: "—", com: "" }
    : risk ? { v: "OUI", com: "Idéalement en externe (ordonnance délivrée en règle générale par l'équipe de chirurgie)" }
    : { v: "NON", com: "" };

  /* Évaluation coronaire : clinico-biologique et/ou en fonction de la chirurgie */
  let coro;
  if (BV.ata) {
    coro = { v: "OUI", com: "ATA : service du Pr Cuisset" };
  } else if (sympt) {
    coro = { v: "OUI", com: "Symptomatique : service du Pr Cuisset" };
  } else if (tropoHaute && risk) {
    coro = { v: "OUI", com: "Troponine J-1 augmentée : service du Pr Cuisset" };
  } else if (tropoHaute && nonRisk) {
    coro = { v: "DET", com: "Troponine dosée hors protocole pour chirurgie non à risque : cas par cas" };
  } else if (BV.aorte) {
    if (BV.met == null || BV.lee == null) coro = { v: "ATT", com: "Renseigner MET et score de Lee" };
    else if (BV.met >= 3 && BV.lee >= 2) coro = { v: "OUI", com: "MET < 4 et Lee ≥ 2 : possible en externe" }; // < 4 MET ou non évaluable
    else coro = { v: "NON", com: "" };
  } else if (choisi) {
    coro = { v: "NON", com: "" };
  } else {
    coro = { v: "—", com: "" };
  }

  return { ett, bnp, tropo, coro };
}

/* ---------------- rendu ---------------- */
const LIB = { OUI: ["OUI", "blue"], NON: ["NON", "grey"], ATT: ["À COMPLÉTER", "dash"], DET: ["À DÉTERMINER", "amber"], "—": ["—", ""] };
const CLINBIO = `<span class="bv-bleu">Indication clinico-biologique</span>`;
const CHIR = `<span class="bv-rouge">En fonction de la chirurgie</span>`;
const EXAMENS = [
  { k: "ett",   court: "ETT",   titre: "ETT par cardiologue", crit: CLINBIO },
  { k: "bnp",   court: "BNP",   titre: "NT-proBNP", crit: CHIR },
  { k: "tropo", court: "Tropo", titre: "Monitorage de la troponinémie", crit: CHIR },
  { k: "coro",  court: "Coro",  titre: "Évaluation coronaire",
    crit: `${CLINBIO} et/ou ${CHIR} (posée par le chirurgien, validée par le MAR)`,
    note: `Écho de stress, coroscanner ou coronarographie : <b>choix par le cardiologue</b>` }
];

function render(root) {
  const BV = { chir: null, ata: false, aorte: false, sympt: 0, cardio: 0, lee: null, met: null, tropo: 0, nt: 0 };

  root.className += " bv";
  root.innerHTML = `
    <div class="u-h">Chirurgie</div>
    <div class="u-list">
      <div class="u-blk">
        ${ui.seg("chir", [["risque", "À risque", "orange"], ["non", "Non à risque", "blue"]])}
        <div class="bv-chir-l" data-chirl></div>
      </div>
      ${ui.swRow("ata", "ATA", false, "chirurgie à risque")}
      ${ui.swRow("aorte", "Aorte open, aorte endo complexe ou pontage MI", false)}
    </div>

    <div class="u-h">Clinique</div>
    <div class="u-list">
      ${ui.swRow("sympt", "Symptomatique", false, "dyspnée, arythmie, nouveau souffle…")}
      ${ui.selRow("cardio", "Cardiopathie", [["0", "Aucune connue"], ["1", "Connue, ETT < 1 an"], ["2", "Connue, ETT > 1 an"]], "0")}
      ${ui.selRow("lee", "Score de Lee", [["0", "0"], ["1", "1"], ["2", "2"], ["3", "≥ 3"]])}
      ${ui.selRow("met", "Capacité fonctionnelle", [["0", "> 10 MET"], ["1", "7–10 MET"], ["2", "4–7 MET"], ["3", "< 4 MET"], ["4", "Non évaluable"]])}
      <button type="button" class="u-li u-li-btn" data-aide>${ui.icon("info")}<span>Aide : MET et score de Lee</span></button>
    </div>

    <div class="u-h">Biologie</div>
    <div class="u-list">
      ${ui.selRow("tropo", "Troponinémie J-1", [["0", "Non dosée"], ["1", "Normale"], ["2", "Augmentée"]], "0")}
      ${ui.selRow("nt", "NT-proBNP", [["0", "Non dosé"], ["1", "< 125 pg/mL"], ["2", "≥ 125 pg/mL"]], "0")}
    </div>

    <div class="u-h">Examens</div>
    <div class="bv-res">
      ${EXAMENS.map(x => `
        <div class="u-card bv-card" data-card="${x.k}">
          <div class="bv-ch"><div class="bv-ct">${x.titre}</div>${ui.pill("—")}</div>
          <div class="bv-crit">${x.crit}</div>
          <div class="bv-com"></div>
          ${x.note ? `<div class="bv-note">${x.note}</div>` : ""}
        </div>`).join("")}
    </div>`;

  // capsule flottante
  const dock = document.createElement("div");
  dock.className = "bv-dock";
  dock.innerHTML = EXAMENS.map(x => `<button type="button" data-go="${x.k}"><i class="bv-dot"></i>${x.court}</button>`).join("");
  ui.layer.appendChild(dock);

  const q = s => root.querySelector(s);
  const segChir = q('.u-seg[data-seg="chir"]');

  function refresh() {
    const r = evaluer(BV);
    EXAMENS.forEach(x => {
      const card = q(`.bv-card[data-card="${x.k}"]`);
      const [txt, kind] = LIB[r[x.k].v];
      const pill = card.querySelector(".u-pill");
      pill.className = "u-pill " + kind;
      pill.textContent = txt;
      card.querySelector(".bv-com").textContent = r[x.k].com;
      dock.querySelector(`[data-go="${x.k}"] .bv-dot`).className = "bv-dot " + (r[x.k].v === "—" ? "" : r[x.k].v);
    });
    ui.setSeg(segChir, BV.chir);
    q('input[data-sw="ata"]').checked = BV.ata;
    q('input[data-sw="aorte"]').checked = BV.aorte;
    q("[data-chirl]").innerHTML =
      BV.chir === "risque" ? `<b>À risque :</b> ${CHIR_RISQUE}` :
      BV.chir === "non" ? `<b>Non à risque :</b> ${CHIR_NON}` :
      `<b>À risque :</b> ${CHIR_RISQUE}<br><b>Non à risque :</b> ${CHIR_NON}`;
  }

  // chirurgie : re-toucher = désélection ; « non à risque » décoche ATA et aorte/pontage
  ui.onSeg(root, (name, v) => {
    BV.chir = v;
    if (BV.chir !== "risque") { BV.ata = false; BV.aorte = false; }
    refresh();
  });
  // ATA et aorte/pontage sont des chirurgies à risque : les cocher sélectionne « à risque »
  ui.onSw(root, (name, on) => {
    if (name === "sympt") BV.sympt = on ? 1 : 0;
    else { BV[name] = on; if (on) BV.chir = "risque"; }
    refresh();
  });
  ui.onSel(root, (name, v) => { BV[name] = v == null ? null : +v; refresh(); });

  q("[data-aide]").addEventListener("click", () => ui.sheet("MET et score de Lee", AIDE));
  dock.addEventListener("click", e => {
    const b = e.target.closest("[data-go]");
    if (b) q(`.bv-card[data-card="${b.dataset.go}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // la capsule s'efface quand les cartes résultat sont à l'écran
  let io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(([en]) => dock.classList.toggle("cache", en.isIntersecting), { threshold: 0.35 });
    io.observe(q(".bv-res"));
  }

  refresh();
  return () => { if (io) io.disconnect(); };
}

window.URCV.register({
  id: "bilan-vasc",
  titre: "Bilan préopératoire en chirurgie vasculaire",
  court: "Bilan chir. vasc",
  sous: "ETT, NT-proBNP, troponine, évaluation coronaire",
  cat: "Préopératoire",
  couleur: "orange",
  icone: "check",
  mots: "vasculaire chirurgie preop préopératoire bilan ett bnp nt-probnp troponine coronaire lee met aorte carotide pontage ata",
  render
});
})();
