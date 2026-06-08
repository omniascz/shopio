// Schema barrel exports
// Base entities (Fáze 0)
export * from './tenants';
export * from './users';
export * from './sessions';
export * from './audit-log-entries';
// Catalog (Wave 1 — `06-catalog-pim.md` + `07-categories-taxonomy.md`)
export * from './categories';
export * from './products';
export * from './product-variants';
export * from './product-media';
export * from './product-categories';
// Commerce (Wave 1 step 5 — `11-cart.md` + `12-checkout.md` + `16-order-management.md`)
export * from './carts';
export * from './orders';
// Tax (Wave 1 — `15-tax-compliance.md`)
export * from './tax-rates';
// Shipping (Wave 1 — `14-shipping.md`)
export * from './shipping';
// Invoicing (Wave 1 — `15-tax-compliance.md` §3.5)
export * from './invoices';
// Returns (Wave 1 — `17-returns-refunds.md` MVP)
export * from './returns';
// Shipments / fulfillment (Wave 1 — `14-shipping.md` §3.1 + `16`)
export * from './shipments';
// Inventory (Wave 1 — `09-inventory.md` reservations + ledger MVP)
export * from './inventory';
// Customers (Wave 1 — `18-customer-management.md` MVP)
export * from './customers';
// Reviews (Wave 1 — `19-marketing-seo.md` reviews MVP)
export * from './reviews';
// Coupons / promotions (Wave 1 — `10-pricing-promotions.md` MVP)
export * from './coupons';
// B2B companies (Wave 1 — `21-b2b-complete.md` MVP)
export * from './companies';
// Sales channels (Wave 1 — `22-multistore-channels.md` MVP)
export * from './channels';
// Content translations (Wave 1 — `23-i18n.md` MVP)
export * from './translations';
// CMS content pages + blog (Wave 1 — `32-cms-content.md` MVP)
export * from './cms';
// Marketplace multi-vendor (Wave 1 — `25-marketplace.md` MVP)
export * from './marketplace';
// Developer platform — API keys + webhooks (Wave 1 — `28-developer-platform.md` MVP)
export * from './developer';
// Payments — provider-abstracted gateways (Wave 1 — `13-payments.md` MVP)
export * from './payments';
// Loyalty / store credit (Wave 1 — `19-marketing-seo.md` MVP)
export * from './loyalty';
// Subscriptions / recurring orders (Wave 1 — `24-subscriptions.md` MVP)
export * from './subscriptions';
// Gift cards / pay-with-balance (Wave 1 — `10-pricing-promotions.md` §3.7 MVP)
export * from './gift-cards';
// Product bundles (Wave 1 — `06-catalog-pim.md` §3.5 MVP)
export * from './bundles';
// Customer address book (Wave 1 — `18-customer-management.md` express checkout)
export * from './customer-addresses';
// OAuth apps + marketplace (Wave 1 — `28-developer-platform.md`)
export * from './oauth';
// Variant price history (EU Omnibus — lowest price in 30 days)
export * from './price-history';
// FX reference rates (P1 multi-currency — ČNB daily fixing)
export * from './exchange-rates';
// Automatic promotions (P2 — `10-pricing-promotions.md` Magento-style cart rules)
export * from './promotions';
// Server-side wishlist (P2 — `18-customer-management.md`)
export * from './wishlist';
// Back-in-stock notifications (Shoptet "Hlídací pes")
export * from './stock-watch';
// Wholesale / B2B price levels (Shoptet "Velkoobchod")
export * from './customer-groups';
// Content extras — glossary + poll (Shoptet "Slovník pojmů" + "Anketa")
export * from './content-extras';
// No-code automation flows (P3 — BaseLinker Automatic Actions / Shopware Flow Builder)
export * from './flows';
// Dynamic collections (P3 — Shopify smart collections / Shopware product streams)
export * from './collections';
// Native email marketing (P3 — `19-marketing-seo.md`)
export * from './newsletter';
