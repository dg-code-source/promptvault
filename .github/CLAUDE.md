# .github/ – CI/CD & GitHub Configuration Guide

This directory contains the GitHub Actions workflow for automated testing, compilation, and deployment of PromptVault to GitHub Pages.

---

## Workflow: `workflows/deploy.yml`

**Trigger:** Every push to `main` or `master` branch

**Pipeline Steps (in order):**

1. **Checkout Code** — `actions/checkout@v4`
2. **Set up Python 3.x** — `actions/setup-python@v5`
3. **Run Unit Tests** — `python -m unittest discover -s tests -p "test_*.py"`
   - If any test fails, the deployment is aborted
4. **Compile Prompts** — `python scripts/compile-prompts.py`
   - Converts `prompts/*.md` → `prompts.json`
5. **Setup GitHub Pages** — `actions/configure-pages@v4`
6. **Upload Artifact** — Uploads the entire repo root as the Pages artifact
7. **Deploy to GitHub Pages** — `actions/deploy-pages@v4`

**Concurrency:** Only one deployment runs at a time. Duplicate runs are cancelled (`cancel-in-progress: true`).

---

## Required GitHub Repository Settings

For the workflow to function, these settings must be enabled in the GitHub repo:

1. **Settings → Pages → Source:** Set to `GitHub Actions` (not `Deploy from branch`)
2. **Settings → Actions → General → Workflow permissions:** `Read and write permissions` OR the workflow's explicit permissions block must be present:
   ```yaml
   permissions:
     contents: read
     pages: write
     id-token: write
   ```

---

## Modifying the Workflow

### To add a new CI step:
Insert it **between** "Run Unit Tests" and "Compile Prompts" for validation steps, or after "Compile Prompts" and before "Setup Pages" for build steps.

### To change the Python version:
Update the `python-version` field in `actions/setup-python@v5`. The current value is `'3.x'` (latest stable).

### To change which branch triggers deployment:
Edit the `on.push.branches` list.

### To add environment secrets (e.g., API keys for future server-side features):
Add them via **Settings → Secrets and variables → Actions**, then reference them as `${{ secrets.SECRET_NAME }}` in the YAML.

---

## Deployment URL

After deployment, the app is accessible at:
```
https://<owner>.github.io/<repo-name>/
```

The `repoOwner` and `repoName` are auto-detected from `window.location.hostname` in `app.js`.

---

## Workflow Constraints

- **No Node.js install step** — The runtime app uses no npm dependencies. If you add a Node.js build step (e.g., `npm run build` with Vite), you must add `actions/setup-node@v4` before it.
- **Upload path is `.`** (entire repo root) — All files at the root are served by GitHub Pages. Be mindful of what files are committed.
- **Python tests must pass** before any deployment — never make tests optional or comment them out.
