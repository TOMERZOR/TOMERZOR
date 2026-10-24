# Lading

An order desk for interior designers: it reads vendor emails, updates each order, and drafts the update to the client. This folder holds the design work for it. Static HTML, CSS and vanilla JS, no build step.

- `index.html`: landing page. The pilot form validates input but does not send anywhere yet.
- `app.html`: clickable prototype of the product with sample data (Review, Orders, Client updates). Changes you make are kept in your browser; use "Reset sample data" to start over.
- `logo.html`: the logo sheet (concept, sizes, app icons, lockups, rules). SVG files are in `assets/`.
- `DESIGN.md`: the Carbon Copy design language (logo, tokens, type, components, Hebrew and RTL, motion, writing).
- `PRODUCT.md`: the problem, evidence, competition, risks and how to test demand.

Every page has English and Hebrew. In the app, switch language (and light or dark mode) from the gear icon; on the landing and logo pages, use the language button. The choice is saved in the browser and shared by all three pages.

Preview locally: `npx http-server lading` and open http://localhost:8080. Opening the files directly in a browser also works.

The studio, clients, vendors and emails are made up. Vendor email addresses use the reserved `.example` domain.
