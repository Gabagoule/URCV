# Protocoles URCV — version mobile

Protocoles interactifs de l'URCV (sans l'annuaire téléphonique), pensés pour iPhone.
Site statique : aucun serveur, aucune donnée patient stockée.

## Mise en ligne (GitHub Pages)

1. Créer un dépôt (ex. `urcv-protocoles`) et y déposer **le contenu** de ce dossier tel quel.
2. Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
3. Ouvrir `https://<compte>.github.io/urcv-protocoles/` dans Safari, puis
   Partager → **Sur l'écran d'accueil** : l'app s'ouvre en plein écran et marche hors-ligne.

La page porte `noindex` (pas de référencement), mais un dépôt Pages public reste lisible par qui a le lien.

## Arborescence

```
index.html              coque : style, navigation, recherche, kit d'interface (URCV.ui)
sw.js                   hors-ligne (réseau d'abord, copie en cache sinon)
manifest.webmanifest    installation sur l'écran d'accueil
icon-180/192/512.png    icônes
protocoles/
  ilc.js                Infections liées aux cathéters (E. PILLY 2025, adapté URCV)
  bilan_vasc.js         Bilan préopératoire en chirurgie vasculaire
  scores.js             Clairance de la créatinine (recueil urinaire) + EuroSCORE II
```

## Ajouter un protocole

1. Créer `protocoles/mon_protocole.js` :

```js
(() => {
const { ui } = window.URCV;
ui.css("mp", `/* styles préfixés mp- */`);

function render(root) {
  const S = { /* état, remis à zéro à chaque ouverture */ };
  root.innerHTML = `
    <div class="u-h">Section</div>
    <div class="u-card">${ui.field("Critère", ui.seg("x", [["a", "Oui"], ["b", "Non"]]))}</div>`;
  ui.onSeg(root, (name, v) => { S[name] = v; /* … */ });
}

window.URCV.register({
  id: "mon-protocole", titre: "Titre complet", court: "Titre court",
  sous: "Sous-titre", cat: "Catégorie", couleur: "blue", icone: "livre",
  mots: "mots-clés recherche", render
});
})();
```

2. Ajouter dans `index.html`, en bas avec les autres :
   `<script src="protocoles/mon_protocole.js" defer></script>`
3. (Facultatif) l'ajouter à la liste `BASE` de `sw.js` et passer `CACHE` en `v2`.

Couleurs disponibles : blue, green, orange, red, yellow, purple, teal, indigo, pink, grey.
Icônes : goutte, pouls, thermo, check, calc, coeur, pilule, livre.

Kit `URCV.ui` : `seg` / `onSeg` (contrôle segmenté), `selRow` / `onSel` (menu à roue iOS),
`swRow` / `onSw` (interrupteur), `numRow` / `onNum` (saisie numérique), `field`, `pill`,
`node` / `chain` / `durees` (organigramme animé), `sheet` (feuille modale), `layer` (éléments flottants).
