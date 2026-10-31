import { pgTable, text, integer, doublePrecision, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const giftSessions = pgTable('gift_sessions', {
  id: text('id').primaryKey(),
  giverName: text('giver_name').notNull(),
  recipientFirstName: text('recipient_first_name').notNull(),
  occasion: text('occasion').notNull(),
  budgetMin: integer('budget_min').notNull(),
  budgetMax: integer('budget_max').notNull(),
  mode: text('mode', { enum: ['surprise', 'copick'] }).notNull().default('surprise'),
  status: text('status', { enum: ['created', 'invited', 'ready', 'rendering', 'done', 'deleted'] }).notNull().default('created'),
  inviteTokenHash: text('invite_token_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull(),
}).enableRLS();

export const recipientProfiles = pgTable('recipient_profiles', {
  sessionId: text('session_id').primaryKey().references(() => giftSessions.id),
  consentRender: boolean('consent_render').notNull().default(false),
  consentShareRenders: boolean('consent_share_renders').notNull().default(false),
  deleteAfterDays: integer('delete_after_days').notNull().default(7),
  selfieAssetId: text('selfie_asset_id'),
  handAssetId: text('hand_asset_id'),
  allowedCategories: jsonb('allowed_categories').$type<string[]>().notNull().default([]),
  metalPref: text('metal_pref', { enum: ['gold', 'silver', 'any'] }).notNull().default('any'),
  avoidColors: jsonb('avoid_colors').$type<string[]>().notNull().default([]),
  noGoText: text('no_go_text'),
  shareColorProfile: boolean('share_color_profile').notNull().default(false),
  colorProfileJson: text('color_profile_json'),
}).enableRLS();

export const catalogItems = pgTable('catalog_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category', {
    enum: ['scarf', 'hat', 'bag', 'earrings', 'necklace', 'top', 'ring', 'watch', 'look'],
  }).notNull(),
  price: doublePrecision('price').notNull(),
  currency: text('currency').notNull().default('USD'),
  brand: text('brand').notNull(),
  imageUrl: text('image_url').notNull(),
  imageSpecOk: boolean('image_spec_ok').notNull().default(false),
  metal: text('metal', { enum: ['gold', 'silver'] }),
  colors: jsonb('colors').$type<string[]>().notNull().default([]),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  merchantId: text('merchant_id').notNull(),
}).enableRLS();

export const renders = pgTable('renders', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => giftSessions.id),
  itemId: text('item_id').notNull().references(() => catalogItems.id),
  endpoint: text('endpoint').notNull(),
  youcamTaskId: text('youcam_task_id'),
  status: text('status', { enum: ['queued', 'running', 'success', 'error'] }).notNull().default('queued'),
  resultAssetId: text('result_asset_id'),
  errorCode: text('error_code'),
  unitsSpent: integer('units_spent').notNull().default(0),
  createdAt: ts('created_at').notNull(),
  finishedAt: ts('finished_at'),
}).enableRLS();

export const picks = pgTable('picks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => giftSessions.id),
  itemId: text('item_id').notNull().references(() => catalogItems.id),
  rank: integer('rank').notNull(),
  reasonText: text('reason_text').notNull(),
  caveatText: text('caveat_text').notNull(),
  source: text('source', { enum: ['llm', 'rules'] }).notNull().default('rules'),
  score: integer('score').notNull().default(0),
  signals: jsonb('signals').$type<string[]>().notNull().default([]),
  recipientReaction: text('recipient_reaction', { enum: ['heart', 'veto'] }),
}).enableRLS();

export const assets = pgTable('assets', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['selfie', 'hand', 'render', 'product'] }).notNull(),
  path: text('path').notNull(),
  expiresAt: ts('expires_at'),
}).enableRLS();

export const merchantEvents = pgTable('merchant_events', {
  id: text('id').primaryKey(),
  merchantId: text('merchant_id').notNull(),
  sessionId: text('session_id').notNull(),
  itemId: text('item_id'),
  type: text('type', { enum: ['preview', 'heart', 'veto', 'purchase'] }).notNull(),
  ts: ts('ts').notNull(),
  seeded: boolean('seeded').notNull().default(false),
}).enableRLS();
