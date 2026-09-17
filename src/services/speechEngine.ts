// Speech Synthesis Engine for CEO News & Agent Live Voice Commentary
class SpeechEngine {
  private enabled: boolean = false;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (!val && this.synth) {
      this.synth.cancel();
    }
  }

  public getEnabled(): boolean {
    return this.enabled;
  }

  public speak(text: string, pitch = 1.0, rate = 1.0, volume = 1.0) {
    if (!this.enabled || !this.synth) return;

    try {
      this.synth.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = pitch;
      utterance.rate = rate;
      utterance.volume = volume;

      // Select a pleasant English voice if available
      const voices = this.synth.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha')));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  public speakCeoNews(headline: string, summary: string) {
    const text = `CEO Bulletin. Breaking market update: ${headline}. Analyst insight: ${summary}`;
    this.speak(text, 0.9, 1.0, 1.0);
  }

  public speakAgentDecision(agentRole: string, decisionText: string, reason: string, nextStep: string) {
    const text = `Agent @${agentRole.replace(/\s+/g, '')} reporting live decision. Action: ${decisionText}. Reason: ${reason}. Potential next strategy: ${nextStep}.`;
    this.speak(text, 1.1, 1.05, 0.9);
  }
}

export const speechEngine = new SpeechEngine();
