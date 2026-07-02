/**
 * Background-job runner (per `09`/Fáze 1) — one small abstraction over two
 * backends so the scheduled sweepers (reservations, abandoned carts,
 * subscriptions, FX, flow retries) don't care how they're driven:
 *
 *   - `interval` (default): in-process `setInterval` timers, overlap-guarded and
 *     `.unref()`ed. Identical to the pre-BullMQ behaviour — dev/CI need no Redis.
 *   - `bullmq`: durable repeatable jobs on Redis, so a multi-instance / restart
 *     deployment runs each job exactly on schedule without double-firing.
 *     Selected by `JOBS_BACKEND=bullmq` (+ `REDIS_URL`); prod sets this.
 *
 * Handlers are the same in both backends. A handler that throws is logged and
 * swallowed — one bad tick never kills the schedule.
 */

import type { FastifyBaseLogger } from 'fastify';
import type { ShopioConfig } from '../config';

export interface JobSpec {
  /** Stable id — also the BullMQ repeatable-job key. */
  name: string;
  everyMs: number;
  handler: () => Promise<unknown>;
  /** Run once immediately on start (e.g. FX rates on boot). */
  runOnStart?: boolean;
}

export interface JobRunner {
  readonly backend: 'interval' | 'bullmq';
  register(spec: JobSpec): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** Run a handler with overlap-guard + error isolation. */
async function runGuarded(spec: JobSpec, state: { running: boolean }, log: FastifyBaseLogger): Promise<void> {
  if (state.running) return;
  state.running = true;
  try {
    await spec.handler();
  } catch (err) {
    log.error({ err, job: spec.name }, 'job.failed');
  } finally {
    state.running = false;
  }
}

class IntervalRunner implements JobRunner {
  readonly backend = 'interval' as const;
  private specs: JobSpec[] = [];
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly log: FastifyBaseLogger) {}

  register(spec: JobSpec): void {
    this.specs.push(spec);
  }

  async start(): Promise<void> {
    for (const spec of this.specs) {
      const state = { running: false };
      if (spec.runOnStart) void runGuarded(spec, state, this.log);
      const timer = setInterval(() => void runGuarded(spec, state, this.log), spec.everyMs);
      timer.unref(); // never keep the process alive just for a sweeper
      this.timers.push(timer);
    }
    this.log.info({ backend: this.backend, jobs: this.specs.length }, 'jobs.started');
  }

  async stop(): Promise<void> {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }
}

class BullmqRunner implements JobRunner {
  readonly backend = 'bullmq' as const;
  private specs: JobSpec[] = [];
  private handlers = new Map<string, JobSpec>();
  private queue: import('bullmq').Queue | null = null;
  private worker: import('bullmq').Worker | null = null;

  constructor(
    private readonly redisUrl: string,
    private readonly log: FastifyBaseLogger,
  ) {}

  register(spec: JobSpec): void {
    this.specs.push(spec);
    this.handlers.set(spec.name, spec);
  }

  /** Plain ioredis options from the URL — BullMQ builds the connection itself
   *  (and sets maxRetriesPerRequest: null). Avoids depending on a specific
   *  ioredis instance version. */
  private connectionOptions(): Record<string, unknown> {
    const u = new URL(this.redisUrl);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
      ...(u.pathname.length > 1 ? { db: Number(u.pathname.slice(1)) } : {}),
      maxRetriesPerRequest: null,
    };
  }

  async start(): Promise<void> {
    const { Queue, Worker } = await import('bullmq');
    const connection = this.connectionOptions();
    const QUEUE = 'shopio-jobs';

    this.queue = new Queue(QUEUE, { connection });
    this.worker = new Worker(
      QUEUE,
      async (job) => {
        const spec = this.handlers.get(job.name);
        if (!spec) return;
        await spec.handler(); // errors bubble to the worker 'failed' handler (logged)
      },
      { connection },
    );
    this.worker.on('failed', (job, err) => this.log.error({ err, job: job?.name }, 'job.failed'));

    for (const spec of this.specs) {
      // Idempotent repeatable job keyed by name — re-registering replaces it.
      await this.queue.add(
        spec.name,
        {},
        { repeat: { every: spec.everyMs }, jobId: spec.name, removeOnComplete: true, removeOnFail: 100 },
      );
      // Boot run: same job name (so the worker finds the handler), no jobId.
      if (spec.runOnStart) await this.queue.add(spec.name, {}, { removeOnComplete: true });
    }
    this.log.info({ backend: this.backend, jobs: this.specs.length }, 'jobs.started');
  }

  async stop(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.worker = null;
    this.queue = null;
  }
}

/** Pick the backend from config. Falls back to interval if bullmq lacks a URL. */
export function createJobRunner(config: ShopioConfig, log: FastifyBaseLogger): JobRunner {
  if (config.JOBS_BACKEND === 'bullmq') {
    if (config.REDIS_URL) return new BullmqRunner(config.REDIS_URL, log);
    log.warn('JOBS_BACKEND=bullmq but REDIS_URL is unset — falling back to interval timers');
  }
  return new IntervalRunner(log);
}
