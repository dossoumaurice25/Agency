# GLAgency — Dashboard + formulaire managers

Ce site contient deux pages :

- `index.html` : ton **dashboard** (réservé au formateur, avec connexion).
- `demande.html` : le **formulaire** que tu envoies à tes managers (public).

Quand un manager envoie sa demande, elle apparaît toute seule dans ton dashboard.

Pour que ça marche une fois le site sur GitHub Pages, il faut une petite base de
données partagée gratuite (Supabase). À faire **une seule fois** (10 minutes).

## 1. Créer le projet Supabase

1. Va sur https://supabase.com et crée un compte gratuit.
2. Clique sur **New project**, donne-lui un nom (ex : `glagency`) et un mot de passe de base de données, choisis la région la plus proche, puis attends 1 à 2 minutes.

## 2. Créer ton compte formateur

1. Menu **Authentication > Users > Add user > Create new user**.
2. Saisis **ton e-mail** et **un mot de passe**, coche **Auto Confirm User**, puis valide. C'est avec ça que tu te connecteras au dashboard.
3. Menu **Authentication > Sign In / Providers** : désactive **Allow new users to sign up** (personne d'autre ne doit pouvoir créer de compte).

## 3. Créer la table et la sécurité

1. Ouvre `supabase-setup.sql` avec le Bloc-notes.
2. Remplace `TON_EMAIL@exemple.com` par **l'e-mail de l'étape 2** (une seule ligne).
3. Dans Supabase : **SQL Editor > New query**, colle tout le contenu, clique sur **Run**. Le message « Success » doit s'afficher.

## 4. Relier le site

1. Dans Supabase : **Project Settings > API**.
2. Copie **Project URL** et la clé **anon public**.
3. Ouvre `config.js` et colle-les entre les guillemets (`SUPABASE_URL` et `SUPABASE_ANON_KEY`).

## 5. Mettre en ligne

Envoie les fichiers sur GitHub comme d'habitude (`index.html`, `demande.html`, `style.css`, `script.js`, `demande.js`, `config.js`, dossier `images`) :

```powershell
git add .
git commit -m "Formulaire managers + base partagée"
git push
```

## 6. Utiliser

1. Ouvre ton dashboard, connecte-toi avec ton e-mail et ton mot de passe.
2. Va dans **Nouvelle demande** : tout en haut, clique sur **Copier le lien** (ou **WhatsApp**) et envoie-le à tes managers.
3. Chaque demande envoyée apparaît en direct dans **Demandes**, avec une notification.

## Sécurité en bref

- Un manager ne peut **qu'envoyer** une demande : il ne peut rien lire, modifier ni supprimer.
- Seul le compte dont l'e-mail est dans `supabase-setup.sql` voit et modifie les données.
- La clé « anon » dans `config.js` est publique par conception : elle ne donne que le droit d'envoyer une demande.
- Sans `config.js` rempli, le site fonctionne en **mode local** (données dans ton navigateur seulement), pratique pour tester.
