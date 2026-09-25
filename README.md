# Parrainage L1

Un formulaire d'inscription et un bot qui forme les binômes entre les nouveaux étudiants de L1 (filleul·es) et des étudiants plus avancés, de la L2 au doctorat (parrains et marraines). Le bot tient compte de l'école, de la provenance et d'autres critères que l'on peut régler.

- **Onglet Inscription** (`index.html#inscription`) : le formulaire public. On y indique son rôle, son école, sa filière, son pays et sa ville d'origine, ses langues, ses centres d'intérêt et comment on préfère se rencontrer. Un parrain peut accepter jusqu'à 3 filleul·es.
- **Onglet Binômes** (`index.html#binomes`) : l'espace des organisateurs, avec les réglages du bot, son lancement, l'association manuelle, le retrait d'un inscrit et l'export CSV.
- **Partager le formulaire** : affiche un QR code et le lien direct vers l'inscription.

## Le bot d'appariement

Chaque critère se règle séparément :

| Critère | Règle par défaut | Poids par défaut |
|---|---|---|
| École / université | De préférence identique | 8 |
| Pays d'origine | De préférence identique | 5 |
| Ville ou région d'origine | De préférence identique | 3 |
| Filière | De préférence identique | 6 |
| Langues parlées | De préférence identique | 2 par langue commune |
| Centres d'intérêt | De préférence identique | 2 par intérêt commun |
| Mode de rencontre | De préférence identique | 2 |

Les règles possibles :

- **Ignoré** : le critère ne compte pas.
- **De préférence identique** : un point commun rapporte le poids du critère. Pour une liste, chaque élément commun rapporte le poids, dans la limite de 3 éléments.
- **De préférence différent** : des profils différents rapportent le poids. Sert par exemple à mélanger les provenances.
- **Obligatoirement identique** : aucun binôme n'est formé si le critère n'est pas respecté. Sert par exemple à ne jamais associer deux écoles différentes.

Les comparaisons ignorent les accents, la casse et la ponctuation : « Université Paris-Cité » et « universite paris cite » sont considérées comme la même école. Pour éviter les fautes de saisie, les organisateurs peuvent aussi fixer la liste des écoles proposées dans le formulaire.

Le bot cherche la répartition qui donne **le meilleur score total** (algorithme hongrois). Il ne se contente donc pas d'associer d'abord les meilleurs couples, ce qui pourrait laisser quelqu'un de côté. Il respecte le nombre de filleul·es accepté par chaque parrain. Il répartit aussi les filleul·es entre les parrains avant de donner un deuxième filleul à l'un d'eux.

- **Lancer le bot** : complète les binômes existants sans les modifier.
- **Tout recalculer** : refait toute la répartition avec les réglages actuels.

Le moteur se trouve dans `matching.js` et ses tests se lancent avec `npm test` (Node 18 ou plus récent).

## Mise en ligne

Si `API_URL` est vide dans `index.html`, la page fonctionne en **mode démo** : les données restent dans le navigateur. Pour recevoir les inscriptions de tout le monde :

1. Créer une feuille Google Sheets, puis ouvrir **Extensions → Apps Script**.
2. Coller le contenu de `apps-script/Code.gs`.
3. Dans **Paramètres du projet → Propriétés du script**, ajouter `ADMIN_KEY` avec un code secret. Ce code sera demandé dans l'onglet Binômes. Sans lui, toute personne qui a l'URL peut voir la liste des inscrits.
4. **Déployer → Nouveau déploiement → Application Web**, avec « Exécuter en tant que : moi » et « Accès : tout le monde ».
5. Copier l'URL `…/exec` dans la constante `API_URL` en haut du script de `index.html`.
6. Héberger la page, par exemple avec GitHub Pages (**Settings → Pages → Deploy from branch → main**).

Les onglets `Etudiants`, `Binomes` et `Reglages` sont créés automatiquement dans la feuille à la première requête.
