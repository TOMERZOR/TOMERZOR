# Dream Studios

Storefront for Dream Studios, a static site (HTML, CSS, vanilla JS, no build step) in the Nude Project design language.

- `index.html`: home (campaign hero, New Arrivals, category tiles, Created By God denim, Most Wanted, Universe)
- `collection.html#all|tees|denim|wishlist`: collection with tabs, line filters and sorting
- `product.html#<product-id>`: product page with gallery, sizes, size guide and bag
- `assets/js/products.js`: the catalogue. Edit names, prices, sizes and copy here
- `assets/img/`: product and campaign photos

Bag and wishlist are kept in the visitor's browser (localStorage). Checkout and the newsletter form are not connected to a backend yet.

Preview locally: `npx http-server .` and open http://localhost:8080

## Legal checklist before launch

Not legal advice. Check these with a lawyer for the countries you sell to.

- **Business details:** fill in `business` in `assets/js/products.js`. They show in the site footer.
- **Fonts:** self-hosted from `assets/fonts/` (SIL OFL), so no visitor data goes to Google.
- **Tracking:** none. If you add analytics, a pixel or session replay, add a consent banner first, and mask form inputs in any replay tool.
- **Newsletter:** asks for year of birth (minimum age set by `newsletterMinAge`, default 16) and an unticked marketing-consent box. Connect it to your email provider and store the consent date.
- **Marketing emails:** start from `emails/marketing-email.html`. Every email needs the unsubscribe link and your postal address. In Israel, start the subject with "פרסומת".
- **Purchase terms:** shipping, taxes and the 30-day returns policy are shown under Add to Bag and Checkout. Make sure they match your real policy.
- **Still missing:** Privacy Policy, Terms of Sale and Returns pages (the footer Help links are placeholders).
