# Setting up Dream Studios on Shopify

The theme lives in `shopify-theme/`. It is also published on its own as the **`shopify-theme`** branch of this repo, with the theme files at the root, which is what Shopify's GitHub connection needs.

Work through the steps in order. Steps 1–3 get the store running; the rest fill it in.

## 1. Store basics (Settings)

- **General → Store currency:** Israeli New Shekel (ILS).
- **General → Store currency → Change formatting:** to show prices like `189 NIS`, set both "HTML with currency" and "HTML without currency" to `{{amount_no_decimals}} NIS`.
- **Taxes and duties:** set your prices to include tax, since Israeli consumer prices include VAT.
- **Store details:** add your legal business name, address, phone and email. The footer shows the address and email from here.

## 2. Install the theme

1. **Online Store → Themes → Add theme → Connect from GitHub.**
2. Log in to GitHub, choose the **TOMERZOR/TOMERZOR** repository and the **`shopify-theme`** branch.
3. When it finishes, click **Customize** to check it, then **Publish**.

Changes you make in the theme editor are saved back to that branch automatically, and changes pushed to the branch appear in Shopify.

## 3. Payments, shipping and invoices

- **Payments:** Shopify Payments isn't available in Israel. Install an Israeli payment provider's Shopify app (one that supports Israeli cards and Bit) and activate it under **Settings → Payments**.
- **Shipping and delivery:** create a rate for Israel. The site's text assumes Standard 29 NIS (3–5 business days), Express 49 NIS (1–2 business days), and free Standard on orders of 400 NIS or more. If you choose different numbers, also change the announcement bar, the "Shipping & Returns" tab on the product page, and the policies.
- **Tax invoices:** install an Israeli invoicing app (for example Morning / Green Invoice or iCount) so each order gets a legal tax invoice.

## 4. Products

1. **Products → Import** and upload `products.csv`. It creates the 4 products with their sizes and prices as **drafts**.
2. Open each product and add its photos from `assets/img/` in this repo. Put the photo you want shown first at the top; the second photo shows when someone hovers over the product.
3. Set the stock for each size, then change the product's status to **Active**.
4. Products tagged `new` show a "New" label. Products with a **Color** option show colour swatches. Set the swatch colour on the option value.

## 5. Collections

- **New Arrivals:** automated, condition "Product tag is equal to new".
- **T-Shirts:** automated, condition "Product type is equal to T-Shirts".
- **Denim:** automated, condition "Product type is equal to Denim".

To show filters on collection pages (size, product type, price), install Shopify's free **Search & Discovery** app and add the filters there.

## 6. Pages

Create these under **Online Store → Pages**. For pages with an HTML file, click **Show HTML** (`<>`) in the editor and paste the file's contents.

| Page | Template | Content |
| --- | --- | --- |
| Wishlist | `page.wishlist` | Leave empty |
| Contact | `page.contact` | A short intro line |
| Size Guide | `page` | `pages/size-guide.html` |
| Cookie Policy | `page` | `pages/cookie-policy.html` |
| Accessibility Statement | `page` | `pages/accessibility-statement.html` |

## 7. Policies

**Settings → Policies.** Paste each file (using Show HTML):

- Refund policy: `policies/refund-policy.html`
- Privacy policy: `policies/privacy-policy.html`
- Terms of service: `policies/terms-of-service.html`
- Shipping policy: `policies/shipping-policy.html`
- Contact information: `policies/contact-information.html`

Replace every `[bracketed]` placeholder with your real details first, and have a lawyer review the texts. Israeli law expects consumer terms to be available in Hebrew too.

## 8. Menus

**Online Store → Navigation.**

- **Main menu** (`main-menu`): New Arrivals, T-Shirts, Denim, Universe. Shown in the header on desktop and as the big links in the menu.
- **Footer** (`footer`), **Help** (`help`) and **Universe** (`universe`): the three footer columns. Help should link to the shipping and refund policies, the size guide and contact pages.
- Optional: a menu for category rows and one for bottom rows (for example Universe, Support) in the phone menu. Choose them in the theme editor under **Header**.

## 9. Theme editor

**Online Store → Themes → Customize.**

- **Home page:** choose images for the Hero, Category tiles and Campaign banner (the theme uses your current photos until you do), and pick the New Arrivals collection for each product row.
- **Product page:** choose the Size Guide page under **Product → Size guide page**.
- **Collection page:** choose a menu for the category tabs (for example New Arrivals, T-Shirts, Denim).
- **Theme settings → Legal:** legal business name, business ID, Cookie Policy page and Accessibility Statement page.
- **Theme settings → Wishlist:** choose the Wishlist page so the header heart links to it.
- **Theme settings → Cart:** free-shipping amount and return period shown next to the checkout button.

## 10. Cookie banner and newsletter

- **Settings → Customer privacy → Cookie banner:** turn it on (show it in all regions, or at least Israel and the EU). The "Cookie Settings" link in the footer reopens it.
- Newsletter signups appear in **Customers** with the tag `newsletter` and email marketing consent recorded. The signup form asks for year of birth and requires an unticked consent box before submitting.
- Marketing emails sent with Shopify Email include an unsubscribe link and your store address automatically. In Israel, start the subject line with "פרסומת".

## 11. Hebrew

**Settings → Languages → Add language → Hebrew**, then publish it. The theme switches to right-to-left with Hebrew interface text, and the menu shows a language switcher. Translate product names and pages with Shopify's free **Translate & Adapt** app.

## Fonts

The theme's fonts are self-hosted, so visitors' browsers don't contact Google. Their licences (SIL Open Font License) are in `font-licences/`.
