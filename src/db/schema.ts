import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Better Auth tables: field names follow the library's expected model.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Training: a session holds exercise runs, a run holds its raw trials.
// Raw trials are the source of truth; results can always be recomputed from them.

export const sessionKind = pgEnum("session_kind", ["free_practice", "bet", "light", "assessment"]);
export const runStatus = pgEnum("run_status", ["in_progress", "completed", "incomplete"]);
export const sessionContext = pgEnum("session_context", ["rest", "before_sport", "after_sport"]);
export const trialOutcome = pgEnum("trial_outcome", ["hit", "error", "lapse", "miss", "false_start"]);

export const trainingSession = pgTable(
  "training_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: sessionKind("kind").notNull(),
    status: runStatus("status").notNull().default("in_progress"),
    device: text("device").notNull(),
    inputMode: text("input_mode").notNull(),
    userAgent: text("user_agent"),
    /** BET sessions: when the session sits relative to physical activity, and the chosen duration. */
    context: sessionContext("context"),
    durationMin: integer("duration_min"),
    /** Self-ratings on 0-10 scales, before and after the session. */
    preFatigue: integer("pre_fatigue"),
    postFatigue: integer("post_fatigue"),
    perceivedEffort: integer("perceived_effort"),
    motivation: integer("motivation"),
    /** Completed load: perceived effort times duration in minutes. */
    sessionLoad: integer("session_load"),
    /** Why the planned session looks as it does (weaknesses, targeted domains, BET rotation). */
    planExplanation: jsonb("plan_explanation"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [index("training_session_user_started_idx").on(table.userId, table.startedAt)],
);

export const exerciseRun = pgTable(
  "exercise_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => trainingSession.id, { onDelete: "cascade" }),
    exercise: text("exercise").notNull(),
    /** Part of the session the run belongs to (assessment: cold, bet, fatigued); null in free practice. */
    block: text("block"),
    /** Saved level this run reads and updates (such as "stroop:bet"); null means the exercise itself. */
    difficultyKey: text("difficulty_key"),
    position: integer("position").notNull(),
    config: jsonb("config").notNull(),
    seed: bigint("seed", { mode: "number" }).notNull(),
    status: runStatus("status").notNull().default("in_progress"),
    pauses: jsonb("pauses").notNull().default([]),
    results: jsonb("results"),
    /** Level and parameters at the start and end of the run; null for exercises without difficulty. */
    difficultyStart: jsonb("difficulty_start"),
    difficultyEnd: jsonb("difficulty_end"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [index("exercise_run_session_idx").on(table.sessionId)],
);

export const trial = pgTable(
  "trial",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => exerciseRun.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    practice: boolean("practice").notNull(),
    onsetMs: doublePrecision("onset_ms"),
    responseMs: doublePrecision("response_ms"),
    rtMs: doublePrecision("rt_ms"),
    outcome: trialOutcome("outcome").notNull(),
    correct: boolean("correct").notNull(),
    stimulus: jsonb("stimulus"),
    response: jsonb("response"),
    difficulty: jsonb("difficulty"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // The (run, index) key makes re-sent batches idempotent.
  (table) => [primaryKey({ columns: [table.runId, table.index] })],
);

/** Current difficulty level per user and exercise; each run starts where the last one ended. */
export const difficultyState = pgTable(
  "difficulty_state",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    exercise: text("exercise").notNull(),
    level: doublePrecision("level").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.userId, table.exercise] })],
);

/** An assessment: a fixed protocol run as one session; results hold the score per domain. */
export const assessment = pgTable(
  "assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .unique()
      .references(() => trainingSession.id, { onDelete: "cascade" }),
    protocolVersion: integer("protocol_version").notNull(),
    status: runStatus("status").notNull().default("in_progress"),
    results: jsonb("results"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("assessment_user_started_idx").on(table.userId, table.startedAt)],
);
