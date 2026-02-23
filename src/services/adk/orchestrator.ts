/**
 * ADK Agent Orchestrator
 *
 * The "brain" layer. Every 45-90 seconds, picks 5-8 random core agents and
 * runs each through a real Gemini function-calling turn. The LLM sees the
 * agent's personality, wallet balance, market news, and social chatter,
 * then autonomously decides which tool to invoke (trade, send, x402, stake,
 * or post). Results are executed on the store and instantly show in the UI.
 *
 * Uses @google/genai directly for browser-safe function calling —
 * same engine that powers @google/adk under the hood.
 *
 * Rate-limit aware: 2.5 s gap between agents, exponential back-off on 429.
 */

import { GoogleGenAI } from '@google/genai';
import { AGENTS, CORE_AGENT_COUNT } from '../../data/agents';
import { useStore } from '../../store/useStore';
import { WALLET_TOOL_DECLARATIONS, executeTool } from './tools';

// ─── Config ──────────────────────────────────────────────────────────────────

const MODEL = 'gemini-2.0-flash';
const AGENTS_PER_CYCLE = 5;
const CYCLE_MIN_MS = 45_000;
const CYCLE_MAX_MS = 90_000;
const AGENT_DELAY_MS = 2_500;         // pause between agent calls
const WARM_UP_MS = 15_000;            // wait for simulation to populate first
const BACKOFF_BASE_MS = 30_000;       // initial back-off on rate-limit

// ─── Runtime State ───────────────────────────────────────────────────────────

let ai: GoogleGenAI | null = null;
let cycleTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let consecutiveErrors = 0;

// Avoid re-processing the same agents back-to-back
const recentlyProcessed = new Set<number>();
const RECENT_CAP = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ─── System Prompt Builder ───────────────────────────────────────────────────

function buildSystemPrompt(agentIndex: number): string {
  const agent = AGENTS[agentIndex];
  const store = useStore.getState();
  const balance = store.agentBalances[agentIndex] ?? agent.wallet.balance;

  // Recent CEO / market headlines
  const headlines = store.broadcastHistory
    .slice(0, 3)
    .map(
      (b) =>
        `• ${b.headline} [${b.sentiment > 0 ? 'BULL' : b.sentiment < 0 ? 'BEAR' : 'NEUTRAL'}]`,
    )
    .join('\n');

  // Recent social chatter about agent's preferred tokens
  const chatter = store.socialFeed
    .slice(0, 15)
    .filter((p) => p.token && agent.preferredTokens.includes(p.token))
    .slice(0, 3)
    .map((p) => {
      const a = AGENTS[p.agentIndex];
      return `• @${a?.role.replace(/\s+/g, '').toLowerCase()}: ${p.content.slice(0, 100)}`;
    })
    .join('\n');

  return `You are @${agent.role.replace(/\s+/g, '').toLowerCase()}, ${agent.role} in ${agent.department} at FakeClaw Inc.

PERSONALITY: ${agent.personality}
TRADING: ${agent.traderPersonality} — ${agent.tradingStyle}
RISK: ${agent.riskLevel}
TOKENS: ${agent.preferredTokens.join(', ')}

WALLET:
• Balance: $${balance.toFixed(2)} USDC on Base
• Skills: ${agent.wallet.skills.join(', ')}
${headlines ? `\nMARKET NEWS:\n${headlines}` : ''}
${chatter ? `\nSOCIAL CHATTER:\n${chatter}` : ''}

RULES:
1. Pick ONE action. Use a tool to execute it.
2. Stay in character — degens ape, conservatives DCA, contrarians fade.
3. Never trade more than 40% of your balance.
4. Keep post_update content ≤ 280 chars. Include emojis.
5. React to market news and chatter when relevant.
6. If balance < $20, prefer posting opinions over trading.`;
}

// ─── Process a Single Agent ──────────────────────────────────────────────────

async function processAgent(agentIndex: number): Promise<boolean> {
  if (!ai || !running) return false;

  const agent = AGENTS[agentIndex];
  const store = useStore.getState();
  const balance = store.agentBalances[agentIndex] ?? agent.wallet.balance;

  if (balance < 2) {
    console.log(
      `[ADK] #${agentIndex} ${agent.role} — balance $${balance.toFixed(2)}, skipping`,
    );
    return true; // not an error, just skip
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Decide ONE action to take right now based on your personality, balance, and market context. Call a tool to execute.',
            },
          ],
        },
      ],
      config: {
        systemInstruction: buildSystemPrompt(agentIndex),
        tools: [{ functionDeclarations: WALLET_TOOL_DECLARATIONS as any }],
        temperature: 0.95,
        topP: 0.95,
        maxOutputTokens: 350,
      },
    });

    // Check for function calls first
    const fcs = response.functionCalls;
    if (fcs && fcs.length > 0) {
      const fc = fcs[0];
      console.log(
        `[ADK] 🧠 #${agentIndex} ${agent.role} → ${fc.name}(${JSON.stringify(fc.args)})`,
      );
      const post = executeTool(agentIndex, fc.name, fc.args ?? {});
      if (post) {
        store.addPost(post);
        console.log(`[ADK] ✅ ${post.content.slice(0, 80)}…`);
      }
    } else {
      // Text-only — post as social update
      const text = response.text?.trim();
      if (text && text.length > 10) {
        const post = executeTool(agentIndex, 'post_update', {
          content: text.slice(0, 280),
          category: 'general',
          token: agent.preferredTokens[0] ?? '',
        });
        if (post) {
          store.addPost(post);
          console.log(`[ADK] 💬 #${agentIndex} ${agent.role}: ${text.slice(0, 80)}…`);
        }
      }
    }

    // Periodic leaderboard refresh
    if (Math.random() < 0.3) store.updateLeaderboard();

    consecutiveErrors = 0;
    return true;
  } catch (err: any) {
    const msg = err?.message ?? String(err);

    // Rate limit — signal caller to stop this cycle
    if (err?.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      console.warn('[ADK] ⚠ Rate-limited — pausing cycle.');
      consecutiveErrors++;
      return false; // stop processing further agents
    }

    console.error(`[ADK] ❌ Agent #${agentIndex}:`, msg);
    consecutiveErrors++;
    return true; // continue with next agent
  }
}

// ─── Cycle Logic ─────────────────────────────────────────────────────────────

function pickAgents(count: number): number[] {
  const pool: number[] = [];
  for (let i = 1; i < CORE_AGENT_COUNT; i++) {
    if (!recentlyProcessed.has(i)) pool.push(i);
  }

  const selected = shuffle(pool).slice(0, count);

  for (const idx of selected) {
    recentlyProcessed.add(idx);
    if (recentlyProcessed.size > RECENT_CAP) {
      const oldest = recentlyProcessed.values().next().value;
      if (oldest !== undefined) recentlyProcessed.delete(oldest);
    }
  }

  return selected;
}

async function runCycle(): Promise<void> {
  if (!running) return;

  const agents = pickAgents(AGENTS_PER_CYCLE);
  console.log(
    `\n[ADK] ─── Cycle: agents [${agents.map((i) => `#${i} ${AGENTS[i].role}`).join(', ')}] ───`,
  );

  // Mark all agents as ADK-controlled for this cycle
  const store = useStore.getState();
  for (const idx of agents) {
    store.markAgentAsADK(idx);
  }

  for (const idx of agents) {
    if (!running) break;
    const ok = await processAgent(idx);
    if (!ok) break; // rate-limited — stop this cycle
    await sleep(AGENT_DELAY_MS);
  }

  // Unmark all agents after cycle completes
  for (const idx of agents) {
    store.unmarkAgentAsADK(idx);
  }

  scheduleNextCycle();
}

function scheduleNextCycle(): void {
  if (!running) return;

  // Exponential back-off on consecutive errors
  let interval: number;
  if (consecutiveErrors > 2) {
    interval = BACKOFF_BASE_MS * Math.pow(2, Math.min(consecutiveErrors - 2, 4));
    console.log(`[ADK] Backing off ${(interval / 1000).toFixed(0)}s (${consecutiveErrors} consecutive errors)`);
  } else {
    interval = CYCLE_MIN_MS + Math.random() * (CYCLE_MAX_MS - CYCLE_MIN_MS);
  }

  cycleTimer = setTimeout(runCycle, interval);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startADKOrchestrator(): void {
  if (running) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[ADK] No GEMINI_API_KEY — orchestrator disabled.');
    return;
  }

  ai = new GoogleGenAI({ apiKey });
  running = true;
  consecutiveErrors = 0;

  // Warm-up delay so the simulation has content for context
  cycleTimer = setTimeout(runCycle, WARM_UP_MS);

  console.log(
    `[ADK] 🧠 Orchestrator started — model: ${MODEL}, ${AGENTS_PER_CYCLE} agents/cycle, ` +
      `${CYCLE_MIN_MS / 1000}-${CYCLE_MAX_MS / 1000}s cadence`,
  );
}

export function stopADKOrchestrator(): void {
  running = false;
  if (cycleTimer) {
    clearTimeout(cycleTimer);
    cycleTimer = null;
  }
  ai = null;
  recentlyProcessed.clear();
  console.log('[ADK] Orchestrator stopped.');
}
