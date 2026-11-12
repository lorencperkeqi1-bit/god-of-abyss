# GODS OF THE ABYSS demo deployment

The deployment target is a static, account-free browser demo. It uses the existing Phaser game and artwork; it does not add a backend, login, payments, deposits, or cash-out. The game balance is virtual and resets to 1,000 credits when the demo is restarted. The game retains its original 16:9 landscape layout; phones and tablets should be turned to landscape for the best play experience.

## Build and preview locally

From the project directory:

```sh
npm ci
npm run build:demo
npm run preview:demo
```

Open the preview URL printed by Vite. The landing page is `/`; **PLAY DEMO** opens `/play.html`. The build output is `demo-dist/`. The deployment build uses relative asset URLs so it works both at a domain root and under a GitHub Pages repository path.

## Publish with GitHub Pages

1. Create a public GitHub repository for this project. Check the files before publishing; do not include `.env` files, credentials, or API keys.
2. From the project directory, initialize and push the source to the new repository (replace the placeholders):

   ```sh
   git init
   git add .
   git status
   git commit -m "Prepare Gods of the Abyss demo"
   git branch -M main
   git remote add origin https://github.com/<OWNER>/<REPOSITORY>.git
   git push -u origin main
   ```

   If `git status` lists anything private, unstage or ignore it before committing.
3. In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
4. Push to `main`, or open **Actions → Deploy free game demo → Run workflow**. The workflow at `.github/workflows/deploy-demo.yml` installs dependencies, builds `demo-dist/`, and publishes it.
5. Wait for the workflow's **Deploy to GitHub Pages** job to succeed. Its environment link is the published URL. A repository site normally has this form:

   `https://<OWNER>.github.io/<REPOSITORY>/`

   A user/org site normally has this form:

   `https://<OWNER>.github.io/`

6. Open that URL and test **PLAY DEMO**. Share the landing-page URL; the game itself is at the same URL with `play.html` appended.

This project copy does not have a Git remote or GitHub account context configured, so publishing and the final public URL must be completed from the repository owner’s GitHub account. Do not describe the demo as public until the Pages deployment succeeds and the URL is verified.

## Scope and known prototype limitation

The existing game has no audio files; its bonus celebration uses browser-generated Web Audio. Its bonus scene uses `public/assets/characters/bonus_bg.png.mp4`. The game information screen states that the prototype math is not tuned or certified to a target RTP; the landing page repeats that limitation. This demo is for product presentation, not real-money play.
