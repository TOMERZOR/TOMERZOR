# Lading

An order desk for interior designers: it reads vendor emails, updates each order, and drafts the update to the client. This folder holds the design work for it. Static HTML, CSS and vanilla JS, no build step.

- `index.html`: landing page. The pilot form validates input but does not send anywhere yet.
- `app.html`: clickable prototype of the product with sample data (Review, Orders, Client updates). Changes you make are kept in your browser; use "Reset sample data" to start over.
- `DESIGN.md`: the Carbon Copy design language (tokens, type, components, motion, writing).
- `PRODUCT.md`: the problem, evidence, competition, risks and how to test demand.

Preview locally: `npx http-server lading` and open http://localhost:8080. Opening the files directly in a browser also works.

The studio, clients, vendors and emails are made up. Vendor email addresses use the reserved `.example` domain.
