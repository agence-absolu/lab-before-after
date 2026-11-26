# Démo Lab Absolu

Une démo de plus dans l’univers du Lab Absolu.

Démo du lab Absolu, publiée sur **https://lab.agence-absolu.com/before-after/**.

## Développement

```bash
npm install
npm run dev       # http://localhost:5173/before-after/
npm run build     # compile dans dist/
npm run preview   # prévisualise dist/ sur le même sous-chemin
```

Le site est servi depuis un sous-répertoire du lab : `vite.config.js` déduit la
base des chemins du nom npm (`before-after`). `BASE_PATH=/ npm run build` pour une
racine de domaine.

## Publication

`.github/workflows/deploy.yml` compile et envoie `dist/` par rsync sur SSH dans
`lab.agence-absolu.com/lab-projects/before-after/` à chaque push sur `main` — ou à
la demande, onglet Actions. Le hub sert ce dossier sur `/before-after/` sans
aucune configuration de son côté.

### 1. Le dépôt

```bash
gh repo create agence-absolu/lab-before-after --public --source=. --remote=origin
gh secret set LAB_PAGE_PASSWORD   # avant le premier push : jamais en ligne sans protection
git push -u origin main
```

**Public, obligatoirement** : les secrets SSH sont définis au niveau de
l'organisation `agence-absolu`, et GitHub ne les partage qu'avec les dépôts
publics (limite du plan gratuit). Un dépôt privé verrait son workflow échouer
faute de secrets.

### 2. Les secrets

Rien à créer dans le dépôt : le workflow lit ceux de l'organisation
(Settings de l'organisation › Secrets and variables › Actions).

| Secret | Contenu |
| --- | --- |
| `LAB_SSH_HOST` | hôte SSH Infomaniak (`…ssh.hosting-ik.com`) |
| `LAB_SSH_USER` | compte SSH |
| `LAB_SSH_PASSWORD` | mot de passe |
| `LAB_SSH_KNOWN_HOSTS` | facultatif — sortie de `ssh-keyscan <hôte>`, pour épingler l'empreinte du serveur |

Sans le dernier, le workflow relève l'empreinte du serveur au premier contact
et la croit sur parole. Un secret de dépôt du même nom, s'il en existe un,
prime sur celui de l'organisation.

**Mot de passe.** Cette démo est protégée : le secret de dépôt
`LAB_PAGE_PASSWORD` (pas dans l'organisation) fait déposer par le déploiement
l'empreinte scrypt du mot de passe dans `.access`, et le hub demande alors
identifiant (libre) et mot de passe avant de servir quoi que ce soit. Le mot de
passe n'apparaît ni dans le code ni sur le serveur. Supprimer le secret rend la
démo publique au déploiement suivant ; le dépôt, lui, reste public dans tous
les cas.

```bash
gh secret set LAB_PAGE_PASSWORD   # saisie masquée, demandée après Entrée
```

Pourquoi un mot de passe et pas une clé : chez Infomaniak, l'authentification
par clé n'est pas disponible sur un site Node.js et le port FTP est filtré.

### 3. Pousser

Premier push sur `main` : le workflow compile, envoie, et la démo apparaît sur
la page d'accueil du lab.

## Règles du hub

- le slug (`"name"` de `package.json`) est en minuscules : lettres, chiffres,
  tirets ;
- `index.html` est revalidé à chaque visite, le reste est mis en cache un an —
  les bundles portent une empreinte dans leur nom (Vite le fait) ;
- une URL sans extension qui ne correspond à aucun fichier retombe sur
  `index.html` (routage côté client).
