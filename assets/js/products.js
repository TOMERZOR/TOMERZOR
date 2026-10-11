/* Dream Studios catalogue.
   Prices, sizes, composition and care below are placeholders: replace them
   with the real specs before launch. Images live in assets/img/. */
window.DREAM = {
  currency: "NIS",
  freeShippingFrom: 400,
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
      id: "portrait-tee",
      name: "Dream Portrait Tee Pink",
      category: "tees",
      line: "Graphic",
      price: 199,
      color: { name: "Washed Pink", hex: "#ebc7cf" },
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      images: ["portrait-tee.jpg"],
      description: "A halftone portrait printed in sepia on washed pink, with the Dream script on the chest.",
      details: ["Boxy, oversized fit with dropped shoulders", "Ribbed crew neck", "100% cotton", "Wash cold, inside out"]
    },
    {
      id: "rodeo-tee",
      name: "Rodeo Grid Tee Baby Blue",
      category: "tees",
      line: "Graphic",
      price: 199,
      color: { name: "Baby Blue", hex: "#cfe0f0" },
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      images: ["rodeo-tee.jpg"],
      description: "Twelve bronco riders in twelve colours, printed as a grid across the front.",
      details: ["Boxy, oversized fit with dropped shoulders", "Ribbed crew neck", "100% cotton", "Wash cold, inside out"]
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
