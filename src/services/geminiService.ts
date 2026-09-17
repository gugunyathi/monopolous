import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private rateLimitCooldownUntil = 0;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  private generateFallbackSocialCaption(message: string, systemInstruction: string): string {
    const isBuy = message.toLowerCase().includes('buy');
    const tokenMatch = message.match(/\b(BTC|ETH|SOL|DOGE|PEPE|WIF|BONK|JUP|USDC)\b/i);
    const token = tokenMatch ? tokenMatch[1].toUpperCase() : 'crypto';

    const buyCaptions = [
      `Loading up on $${token} before the next breakout wave! 🚀📈 Solid momentum building!`,
      `Accumulating $${token} here—on-chain liquidity depth looking prime! 💎⚡`,
      `Entering a heavy long on $${token}. Sentiment indicators flashing strong green! 🔥🎯`,
      `Dollar-cost averaging into $${token}. Asymmetry is way too good to ignore! 📊✨`,
      `Broke key resistance on $${token}, adding to size right now! 🐂💰`,
    ];

    const sellCaptions = [
      `Taking strategic profits on $${token} into this pump. Discipline over greed! 💼📉`,
      `De-risking $${token} allocation and locking in gains. Rebalancing portfolio! 🛡️💵`,
      `Trimming $${token} exposure as volatility spikes near local resistance. 🧊📊`,
      `Secured the upside on $${token}. Rotating capital into high-yield liquidity pools! 🔄⚡`,
      `Closing out $${token} position with green PnL. Ready for the next rotation! 🎯📈`,
    ];

    const list = isBuy ? buyCaptions : sellCaptions;
    return list[Math.floor(Math.random() * list.length)];
  }

  private generateFallbackDialogue(message: string, systemInstruction: string): string {
    if (message.toLowerCase().includes('caption') || systemInstruction.toLowerCase().includes('caption')) {
      return this.generateFallbackSocialCaption(message, systemInstruction);
    }

    const fallbacks = [
      "Analyzing recent on-chain order flow and liquidity patterns across the board.",
      "Optimizing portfolio weighting based on risk parameters and market volatility.",
      "Monitoring automated strategy executions on Base and ARC testnet.",
      "Smart contract validations confirmed. Ready for the next trading cycle.",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  async chat(
    systemInstruction: string,
    history: ChatMessage[],
    message: string
  ): Promise<string> {
    // If rate-limited recently (e.g. 429 quota exhaustion), use instant personality fallback
    if (Date.now() < this.rateLimitCooldownUntil) {
      return this.generateFallbackDialogue(message, systemInstruction);
    }

    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
      } else {
        return this.generateFallbackDialogue(message, systemInstruction);
      }
    }

    const model = "gemini-3.7-flash";

    try {
      // Convert history to Gemini format
      const contents = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      // Add current message
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await this.ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
        }
      });

      return response.text || this.generateFallbackDialogue(message, systemInstruction);
    } catch (err: unknown) {
      const errorStr = String(err);
      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED') || errorStr.includes('quota')) {
        // Apply a 60-second backoff cooldown before attempting network calls again
        this.rateLimitCooldownUntil = Date.now() + 60_000;
        console.warn('[GeminiService] Rate limit/quota reached (429). Using intelligent local fallback generator.');
      } else {
        console.warn('[GeminiService] Model query fallback active:', errorStr);
      }
      return this.generateFallbackDialogue(message, systemInstruction);
    }
  }
}

export const geminiService = new GeminiService();
