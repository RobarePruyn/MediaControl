/**
 * Admin routes for trigger (automation script) management.
 * Triggers allow operators to define and execute multi-step automation
 * sequences against groups of endpoints.
 * @module api-server/routes/admin/triggers
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import {
  triggers,
  triggerActions,
  triggerTargets,
  triggerExecutions,
  venues,
} from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { BridgeClient } from '../../services/bridgeClient.js';
import type { StateCache } from '../../services/stateCache.js';
import { executeTrigger } from '../../services/triggerEngine.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  venueId: z.string().uuid(),
  description: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const setActionsSchema = z.object({
  actions: z.array(z.object({
    actionOrder: z.number().int().min(0),
    actionType: z.enum(['command', 'delay', 'conditional']),
    config: z.record(z.unknown()),
  })),
});

const setTargetsSchema = z.object({
  targets: z.array(z.object({
    targetType: z.enum(['group', 'venue']),
    targetId: z.string().uuid(),
  })),
});

/**
 * Create trigger admin routes.
 * @param db - Database client
 * @param bridgeClient - Bridge agent client (for trigger execution)
 * @param stateCache - Redis state cache (for trigger execution)
 * @param encryptionKey - Credential encryption key (for trigger execution)
 */
export function createTriggerRoutes(
  db: Database,
  bridgeClient?: BridgeClient,
  stateCache?: StateCache,
  encryptionKey?: string,
): RouterType {
  const router: RouterType = Router();

  /** GET /api/admin/triggers — List triggers for venue */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    const result = await db
      .select({ trigger: triggers })
      .from(triggers)
      .innerJoin(venues, eq(triggers.venueId, venues.id))
      .where(and(eq(venues.tenantId, tenantId), isNull(triggers.deletedAt)));

    res.json({ success: true, data: result.map((r) => r.trigger) });
  });

  /** POST /api/admin/triggers — Create trigger */
  router.post('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const { user } = req as AuthenticatedRequest;
    const body = createSchema.parse(req.body);

    const [venue] = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, body.venueId), eq(venues.tenantId, tenantId)));

    if (!venue) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Venue not found', 404);
    }

    const [created] = await db
      .insert(triggers)
      .values({
        venueId: body.venueId,
        name: body.name,
        description: body.description,
        createdBy: user.sub,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  });

  /** GET /api/admin/triggers/:id — Get trigger with actions and targets */
  router.get('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [result] = await db
      .select({ trigger: triggers })
      .from(triggers)
      .innerJoin(venues, eq(triggers.venueId, venues.id))
      .where(and(eq(triggers.id, id), eq(venues.tenantId, tenantId), isNull(triggers.deletedAt)));

    if (!result) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Trigger not found', 404);
    }

    const actions = await db
      .select()
      .from(triggerActions)
      .where(eq(triggerActions.triggerId, id))
      .orderBy(triggerActions.actionOrder);

    const targets = await db
      .select()
      .from(triggerTargets)
      .where(eq(triggerTargets.triggerId, id));

    res.json({
      success: true,
      data: { ...result.trigger, actions, targets },
    });
  });

  /** PATCH /api/admin/triggers/:id — Update trigger */
  router.patch('/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [updated] = await db
      .update(triggers)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(triggers.id, id))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Trigger not found', 404);
    }

    res.json({ success: true, data: updated });
  });

  /** DELETE /api/admin/triggers/:id — Soft delete */
  router.delete('/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);

    await db.update(triggers).set({ deletedAt: new Date() }).where(eq(triggers.id, id));
    res.status(204).send();
  });

  /** POST /api/admin/triggers/:id/actions — Set action list (replace) */
  router.post('/:id/actions', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = setActionsSchema.parse(req.body);

    // Delete existing actions
    await db.delete(triggerActions).where(eq(triggerActions.triggerId, id));

    // Insert new actions
    if (body.actions.length > 0) {
      await db.insert(triggerActions).values(
        body.actions.map((a) => ({
          triggerId: id,
          actionOrder: a.actionOrder,
          actionType: a.actionType,
          config: a.config,
        })),
      );
    }

    await db.update(triggers).set({ updatedAt: new Date() }).where(eq(triggers.id, id));

    res.json({ success: true, data: { actionCount: body.actions.length } });
  });

  /** PUT /api/admin/triggers/:id/targets — Set target groups */
  router.put('/:id/targets', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = setTargetsSchema.parse(req.body);

    // Delete existing targets
    await db.delete(triggerTargets).where(eq(triggerTargets.triggerId, id));

    // Insert new targets
    if (body.targets.length > 0) {
      await db.insert(triggerTargets).values(
        body.targets.map((t) => ({
          triggerId: id,
          targetType: t.targetType,
          targetId: t.targetId,
        })),
      );
    }

    res.json({ success: true, data: { targetCount: body.targets.length } });
  });

  /** POST /api/admin/triggers/:id/execute — Start trigger execution */
  router.post('/:id/execute', async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = String(req.params.id);

    // Verify trigger exists and is active
    const [trigger] = await db
      .select()
      .from(triggers)
      .where(and(eq(triggers.id, id), eq(triggers.isActive, true), isNull(triggers.deletedAt)));

    if (!trigger) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Trigger not found or inactive', 404);
    }

    // Create execution record
    const [execution] = await db
      .insert(triggerExecutions)
      .values({
        triggerId: id,
        startedBy: user.sub,
        state: 'running',
      })
      .returning();

    // Fire async execution — do not await
    if (bridgeClient && stateCache && encryptionKey) {
      void executeTrigger(execution.id, id, db, bridgeClient, stateCache, encryptionKey);
    }

    res.status(202).json({
      success: true,
      data: {
        executionId: execution.id,
        state: execution.state,
        startedAt: execution.startedAt.toISOString(),
      },
    });
  });

  /** POST /api/admin/triggers/:id/cancel — Cancel running execution */
  router.post('/:id/cancel', async (req: Request, res: Response) => {
    const id = String(req.params.id);

    const [execution] = await db
      .select()
      .from(triggerExecutions)
      .where(and(eq(triggerExecutions.triggerId, id), eq(triggerExecutions.state, 'running')));

    if (!execution) {
      throw new AppError(ErrorCode.NOT_FOUND, 'No running execution found', 404);
    }

    await db
      .update(triggerExecutions)
      .set({ state: 'cancelled', completedAt: new Date() })
      .where(eq(triggerExecutions.id, execution.id));

    res.json({ success: true, data: { executionId: execution.id, state: 'cancelled' } });
  });

  /** GET /api/admin/triggers/:id/executions — List past executions */
  router.get('/:id/executions', async (req: Request, res: Response) => {
    const id = String(req.params.id);

    const result = await db
      .select()
      .from(triggerExecutions)
      .where(eq(triggerExecutions.triggerId, id))
      .orderBy(desc(triggerExecutions.startedAt));

    res.json({ success: true, data: result });
  });

  /** GET /api/admin/trigger-executions/:execId — Get execution detail */
  router.get('/trigger-executions/:execId', async (req: Request, res: Response) => {
    const execId = String(req.params.execId);

    const [execution] = await db
      .select()
      .from(triggerExecutions)
      .where(eq(triggerExecutions.id, execId));

    if (!execution) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Execution not found', 404);
    }

    res.json({ success: true, data: execution });
  });

  return router;
}
