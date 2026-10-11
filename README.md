# Dream Studios

Storefront for Dream Studios, a static site (HTML, CSS, vanilla JS, no build step) in the Nude Project design language.

- `index.html`: home (campaign hero, New Arrivals, category tiles, Created By God denim, Most Wanted, Universe)
- `collection.html#all|tees|denim|wishlist`: collection with tabs, line filters and sorting
- `product.html#<product-id>`: product page with gallery, sizes, size guide and bag
- `assets/js/products.js`: the catalogue. Edit names, prices, sizes and copy here
- `assets/img/`: product and campaign photos

Bag and wishlist are kept in the visitor's browser (localStorage). Checkout and the newsletter form are not connected to a backend yet.

Preview locally: `npx http-server .` and open http://localhost:8080
