import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

const json = <T>() => ({ mode: 'json' as const }) as { mode: 'json' };

export const giftSessions = sqliteTable('gift_sessions', {
  id: text('id').primaryKey(),
  giverName: text('giver_name').notNull(),
  recipientFirstName: text('recipient_first_name').notNull(),
  occasion: text('occasion').notNull(),
  budgetMin: integer('budget_min').notNull(),
  budgetMax: integer('budget_max').notNull(),
  mode: text('mode', { enum: ['surprise', 'copick'] }).notNull().default('surprise'),
  status: text('status', { enum: ['created', 'invited', 'ready', 'rendering', 'done', 'deleted'] }).notNull().default('created'),
  inviteTokenHash: text('invite_token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const recipientProfiles = sqliteTable('recipient_profiles', {
  sessionId: text('session_id').primaryKey().references(() => giftSessions.id),
  consentRender: integer('consent_render', { mode: 'boolean' }).notNull().default(false),
  consentShareRenders: integer('consent_share_renders', { mode: 'boolean' }).notNull().default(false),
  deleteAfterDays: integer('delete_after_days').notNull().default(7),
  selfieAssetId: text('selfie_asset_id'),
  handAssetId: text('hand_asset_id'),
  allowedCategories: text('allowed_categories', json<string[]>()).$type<string[]>().notNull().default([]),
  metalPref: text('metal_pref', { enum: ['gold', 'silver', 'any'] }).notNull().default('any'),
  avoidColors: text('avoid_colors', json<string[]>()).$type<string[]>().notNull().default([]),
  noGoText: text('no_go_text'),
  shareColorProfile: integer('share_color_profile', { mode: 'boolean' }).notNull().default(false),
  colorProfileJson: text('color_profile_json'),
});

export const catalogItems = sqliteTable('catalog_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category', {
    enum: ['scarf', 'hat', 'bag', 'earrings', 'necklace', 'top', 'ring', 'watch', 'look'],
  }).notNull(),
  price: real('price').notNull(),
  currency: text('currency').notNull().default('USD'),
  brand: text('brand').notNull(),
  imageUrl: text('image_url').notNull(),
  imageSpecOk: integer('image_spec_ok', { mode: 'boolean' }).notNull().default(false),
  metal: text('metal', { enum: ['gold', 'silver'] }),
  colors: text('colors', json<string[]>()).$type<string[]>().notNull().default([]),
  tags: text('tags', json<string[]>()).$type<string[]>().notNull().default([]),
  merchantId: text('merchant_id').notNull(),
});

export const renders = sqliteTable('renders', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => giftSessions.id),
  itemId: text('item_id').notNull().references(() => catalogItems.id),
  endpoint: text('endpoint').notNull(),
  youcamTaskId: text('youcam_task_id'),
  status: text('status', { enum: ['queued', 'running', 'success', 'error'] }).notNull().default('queued'),
  resultAssetId: text('result_asset_id'),
  errorCode: text('error_code'),
  unitsSpent: integer('units_spent').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
});

export const picks = sqliteTable('picks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => giftSessions.id),
  itemId: text('item_id').notNull().references(() => catalogItems.id),
  rank: integer('rank').notNull(),
  reasonText: text('reason_text').notNull(),
  caveatText: text('caveat_text').notNull(),
  source: text('source', { enum: ['llm', 'rules'] }).notNull().default('rules'),
  score: integer('score').notNull().default(0),
  signals: text('signals', json<string[]>()).$type<string[]>().notNull().default([]),
  recipientReaction: text('recipient_reaction', { enum: ['heart', 'veto'] }),
});

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['selfie', 'hand', 'render', 'product'] }).notNull(),
  path: text('path').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
});

export const merchantEvents = sqliteTable('merchant_events', {
  id: text('id').primaryKey(),
  merchantId: text('merchant_id').notNull(),
  sessionId: text('session_id').notNull(),
  itemId: text('item_id'),
  type: text('type', { enum: ['preview', 'heart', 'veto', 'purchase'] }).notNull(),
  ts: integer('ts', { mode: 'timestamp' }).notNull(),
  seeded: integer('seeded', { mode: 'boolean' }).notNull().default(false),
});
