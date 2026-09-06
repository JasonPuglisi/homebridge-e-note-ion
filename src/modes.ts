import type { SchedulerAction } from './client.js';
import type { ModeCharacteristic } from './pushServer.js';

/**
 * Map a switch (mode + on/off) to the scheduler webhook action.
 *
 * Quiet: on → quiet, off → wake.
 * Public: on → public (private content hidden), off → private (all shown).
 */
export function actionFor(mode: ModeCharacteristic, on: boolean): SchedulerAction {
  if (mode === 'quiet') {
    return on ? 'quiet' : 'wake';
  }
  return on ? 'public' : 'private';
}
