# Federal AI Maturity

Static GitHub Pages site for the 2025 Federal Agency AI Use Case Dashboard.

Live site: https://hsmahon.github.io/federal-ai-maturity/

## Repo contents

This is a publish-only repository. It contains only the files needed to serve the site:

- `index.html`
- `styles.css`
- `app.js`

## Updating the site

Updates come from the source dashboard repository, not from this repo.

To refresh this publish repo:

1. Rebuild the source project so `site/index.html` contains the latest embedded data.
2. Copy `site/index.html`, `site/styles.css`, and `site/app.js` into this repo root.
3. Commit and push to `main`.

GitHub Pages publishes this repo from the `main` branch root.
