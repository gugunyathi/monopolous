import { AgentBehavior, ActiveEncounter } from '../../types';
import { AgentStateBuffer } from './AgentStateBuffer';
import { AgentData, AGENTS, PLAYER_INDEX } from '../../data/agents';
import { useStore } from '../../store/useStore';
import { simulateX402Purchase, pickServiceForAgent } from '../../services/x402Service';
import { broadcastImpact, getBroadcastReaction } from '../../services/broadcastService';

// ── Tuning constants ─────────────────────────────────────────
const PLAYER_ENCOUNTER_RADIUS = 2.5;       // world units — player↔NPC proximity trigger
const ARRIVAL_RADIUS = 0.5;                // world units — waypoint considered "reached"
const TILE_PAUSE_MIN_MS = 800;             // ms an NPC pauses on a tile before moving on
const TILE_PAUSE_MAX_MS = 2400;            // ms maximum pause on a tile
const SAME_TILE_CHAT_MS = 2500;            // ms two NPCs "chat" when on the same tile
const X402_CHANCE = 0.08;                  // 8% chance an NPC makes an x402 payment when pausing
const BROADCAST_REACT_CHANCE = 0.35;       // 35% chance an NPC posts a reaction to a broadcast
const NUM_BOARD_TILES = 32;                // perimeter tiles on the board
const TILE_JITTER = 0.35;                  // fraction of tileSize — keeps agents visually on their tile

// Tile-name → post text generators
const TILE_CONTENT: Record<string, (agent: AgentData, amount: number) => string> = {
  AIRDROP: (a) => `🪂 Just snagged the AIRDROP on ${a.role} salary day. Free alpha confirmed 💎`,
  'RUG PULL': (a) => `😭 Got rugged at the RUG PULL tile. ${a.traderPersonality} moment. Lesson learned.`,
  HACKED: (a) => `🚨 Position HACKED. Emergency de-risking. ${a.riskLevel} risk doesn't protect you from exploits.`,
  'FREE ALPHA': (a) => `🤫 Landed on FREE ALPHA. Sharing this signal with the team immediately. LFG 📈`,
  'GO TO REKT': (a) => `💀 Sent to REKT. Liquidated on leverage. This is why we need TP levels. ${a.personality}`,
  'GAS TAX': (a, amt) => `⛽ GAS TAX hit for $${amt}. L1 fees are real. Someone needs to ship L2s faster.`,
  'SEC FINE': (a, amt) => `⚖️ SEC FINE: -$${amt}. Regulatory risk is not a meme. Stay safe out there.`,
  GENESIS: (a) => `✅ Passed GENESIS — collected salary. ${a.department} grind never stops 🏦`,
};

function tileContentForProperty(tileName: string, effect: string, amount: number, ownerRole?: string): string {
  if (effect === 'buy') return `🏦 Just acquired ${tileName} for $${amount}. Adding DeFi real estate to the portfolio 📊`;
  if (effect === 'rent') return `💸 Paid $${amount} rent on ${tileName} to ${ownerRole ?? 'another agent'}. The landlord always wins.`;
  if (effect === 'yield') return `💰 Collecting $${amount} yield from ${tileName}. Passive income hitting different 📈`;
  return '';
}

export class BehaviorManager {
  private npcTileIndex = new Map<number, number>();      // current tile the NPC is at
  private npcDestTile = new Map<number, number>();       // final destination tile after dice roll
  private npcArrivalTime = new Map<number, number>();
  private npcPauseDuration = new Map<number, number>();
  private npcJitter = new Map<number, { x: number; z: number }>();
  private npcLastX402 = new Map<number, number>();        // timestamp of last x402 action
  private npcResolvedTile = new Set<number>();           // NPCs whose tile landing was already resolved
  private npcLastBroadcastReact = new Map<number, string>(); // last broadcast id reacted to

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
            // Reached final destination tile — pause here and resolve the tile
            this.stateBuffer.setState(i, AgentBehavior.FROZEN);
            this.npcArrivalTime.set(i, now);
            const pause = TILE_PAUSE_MIN_MS + Math.random() * (TILE_PAUSE_MAX_MS - TILE_PAUSE_MIN_MS);
            this.npcPauseDuration.set(i, pause);
            // Resolve tile landing once (guard against re-entry)
            if (!this.npcResolvedTile.has(i)) {
              this.npcResolvedTile.add(i);
              setTimeout(() => this.resolveTileLanding(i, currentTile), 150 + Math.random() * 400);
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
                  command: result.commands[2],
                },
              });
            }
          }

          // ── Broadcast reaction ────────────────────────────
          const { activeBroadcast } = useStore.getState();
          let broadcastExtraSteps = 0;
          if (activeBroadcast) {
            const lastReact = this.npcLastBroadcastReact.get(i);
            if (lastReact !== activeBroadcast.id) {
              this.npcLastBroadcastReact.set(i, activeBroadcast.id);
              const agent = this.agents[i];
              const impact = broadcastImpact(activeBroadcast, agent.riskLevel);
              broadcastExtraSteps = impact.extraSteps;
              // Apply balance delta from market move
              if (impact.balanceDelta !== 0) {
                useStore.getState().updateBalance(i, impact.balanceDelta);
              }
              // Some agents post a reaction
              if (Math.random() < BROADCAST_REACT_CHANCE) {
                const reaction = getBroadcastReaction(activeBroadcast.sentiment, agent.riskLevel);
                const token = activeBroadcast.tokens[Math.floor(Math.random() * activeBroadcast.tokens.length)];
                useStore.getState().addPost({
                  id: `bcast-react-${i}-${now}`,
                  agentIndex: i,
                  type: 'post',
                  content: reaction,
                  token,
                  action: activeBroadcast.sentiment === 1 ? 'buy' : 'sell',
                  likes: 0,
                  comments: [],
                  timestamp: now,
                });
              }
            }
          }

          // Roll dice and start walking tile-by-tile toward the destination
          // Broadcast sentiment modifies the roll (bull = more aggressive, bear = more cautious)
          const baseRoll = 1 + Math.floor(Math.random() * 6);
          const roll = Math.max(1, Math.min(12, baseRoll + broadcastExtraSteps));
          const currentTile = this.npcTileIndex.get(i) ?? 0;
          const destTile = (currentTile + roll) % NUM_BOARD_TILES;
          this.npcDestTile.set(i, destTile);
          this.npcArrivalTime.delete(i);
          this.npcPauseDuration.delete(i);
          this.npcResolvedTile.delete(i); // allow resolution on next landing

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

    // ── 3. Player↔NPC proximity encounter ───────────────────
    const px = positions[PLAYER_INDEX * 4];
    const pz = positions[PLAYER_INDEX * 4 + 2];
    let nearestNPC: number | null = null;
    let nearestDist2 = PLAYER_ENCOUNTER_RADIUS * PLAYER_ENCOUNTER_RADIUS;

    for (let i = 1; i < count; i++) {
      const dx = px - positions[i * 4];
      const dz = pz - positions[i * 4 + 2];
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestDist2) { nearestDist2 = d2; nearestNPC = i; }
    }

    if (nearestNPC !== this.currentEncounterNPC) {
      this.currentEncounterNPC = nearestNPC;
      if (nearestNPC !== null) {
        const agent = this.agents[nearestNPC];
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

  /** Resolve what happens when NPC i lands on tileIndex */
  private resolveTileLanding(agentIndex: number, tileIndex: number): void {
    const store = useStore.getState();
    const agent = AGENTS[agentIndex];
    if (!agent) return;

    // boardTiles array index equals tile perimeter index (IDs '0'…'32')
    const tile = store.boardTiles[tileIndex];
    if (!tile) return;

    const now = Date.now();
    const balance = store.agentBalances[agentIndex] ?? agent.wallet.balance;

    const BUY_CHANCE: Record<string, number> = { Degen: 0.80, High: 0.60, Medium: 0.38, Low: 0.18 };
    const YIELD_PCT = 0.06; // 6% yield on owned property per visit

    if (tile.type === 'property') {
      const price = tile.price ?? 0;
      if (tile.ownerIndex === undefined || tile.ownerIndex === null) {
        // ── Unowned: decide whether to buy ────────────────
        const willBuy = Math.random() < (BUY_CHANCE[agent.riskLevel] ?? 0.4);
        if (willBuy && balance >= price) {
          store.buyProperty(agentIndex, tile.id);
          store.updateLeaderboard();
          store.addPost({
            id: `tile-buy-${agentIndex}-${now}`,
            agentIndex,
            type: 'tile',
            content: tileContentForProperty(tile.name, 'buy', price),
            token: tile.name,
            action: 'buy',
            likes: 0,
            comments: [],
            timestamp: now,
            tileEvent: { tileName: tile.name, tileType: tile.category ?? tile.type, amount: price, effect: 'buy' },
          });
        }
      } else if (tile.ownerIndex === agentIndex) {
        // ── Owned by self: collect yield ──────────────────
        const yieldAmt = Math.round(price * YIELD_PCT);
        store.updateBalance(agentIndex, yieldAmt);
        store.updateLeaderboard();
        if (Math.random() < 0.3) { // only post 30% of the time to reduce noise
          store.addPost({
            id: `tile-yield-${agentIndex}-${now}`,
            agentIndex,
            type: 'tile',
            content: tileContentForProperty(tile.name, 'yield', yieldAmt),
            token: tile.name,
            action: 'buy',
            likes: 0,
            comments: [],
            timestamp: now,
            tileEvent: { tileName: tile.name, tileType: tile.category ?? tile.type, amount: yieldAmt, effect: 'yield' },
          });
        }
      } else {
        // ── Owned by another agent: pay rent ─────────────
        const rent = Math.max(1, Math.round(price * 0.10));
        store.updateBalance(agentIndex, -rent);
        store.updateBalance(tile.ownerIndex as number, rent);
        store.updateLeaderboard();
        const ownerAgent = AGENTS[tile.ownerIndex as number];
        if (Math.random() < 0.4) {
          store.addPost({
            id: `tile-rent-${agentIndex}-${now}`,
            agentIndex,
            type: 'tile',
            content: tileContentForProperty(tile.name, 'rent', rent, ownerAgent?.role),
            token: tile.name,
            action: 'sell',
            likes: 0,
            comments: [],
            timestamp: now,
            tileEvent: { tileName: tile.name, tileType: tile.category ?? tile.type, amount: rent, effect: 'rent' },
          });
        }
      }
    } else if (tile.type === 'event') {
      const EVENTS: Record<string, { delta: number; effect: string }> = {
        AIRDROP: { delta: 200, effect: 'airdrop' },
        'RUG PULL': { delta: -300, effect: 'rug' },
        HACKED: { delta: -500, effect: 'hack' },
        'FREE ALPHA': { delta: 150, effect: 'alpha' },
        'GO TO REKT': { delta: -100, effect: 'jail' },
      };
      const ev = EVENTS[tile.name];
      if (ev) {
        store.updateBalance(agentIndex, ev.delta);
        store.updateLeaderboard();
        const gen = TILE_CONTENT[tile.name];
        store.addPost({
          id: `tile-event-${agentIndex}-${now}`,
          agentIndex,
          type: 'tile',
          content: gen ? gen(agent, Math.abs(ev.delta)) : `${tile.name}: ${ev.delta > 0 ? '+' : ''}${ev.delta} USDC`,
          token: agent.preferredTokens[0],
          action: ev.delta >= 0 ? 'buy' : 'sell',
          likes: 0,
          comments: [],
          timestamp: now,
          tileEvent: { tileName: tile.name, tileType: 'event', amount: Math.abs(ev.delta), effect: ev.effect as any },
        });
      }
    } else if (tile.type === 'tax') {
      const amount = tile.price ?? 0;
      store.updateBalance(agentIndex, -amount);
      store.updateLeaderboard();
      const gen = TILE_CONTENT[tile.name];
      store.addPost({
        id: `tile-tax-${agentIndex}-${now}`,
        agentIndex,
        type: 'tile',
        content: gen ? gen(agent, amount) : `${tile.name}: -$${amount}`,
        token: agent.preferredTokens[0],
        action: 'sell',
        likes: 0,
        comments: [],
        timestamp: now,
        tileEvent: { tileName: tile.name, tileType: 'tax', amount, effect: 'tax' },
      });
    } else if (tile.type === 'start') {
      // Passing GENESIS — collect $200 salary
      store.updateBalance(agentIndex, 200);
      store.updateLeaderboard();
      if (Math.random() < 0.2) {
        const gen = TILE_CONTENT['GENESIS'];
        store.addPost({
          id: `tile-genesis-${agentIndex}-${now}`,
          agentIndex,
          type: 'tile',
          content: gen ? gen(agent, 200) : 'Passed GENESIS. Collected $200.',
          token: 'USDC',
          action: 'buy',
          likes: 0,
          comments: [],
          timestamp: now,
          tileEvent: { tileName: 'GENESIS', tileType: 'start', amount: 200, effect: 'yield' },
        });
      }
    }
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
