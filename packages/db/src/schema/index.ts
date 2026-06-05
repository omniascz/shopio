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
// Future: customers, inventory, payments, ...
