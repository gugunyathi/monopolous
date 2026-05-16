import { AgentBehavior, ActiveEncounter } from '../../types';
import { AgentStateBuffer } from './AgentStateBuffer';
import { AgentData, PLAYER_INDEX } from '../../data/agents';
import { useStore } from '../../store/useStore';
import { simulateX402Purchase, pickServiceForAgent } from '../../services/x402Service';

// ── Tuning constants ─────────────────────────────────────────
const PLAYER_ENCOUNTER_RADIUS = 2.5;       // world units — player↔NPC proximity trigger
const ARRIVAL_RADIUS = 0.5;                // world units — waypoint considered "reached"
const TILE_PAUSE_MIN_MS = 400;             // ms an NPC pauses on a tile before moving on
const TILE_PAUSE_MAX_MS = 1800;            // ms maximum pause on a tile
const SAME_TILE_CHAT_MS = 2500;            // ms two NPCs "chat" when on the same tile
const X402_CHANCE = 0.08;                  // 8% chance an NPC makes an x402 payment when pausing
const NUM_BOARD_TILES = 32;                // perimeter tiles on the board
const TILE_JITTER = 0.35;                  // fraction of tileSize — keeps agents visually on their tile

export class BehaviorManager {
  private npcTileIndex = new Map<number, number>();      // current tile the NPC is at
  private npcDestTile = new Map<number, number>();       // final destination tile after dice roll
  private npcArrivalTime = new Map<number, number>();
  private npcPauseDuration = new Map<number, number>();
  private npcJitter = new Map<number, { x: number; z: number }>();
  private npcLastX402 = new Map<number, number>();  // timestamp of last x402 action

  private chatNPC: number | null = null;
  private currentEncounterNPC: number | null = null;
  private worldSize = 25;
  private tileSize = 0;

  constructor(
    private stateBuffer: AgentStateBuffer,
    private agents: AgentData[],
    private onEncounterChange: (encounter: ActiveEncounter | null) => void,
  ) {
    const { worldSize } = useStore.getState();
    this.worldSize = worldSize;
    this.tileSize = (worldSize * 2) / 9;

    stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);

    const count = stateBuffer.count;
    for (let i = 1; i < count; i++) {
      const startTile = (i - 1) % NUM_BOARD_TILES;
      this.npcTileIndex.set(i, startTile);
      // Jitter only along the edge direction so agents don't step off the board
      const isHorizontalEdge = startTile < 9 || (startTile >= 17 && startTile < 25);
      const j = (this.seededRand(i * 3 + 1) - 0.5) * this.tileSize * TILE_JITTER;
      this.npcJitter.set(i, {
        x: isHorizontalEdge ? j : 0,
        z: isHorizontalEdge ? 0 : j,
      });

      // Give each NPC an immediate dice roll so they start walking right away
      // Stagger by using a seeded roll (1-6) so they don't all walk the same distance
      const initialRoll = 1 + Math.floor(this.seededRand(i * 7 + 3) * 6);
      const destTile = (startTile + initialRoll) % NUM_BOARD_TILES;
      this.npcDestTile.set(i, destTile);

      // Start walking to the next tile immediately
      const nextTile = (startTile + 1) % NUM_BOARD_TILES;
      this.npcTileIndex.set(i, nextTile);
      const pos = this.getTilePos(nextTile);
      const jitter = this.npcJitter.get(i)!;
      // Apply jitter along the correct axis for the next tile
      const nextIsH = nextTile < 9 || (nextTile >= 17 && nextTile < 25);
      const mag = Math.abs(jitter.x) > 0 ? jitter.x : jitter.z;
      stateBuffer.setWaypoint(i, pos.x + (nextIsH ? mag : 0), pos.z + (nextIsH ? 0 : mag));
      stateBuffer.setState(i, AgentBehavior.GOTO);
    }
    console.log('[BehaviorManager] Initialized', count - 1, 'NPCs with immediate walking destinations');
  }

  private seededRand(seed: number): number {
    const x = Math.sin(seed + 1) * 43758.5453123;
    return x - Math.floor(x);
  }

  public update(positions: Float32Array): void {
    const now = Date.now();
    const count = this.stateBuffer.count;
    const { worldSize } = useStore.getState();
    this.worldSize = worldSize;
    this.tileSize = (worldSize * 2) / 9;

    // ── 1. NPC board-path movement ───────────────────────────
    for (let i = 1; i < count; i++) {
      const state = this.stateBuffer.getState(i);

      if (state === AgentBehavior.GOTO) {
        const wp = this.stateBuffer.getWaypoint(i);
        const dx = wp.x - positions[i * 4];
        const dz = wp.z - positions[i * 4 + 2];
        if (dx * dx + dz * dz < ARRIVAL_RADIUS * ARRIVAL_RADIUS) {
          // Arrived at current tile — check if there are more tiles to walk through
          const currentTile = this.npcTileIndex.get(i) ?? 0;
          const destTile = this.npcDestTile.get(i) ?? currentTile;

          if (currentTile !== destTile) {
            // Advance one tile along the perimeter toward destination
            const nextTile = (currentTile + 1) % NUM_BOARD_TILES;
            this.npcTileIndex.set(i, nextTile);
            const pos = this.getTilePos(nextTile);
            const jitter = this.getJitterForTile(i, nextTile);
            this.stateBuffer.setWaypoint(i, pos.x + jitter.x, pos.z + jitter.z);
            // Keep GOTO state — continue walking
          } else {
            // Reached final destination tile — pause here
            this.stateBuffer.setState(i, AgentBehavior.FROZEN);
            this.npcArrivalTime.set(i, now);
            const pause = TILE_PAUSE_MIN_MS + Math.random() * (TILE_PAUSE_MAX_MS - TILE_PAUSE_MIN_MS);
            this.npcPauseDuration.set(i, pause);

            // ── Prediction tile: auto-place a Polymarket bet ───────────────
            const { boardTiles, polymarketData, placePredictionBet, agentBalances } = useStore.getState();
            const landedTile = boardTiles[currentTile % boardTiles.length];
            if (
              landedTile?.type === 'prediction' &&
              polymarketData.length > 0 &&
              Math.random() < 0.25
            ) {
              const market = polymarketData[Math.floor(Math.random() * polymarketData.length)];
              const side = Math.random() < 0.5 ? 'YES' : 'NO';
              const balance = agentBalances[i] ?? 500;
              const betAmount = Math.max(1, Math.round(balance * (0.03 + Math.random() * 0.07) * 100) / 100);
              const price = market.outcomePrices?.[0] ? parseFloat(market.outcomePrices[0]) : 0.5;
              placePredictionBet(i, market.id, market.question, side as 'YES' | 'NO', betAmount, price);
              console.log(`[BehaviorManager] 🎯 Agent #${i} bet ${side} on "${market.question.slice(0, 40)}..."`);
            }
          }
        }
      } else if (state === AgentBehavior.FROZEN) {
        const arrivalTime = this.npcArrivalTime.get(i);
        if (arrivalTime === undefined) continue; // player-controlled freeze

        const pause = this.npcPauseDuration.get(i) ?? TILE_PAUSE_MIN_MS;

        // Face others on same tile
        const myTile = this.npcTileIndex.get(i) ?? 0;
        let inTileChat = false;
        for (let j = 1; j < count; j++) {
          if (j === i) continue;
          if (this.stateBuffer.getState(j) !== AgentBehavior.FROZEN) continue;
          if (this.npcArrivalTime.get(j) === undefined) continue;
          if ((this.npcTileIndex.get(j) ?? -1) !== myTile) continue;
          const dirX = positions[j * 4] - positions[i * 4];
          const dirZ = positions[j * 4 + 2] - positions[i * 4 + 2];
          if (Math.abs(dirX) + Math.abs(dirZ) > 0.01) {
            this.stateBuffer.setWaypoint(i, dirX, dirZ);
          }
          inTileChat = true;
          break;
        }

        const effectivePause = inTileChat ? Math.max(pause, SAME_TILE_CHAT_MS) : pause;

        if (now - arrivalTime >= effectivePause) {
          // ── x402 payment simulation ──────────────────────
          const lastX402 = this.npcLastX402.get(i) ?? 0;
          if (Math.random() < X402_CHANCE && now - lastX402 > 30_000) {
            this.npcLastX402.set(i, now);
            const service = pickServiceForAgent(i);
            const result = simulateX402Purchase(i, service);
            if (result.canPay) {
              const store = useStore.getState();
              store.addPost({
                id: `x402-${i}-${now}`,
                agentIndex: i,
                type: 'x402',
                content: result.postContent,
                action: 'pay',
                likes: 0,
                comments: [],
                timestamp: now,
                x402: {
                  serviceUrl: service.url,
                  price: service.price,
                  category: service.category,
                  command: result.commands[2], // the pay command
                },
              });
            }
          }

          // Roll dice and start walking tile-by-tile toward the destination
          const roll = 1 + Math.floor(Math.random() * 6);
          const currentTile = this.npcTileIndex.get(i) ?? 0;
          const destTile = (currentTile + roll) % NUM_BOARD_TILES;
          this.npcDestTile.set(i, destTile);
          this.npcArrivalTime.delete(i);
          this.npcPauseDuration.delete(i);

          // Walk to the very next tile first (one step at a time along the perimeter)
          const nextTile = (currentTile + 1) % NUM_BOARD_TILES;
          this.npcTileIndex.set(i, nextTile);
          const pos = this.getTilePos(nextTile);
          const jitter = this.getJitterForTile(i, nextTile);
          this.stateBuffer.setWaypoint(i, pos.x + jitter.x, pos.z + jitter.z);
          this.stateBuffer.setState(i, AgentBehavior.GOTO);
        }
      }
    }

    // ── 2. Player GOTO arrival ───────────────────────────────
    if (this.stateBuffer.getState(PLAYER_INDEX) === AgentBehavior.GOTO) {
      const wp = this.stateBuffer.getWaypoint(PLAYER_INDEX);
      const pdx = wp.x - positions[PLAYER_INDEX * 4];
      const pdz = wp.z - positions[PLAYER_INDEX * 4 + 2];
      if (pdx * pdx + pdz * pdz < ARRIVAL_RADIUS * ARRIVAL_RADIUS) {
        this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
        if (this.chatNPC !== null) {
          const nx = positions[this.chatNPC * 4];
          const nz = positions[this.chatNPC * 4 + 2];
          this.stateBuffer.setWaypoint(PLAYER_INDEX, nx - positions[PLAYER_INDEX * 4], nz - positions[PLAYER_INDEX * 4 + 2]);
          useStore.getState().setAnimation('Wave');
          this.chatNPC = null;
        }
      }
    }

    // ── 3. Player↔NPC proximity encounter (ADK agents only) ──
    // Only trigger encounters with agents being controlled by the ADK orchestrator
    const px = positions[PLAYER_INDEX * 4];
    const pz = positions[PLAYER_INDEX * 4 + 2];
    let nearestNPC: number | null = null;
    let nearestDist2 = PLAYER_ENCOUNTER_RADIUS * PLAYER_ENCOUNTER_RADIUS;

    const activeADKAgents = useStore.getState().activeADKAgents;
    
    // Only check proximity to ADK-controlled agents
    for (let i = 1; i < count; i++) {
      if (!activeADKAgents.has(i)) continue; // skip non-ADK agents

      const dx = px - positions[i * 4];
      const dz = pz - positions[i * 4 + 2];
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestDist2) { nearestDist2 = d2; nearestNPC = i; }
    }

    if (nearestNPC !== this.currentEncounterNPC) {
      this.currentEncounterNPC = nearestNPC;
      if (nearestNPC !== null) {
        const agent = this.agents[nearestNPC];
        if (!agent) { this.onEncounterChange(null); return; }
        this.onEncounterChange({
          npcIndex: nearestNPC,
          npcDepartment: agent.department,
          npcRole: agent.role,
          npcMission: agent.mission,
          npcPersonality: agent.personality,
        });
      } else {
        this.onEncounterChange(null);
      }
    }
  }

  public setPlayerWaypoint(x: number, z: number): void {
    this.chatNPC = null;
    this.stateBuffer.setWaypoint(PLAYER_INDEX, x, z);
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.GOTO);
  }

  public startChat(npcIndex: number, positions: Float32Array): void {
    const nx = positions[npcIndex * 4];
    const nz = positions[npcIndex * 4 + 2];
    const px = positions[PLAYER_INDEX * 4];
    const pz = positions[PLAYER_INDEX * 4 + 2];

    let dx = px - nx;
    let dz = pz - nz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.01) { dx = 1; dz = 0; } else { dx /= dist; dz /= dist; }

    this.stateBuffer.setWaypoint(PLAYER_INDEX, nx + dx * 1.2, nz + dz * 1.2);
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.GOTO);
    this.chatNPC = npcIndex;

    this.stateBuffer.setState(npcIndex, AgentBehavior.FROZEN);
    this.stateBuffer.setWaypoint(npcIndex, dx, dz);
    this.npcArrivalTime.set(npcIndex, Date.now());
    this.npcPauseDuration.set(npcIndex, 999999);
  }

  public endChat(npcIndex: number | null): void {
    this.chatNPC = null;
    if (npcIndex !== null) {
      const currentTile = this.npcTileIndex.get(npcIndex) ?? 0;
      const pos = this.getTilePos(currentTile);
      const jitter = this.npcJitter.get(npcIndex) ?? { x: 0, z: 0 };
      this.stateBuffer.setWaypoint(npcIndex, pos.x + jitter.x, pos.z + jitter.z);
      this.stateBuffer.setState(npcIndex, AgentBehavior.GOTO);
      this.npcArrivalTime.delete(npcIndex);
      this.npcPauseDuration.delete(npcIndex);
    }
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
  }

  private getTilePos(tileIndex: number): { x: number; z: number } {
    const t = ((tileIndex % NUM_BOARD_TILES) + NUM_BOARD_TILES) % NUM_BOARD_TILES;
    const halfWorld = this.worldSize;
    const ts = this.tileSize;
    let x = 0, z = 0;
    if (t < 9) {
      x = halfWorld - (t * ts); z = halfWorld;
    } else if (t < 17) {
      x = -halfWorld; z = halfWorld - ((t - 8) * ts);
    } else if (t < 25) {
      x = -halfWorld + ((t - 16) * ts); z = -halfWorld;
    } else {
      x = halfWorld; z = -halfWorld + ((t - 24) * ts);
    }
    return { x, z };
  }

  /** Edge-aware jitter: spread only along the edge direction for a given tile */
  private getJitterForTile(agentIndex: number, tileIndex: number): { x: number; z: number } {
    const t = ((tileIndex % NUM_BOARD_TILES) + NUM_BOARD_TILES) % NUM_BOARD_TILES;
    const isHorizontalEdge = t < 9 || (t >= 17 && t < 25);
    const base = this.npcJitter.get(agentIndex);
    if (!base) return { x: 0, z: 0 };
    // Use the agent's seeded jitter magnitude but apply it along the correct axis
    const mag = Math.abs(base.x) > 0 ? base.x : base.z;
    return {
      x: isHorizontalEdge ? mag : 0,
      z: isHorizontalEdge ? 0 : mag,
    };
  }
}
