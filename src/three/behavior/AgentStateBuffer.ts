import { AgentBehavior } from '../../types';

/**
 * CPU buffer that stores per-instance agent state.
 *
 * Each instance maps to one vec4:
 *   .x = waypoint X  (used when state == GOTO)
 *   .y = 0           (reserved)
 *   .z = waypoint Z  (used when state == GOTO)
 *   .w = AgentBehavior  (0 = BOIDS, 1 = FROZEN, 2 = GOTO)
 */
export class AgentStateBuffer {
  /** Raw Float32Array (vec4 stride). Direct access for performance-sensitive code. */
  public readonly array: Float32Array;

  constructor(public readonly count: number) {
    this.array = new Float32Array(count * 4);
  }

  // ── State ────────────────────────────────────────────────────

  public getState(index: number): AgentBehavior {
    return this.array[index * 4 + 3] as AgentBehavior;
  }

  public setState(index: number, state: AgentBehavior): void {
    this.array[index * 4 + 3] = state;
  }

  // ── Waypoint ─────────────────────────────────────────────────

  public setWaypoint(index: number, x: number, z: number): void {
    this.array[index * 4 + 0] = x;
    this.array[index * 4 + 2] = z;
  }

  public getWaypoint(index: number): { x: number; z: number } {
    return {
      x: this.array[index * 4 + 0],
      z: this.array[index * 4 + 2],
    };
  }

  // ── Bulk helpers ─────────────────────────────────────────────

  /** Set all NPC states (skips index 0 = player). */
  public resetAllNPCsToState(state: AgentBehavior, startIndex = 1): void {
    for (let i = startIndex; i < this.count; i++) {
      this.array[i * 4 + 3] = state;
    }
  }
}
