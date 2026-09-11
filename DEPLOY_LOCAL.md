# Déploiement Automatique VRedPlay sur Serveur Local (192.168.4.26)

Le serveur local est hébergé sur la machine Linux **`192.168.4.26`** (`VredPlayR-preprod`).
Le site y est déployé dans `/usr/share/nginx/html` et géré par le service systemd `vredplay.service`.

---

## Ce qui a déjà été configuré sur votre serveur :

1. **Script de déploiement automatique** : [`/usr/share/nginx/html/deploy.sh`](file:///usr/share/nginx/html/deploy.sh)
   - Sauvegarde les bases JSON dans `data_backup/` pour ne rien perdre.
   - Ignore les logs modifiés pour éviter les conflits git.
   - Met à jour le code (`git pull origin main`).
   - Installe les dépendances (`npm install --omit=dev`).
   - Redémarre le service `vredplay.service` avec `systemctl`.
   - Testé avec succès en direct sur le serveur.

2. **GitHub Actions Runner pré-installé** dans `/root/actions-runner`.
   - Script d'enregistrement prêt : `/root/actions-runner/setup-runner.sh`.

3. **Workflow GitHub Actions** : [`.github/workflows/deploy.yml`](file:///c:/Users/shani/Documents/GitHub/VRedPlay-R/.github/workflows/deploy.yml)

---

## Dernière étape : Enregistrer le Runner GitHub

Il ne vous reste qu'à générer le token GitHub et le fournir :

1. Allez sur votre dépôt GitHub dans votre navigateur :  
   👉 **[Créer un Runner Linux](https://github.com/p7p55b/VRedPlay-R/settings/actions/runners/new?arch=x64&os=linux)**
2. Dans la section **Configure**, vous verrez une commande du type :
   ```bash
   ./config.sh --url https://github.com/p7p55b/VRedPlay-R --token ABCDEFGHIJKLMNOPQRSTUV
   ```
3. Copiez le token (la chaîne après `--token`) et donnez-le moi dans le chat, ou exécutez sur le serveur :
   ```bash
   /root/actions-runner/setup-runner.sh VOTRE_TOKEN
   ```

Dès que cette commande est lancée :
- Le runner s'enregistre auprès de GitHub.
- Il s'installe en tant que service système (`systemd`) qui démarre automatiquement avec la machine.
- Chaque `git push` sur `main` déploiera automatiquement votre site sur `192.168.4.26` !

