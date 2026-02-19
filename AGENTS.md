# AGENTS.md

Ce fichier definit les regles de contribution pour humains et agents IA dans ce repo.

## Objectif

Livrer des changements fiables, testables et documentes, sans regression produit.

## Regles obligatoires

1. i18n partout
- Toute nouvelle UI doit etre compatible i18n (`fr`, `en`, `es`).
- Ne pas introduire de texte non traduisible hors flux i18n.
- Verifier au minimum le rendu `fr` et `en`.

2. Securite du code
- Valider les entrees serveur.
- Eviter les secrets hardcodes.
- Ne pas contourner les controles d'authentification/autorisation.
- Garder les dependances et schema Prisma coherents.

3. Qualite technique obligatoire
- Avant merge, executer:
```bash
npm run lint
npm run build
npm run test:e2e
```
- Ou en une seule commande:
```bash
npm run check
```

4. Tests automatiques E2E Playwright
- Toute evolution critique UI/flux doit etre couverte par un test E2E.
- Placer les specs dans `tests/e2e/`.
- Conserver les tests deterministes (pas de dependance a un compte manuel).

5. Documentation a jour
- Toute PR doit maintenir `README.md` a jour si:
  - scripts modifies,
  - nouveaux prerequis/env,
  - nouveau comportement utilisateur,
  - changement architecturel significatif.

## Processus recommande pour une tache

1. Comprendre le besoin + impact i18n.
2. Implementer de facon minimale et robuste.
3. Mettre a jour/ajouter les tests E2E necessaires.
4. Executer `npm run check`.
5. Mettre a jour la documentation.
6. Livrer un resume clair avec risques restants.

## Definition of Done

Une tache est terminee uniquement si:

- `lint` passe,
- `build` passe,
- `test:e2e` passe,
- i18n est respectee,
- la documentation est a jour.
