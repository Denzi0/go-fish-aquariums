# GoFishAquariums — Shopify Online Store 2.0 theme

A B2B theme for a freshwater livestock wholesaler. Everything is server-rendered
Liquid with one stylesheet and one small vanilla JS file. No app dependencies.

## Install

1. Zip the contents of this folder (the folder itself must not be inside the zip —
   `assets/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/` and
   `templates/` sit at the root).
2. Shopify admin → Online Store → Themes → Add theme → Upload zip file.
3. Preview, then Customize.

Or with Shopify CLI:

```bash
shopify theme dev --store your-store.myshopify.com
shopify theme push
```

## Catalogue mode (the trade gate)

The theme ships in catalogue mode. Guests can browse every species, size grade,
scientific name and stock count — which keeps the catalogue genuinely useful and
indexable — but pricing, quantity selectors, the add-to-order button and the cart
icon are all hidden until they sign in. A gate panel on the collection, product,
search and cart pages explains why and links to login and the application form.

Online Store → Themes → Customize → Theme settings → **Trade access**

- **Who can see pricing**
  - *Approved trade customers only (tagged)* — the default, and the one to keep.
    Anyone can create a Shopify account unprompted, so the customer tag is what
    actually stops the public seeing wholesale rates. Tag approved customers with
    `trade` in admin and pricing appears for them immediately.
  - *Any signed-in customer* — pricing unlocks the moment someone registers, with
    no approval step. Simpler, but a competitor can self-serve your price list.
  - *Everyone* — pricing public. Only useful while you are building the site.
- **Customer tag that unlocks pricing** — defaults to `trade`. Shopify B2B company
  contacts (`customer.b2b?`) are always treated as approved regardless of tags.
- **Gate heading / Gate message** — the copy shown to visitors who cannot see
  pricing.

One rule, one place: `snippets/price-access.liquid` decides access and every
template asks it, so the card, the product page, the header, the cart, search and
quick order can never disagree with each other.

### How airtight is it?

Theme-level gating hides the UI and is enough for ordinary visitors and for
search engines. It is not a hard server-side lock: Shopify's `/cart/add.js`
endpoint stays open, so someone who knows a variant ID could still post to it.
If you need a true lock, the options are, in order of effort:

1. **Shopify B2B catalogs** (Plus) — pricing and products are scoped to companies
   server-side. The theme already reads `quantity_rule` and
   `quantity_price_breaks`, so it works with this out of the box.
2. **A locked-catalogue app** — several enforce login at the request level.
3. **Storefront password** — closes the whole store, including to Google.

Most wholesalers in this position run exactly what this theme does and accept the
edge case, because the catalogue being indexable is worth more than sealing a gap
nobody walks through.

Theme settings → **Stock** sets the count at which cards flip to the amber
*Limited* state.

## Product metafields

Create these under Settings → Custom data → Products, namespace `gofish`.
Everything is optional — the card and product page hide any row you leave empty.

| Key | Type | Example | Where it shows |
|---|---|---|---|
| `scientific_name` | Single line text | `Corydoras aeneus` | Card, product page, cart |
| `size_range` | Single line text | `4–5 cm` | Card spec row, snapshot |
| `grade` | Single line text | `A` | Card spec row |
| `bag_qty` | Integer | `25` | Card spec row, quantity step |
| `moq` | Integer | `50` | Minimum quantity on the card |
| `origin` | Single line text | `Bred in QLD` | Product page |
| `water_params` | Single line text | `pH 6.5–7.5, 24–27°C` | Product page |
| `next_arrival` | Single line text | `Week of 6 Oct` | Out-of-stock cards |
| `price_breaks` | JSON | `[{"qty":10,"price":220},{"qty":50,"price":195}]` | Card and product page (prices in cents, ex GST) |
| `body_shape` | Single line text | `cory` | Picks the drawn placeholder when a product has no photo: `fusiform`, `cory`, `betta`, `koi`, `angel`, `pleco` |

### Quantity rules and volume pricing

If the store is on a plan with native Shopify B2B, the theme reads
`variant.quantity_rule` (minimum, increment, maximum) and
`variant.quantity_price_breaks` first — set those on the company location or
catalogue and the card follows automatically. The `moq`, `bag_qty` and
`price_breaks` metafields are the fallback for stores without B2B, so you can
start on the metafields and migrate later without touching the theme.

## Templates

| Template | Section | Notes |
|---|---|---|
| `index.json` | hero-stocklist, category-grid, featured-fish, why-choose, wholesale-cta | All sections are reorderable and removable in the editor |
| `collection.json` | main-collection | Storefront filters, sort, grid/list toggle |
| `product.json` | main-product | Volume price table, spec table, buy box |
| `page.quick-order.json` | quick-order | Create a page with the handle `quick-order` and assign this template |
| `page.wholesale.json` | main-page + wholesale-cta | For the Wholesale page |
| `customers/register.json` | main-register | Trade application: business name, ABN, business type saved to the customer note |

## Sections in the theme editor

Every homepage section is configurable, with presets so they can be added to any
page. `hero-stocklist` pulls its snapshot rows from a collection you choose, so
the "this week's list" panel is live data rather than typed-in text.

## Everything comes from Shopify

Nothing in the theme hard-codes a menu item, a category or a product. The whole
site is driven by what you set up in admin.

**Navigation** — the header reads whichever menu you pick in its settings
(`main-menu` by default). Nest items in Shopify's menu editor and they become
dropdowns automatically, up to two levels deep. A nested collection link shows
its product count beside it. Mobile gets the same tree as collapsible groups.
Add a category in admin, it appears in the nav; remove it, it's gone.

**Shop by category** — set *Tiles come from* to **A Shopify menu** and point it
at a menu of collections. Each tile takes its label from the menu item, its
count from `all_products_count`, and its image from the collection's own image
(falling back to the first product's photo, then a drawn icon). Build a
"Categories" menu in admin and this section maintains itself. Switch to
*Hand-picked tiles* if you want to control order and labels by hand.

**Featured fish and the hero snapshot** — both take a collection picker, and
both fall back to all products if you haven't chosen one, so the homepage looks
right the moment the theme is installed.

**Collection pages** — products, filters, sort options, product counts,
pagination and the banner image all come from the collection and from Shopify's
Search & Discovery settings. Add a filter there and it appears in the sidebar.

**Products and size grades** — if a product has variants, both the card and the
product page render a picker. On a card the price swaps in place without a page
load. On the product page it reloads with `?variant=`, so the price breaks,
stock count, SKU and quantity rules all come back from Liquid rather than being
patched by JavaScript and drifting out of sync. Size grade is the natural
variant for livestock: one product, several grades, each with its own price and
stock.

**Footer** — two link lists plus a contact block, and the policy links come from
`shop.policies`, so they follow whatever you publish in Settings → Policies.

### Suggested menu structure

```
main-menu
├── Home
├── Fish
│   ├── Tropical fish
│   │   ├── Tetras
│   │   ├── Barbs
│   │   └── Gouramis
│   ├── Catfish & loaches
│   ├── Livebearers
│   └── Goldfish & koi
├── Aquarium products
├── Wholesale
├── About us
└── Contact
```

## The product card

`snippets/fish-card.liquid` is the one card used everywhere — homepage, collection,
search, quick view. Render it with:

```liquid
{% render 'fish-card', product: product %}
{% render 'fish-card', product: product, show_quick_view: false, lazy: false %}
```

It handles four stock states (in stock, limited, next run, unavailable), the
price gate, minimum order quantities, bag increments, volume breaks, and a
quantity stepper that snaps typed values up to the next whole bag.

In list view (`[data-view="list"]` on the grid) the same markup becomes a dense
row for buyers reordering from a known list — no second template to maintain.

## Performance notes

- One stylesheet (~24 KB), one deferred script (~7 KB), no framework.
- Images use `image_tag` with `srcset` and `sizes`; cards below the fold lazy-load.
- Google Fonts are preconnected and loaded with `display=swap`. If you would
  rather avoid the third-party request, swap the `<link>` in `layout/theme.liquid`
  for Shopify's `font_picker` settings or self-host the three families in
  `assets/`.
- Products with no photograph fall back to a drawn SVG silhouette rather than a
  grey box, so a part-built catalogue still looks finished.

## Accessibility

Visible focus rings, `aria-current` on the active nav item, labelled quantity
inputs and icon buttons, `prefers-reduced-motion` respected, and semantic
`<dl>`/`<table>` markup for spec data.
