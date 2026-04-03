/**
 * Trigger execution engine — runs automation scripts asynchronously.
 * Processes trigger actions sequentially, supports cancellation,
 * and logs per-action results for post-run review.
 * @module api-server/services/triggerEngine
 */

import { eq, and, isNull } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import {
  triggers,
  triggerActions,
  triggerTargets,
  triggerExecutions,
  groups,
  groupEndpoints,
  endpoints,
  controllers,
} from '../db/schema.js';
import type { BridgeClient } from './bridgeClient.js';
import type { StateCache } from './stateCache.js';
import { decryptJson } from '../utils/encryption.js';
import type { ControlCommandType } from '@suitecommand/types';

/** Per-action result stored in the execution log */
interface ActionResult {
  actionId: string;
  actionType: string;
  actionOrder: number;
  status: 'success' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  details?: unknown;
}

/** Set of currently running execution IDs — used for cancellation */
const runningExecutions = new Set<string>();

/**
 * Start execution of a trigger. Runs asynchronously — returns immediately.
 * The caller should have already created the triggerExecution record.
 *
 * @param executionId - The execution record UUID
 * @param triggerId - The trigger UUID
 * @param db - Database client
 * @param bridgeClient - Bridge agent client
 * @param stateCache - Redis state cache for publishing updates
 * @param encryptionKey - Credential decryption key
 */
export async function executeTrigger(
  executionId: string,
  triggerId: string,
  db: Database,
  bridgeClient: BridgeClient,
  stateCache: StateCache,
  encryptionKey: string,
): Promise<void> {
  runningExecutions.add(executionId);
  const actionResults: ActionResult[] = [];

  try {
    // Load trigger actions
    const actions = await db
      .select()
      .from(triggerActions)
      .where(eq(triggerActions.triggerId, triggerId))
      .orderBy(triggerActions.actionOrder);

    // Load trigger targets and resolve to endpoint IDs
    const targets = await db
      .select()
      .from(triggerTargets)
      .where(eq(triggerTargets.triggerId, triggerId));

    const targetEndpoints = await resolveTargetEndpoints(db, targets);

    // Execute actions sequentially
    for (const action of actions) {
      // Check for cancellation before each action
      if (!runningExecutions.has(executionId)) {
        break;
      }

      // Re-check execution state from DB (in case of external cancel)
      const [execRecord] = await db
        .select()
        .from(triggerExecutions)
        .where(eq(triggerExecutions.id, executionId));

      if (execRecord?.state === 'cancelled') {
        runningExecutions.delete(executionId);
        break;
      }

      const startTime = Date.now();
      const config = action.config as Record<string, unknown>;

      try {
        switch (action.actionType) {
          case 'command':
            await executeCommandAction(
              config,
              targetEndpoints,
              db,
              bridgeClient,
              stateCache,
              encryptionKey,
            );
            break;

          case 'delay':
            await executeDelayAction(config, executionId);
            break;

          case 'conditional':
            const shouldContinue = await executeConditionalAction(
              config,
              targetEndpoints,
              db,
            );
            if (!shouldContinue) {
              actionResults.push({
                actionId: action.id,
                actionType: action.actionType,
                actionOrder: action.actionOrder,
                status: 'skipped',
                durationMs: Date.now() - startTime,
                details: { reason: 'Condition not met', onFail: config.onFail },
              });

              if (config.onFail === 'abort') {
                // Mark remaining actions as skipped and stop
                break;
              }
              continue;
            }
            break;
        }

        actionResults.push({
          actionId: action.id,
          actionType: action.actionType,
          actionOrder: action.actionOrder,
          status: 'success',
          durationMs: Date.now() - startTime,
        });
      } catch (error) {
        actionResults.push({
          actionId: action.id,
          actionType: action.actionType,
          actionOrder: action.actionOrder,
          status: 'failed',
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        });

        // Continue on failure (best-effort) — the trigger doesn't abort
        // unless a conditional action specifies onFail: 'abort'
      }

      // Update execution log in DB after each action
      await db
        .update(triggerExecutions)
        .set({ executionLog: actionResults })
        .where(eq(triggerExecutions.id, executionId));
    }

    // Mark execution as completed
    const finalState = runningExecutions.has(executionId) ? 'completed' : 'cancelled';
    const hasFailure = actionResults.some((r) => r.status === 'failed');

    await db
      .update(triggerExecutions)
      .set({
        state: hasFailure ? 'failed' : finalState,
        completedAt: new Date(),
        executionLog: actionResults,
        errorMessage: hasFailure
          ? `${actionResults.filter((r) => r.status === 'failed').length} action(s) failed`
          : null,
      })
      .where(eq(triggerExecutions.id, executionId));
  } catch (error) {
    // Catastrophic failure
    await db
      .update(triggerExecutions)
      .set({
        state: 'failed',
        completedAt: new Date(),
        executionLog: actionResults,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(triggerExecutions.id, executionId));
  } finally {
    runningExecutions.delete(executionId);
  }
}

/**
 * Cancel a running execution. The engine checks this set before each action.
 * @param executionId - The execution to cancel
 */
export function cancelExecution(executionId: string): void {
  runningExecutions.delete(executionId);
}

/**
 * Resolve trigger targets into a flat list of endpoint+controller info.
 */
async function resolveTargetEndpoints(
  db: Database,
  targets: Array<{ targetType: string; targetId: string }>,
) {
  const resolved: Array<{
    endpointId: string;
    platformEndpointId: string;
    controllerId: string;
    groupId: string;
  }> = [];

  for (const target of targets) {
    if (target.targetType === 'group') {
      const eps = await db
        .select({
          endpointId: endpoints.id,
          platformEndpointId: endpoints.platformEndpointId,
          controllerId: endpoints.controllerId,
          groupId: groupEndpoints.groupId,
        })
        .from(groupEndpoints)
        .innerJoin(endpoints, eq(groupEndpoints.endpointId, endpoints.id))
        .where(eq(groupEndpoints.groupId, target.targetId));

      resolved.push(...eps);
    } else if (target.targetType === 'venue') {
      const eps = await db
        .select({
          endpointId: endpoints.id,
          platformEndpointId: endpoints.platformEndpointId,
          controllerId: endpoints.controllerId,
        })
        .from(endpoints)
        .where(and(eq(endpoints.venueId, target.targetId), isNull(endpoints.deletedAt)));

      resolved.push(...eps.map((e) => ({ ...e, groupId: target.targetId })));
    }
  }

  return resolved;
}

/**
 * Execute a 'command' action against all target endpoints.
 */
async function executeCommandAction(
  config: Record<string, unknown>,
  targetEndpoints: Array<{
    endpointId: string;
    platformEndpointId: string;
    controllerId: string;
    groupId: string;
  }>,
  db: Database,
  bridgeClient: BridgeClient,
  stateCache: StateCache,
  encryptionKey: string,
): Promise<void> {
  const commandType = config.commandType as ControlCommandType;
  const payload = config.payload as Record<string, unknown>;

  // Group endpoints by controller for efficient batching
  const byController = new Map<string, typeof targetEndpoints>();
  for (const ep of targetEndpoints) {
    const existing = byController.get(ep.controllerId) ?? [];
    existing.push(ep);
    byController.set(ep.controllerId, existing);
  }

  for (const [controllerId, eps] of byController) {
    const [controller] = await db
      .select()
      .from(controllers)
      .where(eq(controllers.id, controllerId));

    if (!controller) continue;

    const connectionConfig = decryptJson<Record<string, unknown>>(
      controller.connectionConfig,
      encryptionKey,
    );

    for (const ep of eps) {
      const state = await bridgeClient.sendCommand(
        controllerId,
        {
          commandType,
          platformEndpointId: ep.platformEndpointId,
          payload: payload as never,
        },
        controller.platformSlug,
        { platform: controller.platformSlug, ...connectionConfig },
      );

      // Update cache and DB
      await stateCache.setEndpointState(ep.endpointId, ep.groupId, state);
      await db
        .update(endpoints)
        .set({
          currentState: {
            isPoweredOn: state.isPoweredOn,
            currentInput: state.currentInput,
            currentChannelNumber: state.currentChannelNumber,
            volumeLevel: state.volumeLevel,
            isMuted: state.isMuted,
          },
          lastSeenAt: new Date(),
        })
        .where(eq(endpoints.id, ep.endpointId));
    }
  }
}

/**
 * Execute a 'delay' action — pause for N milliseconds.
 * Checks for cancellation during the wait.
 */
async function executeDelayAction(
  config: Record<string, unknown>,
  executionId: string,
): Promise<void> {
  const delayMs = (config.delayMs as number) ?? 1000;
  const chunkMs = 500;
  let elapsed = 0;

  while (elapsed < delayMs) {
    if (!runningExecutions.has(executionId)) {
      break;
    }
    const wait = Math.min(chunkMs, delayMs - elapsed);
    await new Promise((resolve) => setTimeout(resolve, wait));
    elapsed += wait;
  }
}

/**
 * Execute a 'conditional' action — check endpoint state before proceeding.
 * Returns true if the condition is met, false otherwise.
 */
async function executeConditionalAction(
  config: Record<string, unknown>,
  targetEndpoints: Array<{ endpointId: string }>,
  db: Database,
): Promise<boolean> {
  const check = config.check as string;
  const expect = config.expect;

  // Check the first target endpoint's state
  if (targetEndpoints.length === 0) return true;

  const [ep] = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, targetEndpoints[0].endpointId));

  if (!ep?.currentState) return false;

  const state = ep.currentState as Record<string, unknown>;
  return state[check] === expect;
}
