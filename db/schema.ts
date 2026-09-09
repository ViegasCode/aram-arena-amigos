import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    riotId: text('riot_id').notNull(),
    tagline: text('tagline').notNull(),
    puuid: text('puuid'),
    userId: text('user_id'),
    icon: text('icon').notNull().default(''),
    active: integer('active').notNull().default(1),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('players_riot_account').on(t.riotId, t.tagline),
    uniqueIndex('players_user_account').on(t.userId),
  ],
);
export const championships = sqliteTable('championships', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  rules: text('rules').notNull(),
  version: integer('version').notNull().default(1),
});
export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey(),
    championshipId: text('championship_id').notNull(),
    status: text('status').notNull(),
    teams: text('teams').notNull(),
    createdAt: text('created_at').notNull(),
    confirmedAt: text('confirmed_at'),
    completedAt: text('completed_at'),
    duration: integer('duration'),
    winner: integer('winner'),
    matchId: text('match_id'),
    source: text('source').notNull().default('manual'),
    rules: text('rules'),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    uniqueIndex('one_current_match')
      .on(t.championshipId)
      .where(sql`${t.status} in ('draft','confirmed')`),
    uniqueIndex('unique_riot_match').on(t.matchId),
  ],
);
export const results = sqliteTable(
  'match_players',
  {
    id: text('id').primaryKey(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    team: integer('team').notNull(),
    champion: text('champion').notNull(),
    stats: text('stats').notNull(),
    grade: real('grade').notNull(),
    explanation: text('explanation').notNull(),
    win: integer('win').notNull(),
    bonus: real('bonus').notNull(),
    points: real('points').notNull(),
  },
  (t) => [
    uniqueIndex('result_once').on(t.matchId, t.playerId),
    index('results_player').on(t.playerId),
  ],
);
export const adjustments = sqliteTable('adjustments', {
  id: text('id').primaryKey(),
  playerId: text('player_id')
    .notNull()
    .references(() => players.id),
  points: real('points').notNull(),
  reason: text('reason').notNull(),
  createdAt: text('created_at').notNull(),
});
export const audit = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  createdAt: text('created_at').notNull(),
});
