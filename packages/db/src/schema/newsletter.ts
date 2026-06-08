/**
 * `newsletter_subscribers` + `email_campaigns` — native email marketing (P3,
 * per `19-marketing-seo.md`). Both Shopify (Email) and Wix have this natively;
 * BigCommerce only via apps — so a native list + campaign sender is a
 * differentiator.
 *
 * A subscriber is an opted-in email (a registered customer or a guest who used
 * the newsletter box). Each carries an unsubscribe token for the one-click
 * opt-out link (legally required). A campaign is composed once and sent to the
 * active subscribers; sending is inline + best-effort (BullMQ later).
 */

import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';

export const newsletterSubscribers = pgTable(
  'newsletter_subscribers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(), // lowercased
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['active', 'unsubscribed'] })
      .notNull()
      .default('active'),
    /** Opaque token for the one-click unsubscribe link. */
    unsubscribeToken: text('unsubscribe_token').notNull(),
    source: text('source'), // 'storefront' | 'checkout' | 'import' | ...
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  },
  (t) => ({
    emailUnique: uniqueIndex('uq_newsletter_subscribers_email').on(t.tenantId, t.email),
    tokenUnique: uniqueIndex('uq_newsletter_subscribers_token').on(t.unsubscribeToken),
    statusIdx: index('idx_newsletter_subscribers_status').on(t.tenantId, t.status),
  }),
);

export const emailCampaigns = pgTable(
  'email_campaigns',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // cmp_ NanoID
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull().default(''),
    status: text('status', { enum: ['draft', 'sending', 'sent'] })
      .notNull()
      .default('draft'),
    recipientCount: integer('recipient_count').notNull().default(0),
    sentCount: integer('sent_count').notNull().default(0),
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_email_campaigns_pub_id').on(t.tenantId, t.pubId),
    tenantIdx: index('idx_email_campaigns_tenant').on(t.tenantId, t.status),
  }),
);

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
