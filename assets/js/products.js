/* Dream Studios catalogue.
   Prices, sizes, composition and care below are placeholders: replace them
   with the real specs before launch. Images live in assets/img/. */
window.DREAM = {
  currency: "NIS",
  // Legal details shown in the footer and required in every marketing email.
  // Replace the bracketed placeholders before launch.
  business: {
    name: "Dream Studios",
    legalName: "[Legal business name]",
    businessId: "[Business ID: ח.פ. / ע.מ.]",
    address: "[Street and number, City, Postal code, Israel]",
    email: "[hello@your-domain.com]",
    phone: "[Phone number]",
    hours: "Sunday–Thursday, 10:00–17:00",
    accessibilityContact: "[Name of accessibility coordinator]",
    courtsCity: "Tel Aviv"
  },
  newsletterMinAge: 16,
  // Shipping and returns terms used across the site and on help.html.
  // These are suggested defaults: confirm each one matches how you actually operate.
  freeShippingFrom: 400,
  shipping: {
    dispatch: "1–2 business days",
    standard: { name: "Standard delivery", time: "3–5 business days", fee: 29 },
    express: { name: "Express delivery", time: "1–2 business days", fee: 49 }
  },
  returns: { days: 30, refundDays: 14 },
  policiesUpdated: "12 October 2026",
  // Optional cookie categories. Set `enabled: true` only when you add a tool that needs it
  // (e.g. Google Analytics, Meta Pixel). The consent banner appears automatically once
  // any category is enabled, and scripts should load through DreamConsent.onGrant().
  cookies: {
    analytics: { enabled: false, label: "Analytics", text: "Helps us understand how the store is used, like which pages are visited." },
    marketing: { enabled: false, label: "Marketing", text: "Lets us measure our ads and show you relevant ones on other sites." }
  },
  season: "FW26 · 01",
  categories: {
    tees: "T-Shirts",
    denim: "Denim"
  },
  products: [
    {
      id: "circle-logo-tee",
      name: "Circle Logo Tee Navy",
      category: "tees",
      line: "Logo",
      price: 189,
      tag: "New",
      color: { name: "Washed Navy", hex: "#252a3a" },
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      images: ["circle-tee-back.jpg", "circle-tee-front.jpg", "lifestyle-crop.jpg"],
      description: "The Dream Studios® circle logo, printed large across the back in mustard. Clean front with a small file-name print at the hem.",
      details: ["Boxy, oversized fit with dropped shoulders", "Ribbed crew neck", "100% cotton", "Wash cold, inside out"]
    },
    {
      id: "warriors-tee",
      name: "Warriors With A Dream Tee",
      category: "tees",
      line: "Graphic",
      price: 199,
      tag: "New",
      color: { name: "White", hex: "#f4f3ef" },
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      images: ["warriors-tee-back.jpg", "warriors-tee-front.jpg"],
      description: "Three warriors looking up, printed in red across the back over “warriors with a Dream © est 2026”. Italic DREAMSTUDIOS wordmark on the chest.",
      details: ["Boxy, oversized fit with dropped shoulders", "Ribbed crew neck", "100% cotton", "Wash cold, inside out"]
    },
    {
      id: "created-by-god-shorts",
      name: "Created By God Denim Shorts",
      category: "denim",
      line: "Denim",
      price: 349,
      tag: "New",
      color: { name: "Vintage Wash", hex: "#7d96b4" },
      sizes: ["28", "30", "32", "34", "36"],
      images: ["shorts-back.jpg", "lifestyle-crop.jpg"],
      description: "Baggy jorts in a sun-faded vintage wash. Creation hands printed on both back pockets, “Created By god” in yellow and a leather Dream patch at the waist.",
      details: ["Baggy fit, knee length", "Five-pocket construction", "Leather back patch", "100% cotton denim", "Wash cold, inside out"]
    },
    {
      id: "graphic-designer-tee",
      name: "In Need For Graphic Designer Tee",
      category: "tees",
      line: "Graphic",
      price: 169,
      color: { name: "White", hex: "#f4f3ef" },
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      images: ["designer-tee.jpg"],
      description: "Hand-drawn blue lettering across the chest, signed with a small Dream script underneath.",
      details: ["Boxy, oversized fit with dropped shoulders", "Ribbed crew neck", "100% cotton", "Wash cold, inside out"]
    }
  ]
};
