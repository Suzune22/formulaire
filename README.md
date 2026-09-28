# Parrainage L1 — Campus de Marcory, Abidjan

Un formulaire d'inscription et un bot qui forment les binômes de parrainage entre les nouveaux étudiants de L1 (filleul·es) et les étudiants plus avancés (L2 à M2) de la filière, sur le campus de Marcory à Abidjan, en Côte d'Ivoire.

- **Onglet Inscription** (`index.html#inscription`) : le formulaire public. On choisit d'abord son rôle :
  - **Filleul·e** : étudiant·e de L1 ou de L2 qui cherche un parrain ;
  - **Parrain / Marraine** : étudiant·e de L2 à M2 qui veut accompagner un·e plus jeune ;
  - **Les deux** : étudiant·e (le plus souvent de L2) qui n'a pas de parrain, en cherche un, et veut aussi parrainer un·e L1.

  On y indique ensuite son nom et ses prénoms, son numéro WhatsApp (ivoirien, à 10 chiffres), sa commune à Abidjan, sa région et sa ville d'origine, son lycée, sa série de BAC, ses langues, ses centres d'intérêt et comment on préfère se rencontrer. Un parrain peut accepter jusqu'à 3 filleul·es. Un même numéro WhatsApp ne peut s'inscrire qu'une fois.
- **Onglet Binômes** (`index.html#binomes`) : l'espace des organisateurs. On y trouve les réglages du bot, le nom de l'université et de la filière affichés sur le formulaire, et la liste des lycées proposés. On peut y lancer le bot, associer les étudiants à la main, retirer un inscrit et exporter en CSV. Pour chaque binôme, des boutons **WhatsApp parrain** et **WhatsApp filleul** ouvrent un message prêt à envoyer.
- **Partager le formulaire** : affiche un QR code et le lien direct vers l'inscription.

## Le bot d'appariement

Tous les étudiants sont dans la même université et la même filière. Le bot les associe donc selon ces critères :

| Critère | Règle par défaut | Poids par défaut |
|---|---|---|
| Commune de résidence à Abidjan | De préférence identique | 6 |
| Région d'origine | De préférence identique | 5 |
| Ville d'origine | De préférence identique | 3 |
| Lycée d'origine | De préférence identique | 4 |
| Série du BAC | De préférence identique | 6 |
| Langues parlées | De préférence identique | 2 par langue commune |
| Centres d'intérêt | De préférence identique | 2 par intérêt commun |
| Mode de rencontre (campus ou en ligne) | De préférence identique | 2 |

Les règles possibles :

- **Ignoré** : le critère ne compte pas.
- **De préférence identique** : un point commun rapporte le poids du critère. Pour une liste, chaque élément commun rapporte le poids, dans la limite de 3 éléments.
- **De préférence différent** : des profils différents rapportent le poids. Sert par exemple à mélanger les régions d'origine.
- **Obligatoirement identique** : aucun binôme n'est formé si le critère n'est pas respecté. Sert par exemple à n'associer que des étudiants de la même série de BAC.

Les comparaisons ignorent les accents, la casse et la ponctuation : « Lycée Sainte-Marie de Cocody » et « lycee sainte marie de cocody » sont considérés comme le même lycée. Pour éviter les fautes de saisie, les organisateurs peuvent aussi fixer la liste des lycées proposés dans le formulaire.

Quel que soit le réglage, **un parrain a toujours un niveau supérieur à celui de son filleul**. Un·e L2 inscrit·e en « Les deux » parraine donc un·e L1 et reçoit un parrain de L3 ou plus.

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

Une fois en ligne, ouvrir l'onglet **Binômes → Réglages du bot** pour saisir le nom de l'université et de la filière, et la liste des lycées. Ils s'affichent ensuite sur le formulaire.
