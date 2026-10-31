# Dream Studios

Storefront for Dream Studios, a static site (HTML, CSS, vanilla JS, no build step) in the Nude Project design language.

- `index.html`: home (campaign hero, New Arrivals, category tiles, Created By God denim, Most Wanted, Universe)
- `collection.html#all|tees|denim|wishlist`: collection with tabs, line filters and sorting
- `help.html#shipping|returns|size-guide|contact|privacy|cookies|terms|accessibility`: help and legal policies
- `product.html#<product-id>`: product page with gallery, sizes, size guide and bag
- `assets/js/products.js`: the catalogue. Edit names, prices, sizes and copy here
- `assets/img/`: product and campaign photos

Bag and wishlist are kept in the visitor's browser (localStorage). Checkout and the newsletter form are not connected to a backend yet.

Preview locally: `npx http-server .` and open http://localhost:8080

## LUNÉ dropshipping store

A complete Hebrew dropshipping store for a satin heatless curling set: Shopify theme, product import, policies, Facebook ads and launch plan. Start with `dropship/README.md`.

## Shopify

The Shopify version of the store is in `shopify-theme/` (also published as the `shopify-theme` branch). Setup steps, policies, pages and a product import file are in `shopify-setup/`; start with `shopify-setup/README.md`.

## Legal checklist before launch

Not legal advice. Have a lawyer review the policies in `help.html` for the countries you sell to.

- **Business details:** fill in `business` in `assets/js/products.js` (legal name, business ID, address, phone, email, accessibility coordinator). They appear in the footer and across the policies.
- **Shipping and returns:** the delivery times, fees and return rules in `shipping` and `returns` are suggested defaults. Change them to match how you actually operate.
- **Policies:** shipping, returns and refunds, size guide, contact, privacy, cookies, terms of sale and accessibility statement are in `help.html`. Update "Last updated" (`policiesUpdated`) whenever you change one. Israeli law expects consumer-facing terms to be available in Hebrew too.
- **Cookies:** the site only uses necessary browser storage, so no banner is shown. When you add analytics or a pixel, set that category's `enabled: true` in `cookies`, load the script inside `DreamConsent.onGrant("analytics", ...)`, and add it to the table in the Cookie Policy. The consent banner then appears automatically.
- **Fonts:** self-hosted from `assets/fonts/` (SIL OFL), so no visitor data goes to Google.
- **Newsletter:** asks for year of birth (minimum age `newsletterMinAge`, default 16) and an unticked marketing-consent box. Connect it to your email provider and store the consent date.
- **Marketing emails:** start from `emails/marketing-email.html`. Every email needs the unsubscribe link and your postal address. In Israel, start the subject with "פרסומת".
- **Accessibility:** the statement in `help.html` says the site aims for IS 5568 (WCAG 2.0 AA). Get an accessibility audit before launch and name a real coordinator.
