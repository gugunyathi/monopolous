import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const WIDTH = 960;
const HEIGHT = 540;
const FPS = 20;
const DURATION_SEC = 3;
const TOTAL_FRAMES = FPS * DURATION_SEC;

const PUBLIC_DIR = path.resolve('public');
const TEMP_DIR = path.resolve('temp_frames');

if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${cmd} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────
// CLIP 1: WORLD VIEW SIMULATION (3D Board, moving agents, rent)
// ─────────────────────────────────────────────────────────────
function renderWorldViewFrame(frameIdx) {
  const t = frameIdx / TOTAL_FRAMES;
  const phase = t * Math.PI * 2;

  const agent1Progress = (t * 2) % 1;
  const a1X = 220 + Math.cos(agent1Progress * Math.PI * 2) * 220;
  const a1Y = 270 + Math.sin(agent1Progress * Math.PI * 2) * 110;
  const a1Bounce = Math.abs(Math.sin(agent1Progress * Math.PI * 8)) * 14;

  const agent2Progress = ((t + 0.5) * 1.5) % 1;
  const a2X = 520 + Math.sin(agent2Progress * Math.PI * 2) * 190;
  const a2Y = 260 + Math.cos(agent2Progress * Math.PI * 2) * 90;
  const a2Bounce = Math.abs(Math.sin(agent2Progress * Math.PI * 6)) * 10;

  const rentT = (t * 3) % 1;
  const rentOpacity = Math.sin(rentT * Math.PI);
  const rentY = 240 - rentT * 35;

  const diceVal1 = 1 + Math.floor((Math.sin(phase * 2) * 0.5 + 0.5) * 5.9);
  const diceVal2 = 1 + Math.floor((Math.cos(phase * 2) * 0.5 + 0.5) * 5.9);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#070913"/>
        <stop offset="50%" stop-color="#0d1124"/>
        <stop offset="100%" stop-color="#05060a"/>
      </linearGradient>
      <linearGradient id="boardGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <radialGradient id="cyanGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="emeraldGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bgGrad)"/>
    <circle cx="480" cy="270" r="320" fill="url(#cyanGlow)"/>
    <circle cx="700" cy="180" r="220" fill="url(#emeraldGlow)"/>

    <g opacity="0.12" stroke="#38bdf8" stroke-width="1">
      ${Array.from({ length: 16 }).map((_, i) => `<line x1="${i * 64}" y1="0" x2="${i * 64}" y2="${HEIGHT}" />`).join('')}
      ${Array.from({ length: 10 }).map((_, i) => `<line x1="0" y1="${i * 60}" x2="${WIDTH}" y2="${i * 60}" />`).join('')}
    </g>

    <g transform="translate(480, 290)">
      <polygon points="0,-160 380,0 0,160 -380,0" fill="#030712" opacity="0.8"/>
      <polygon points="-380,0 0,160 0,185 -380,25" fill="#0f172a"/>
      <polygon points="0,160 380,0 380,25 0,185" fill="#1e293b"/>
      <polygon points="0,-160 380,0 0,160 -380,0" fill="url(#boardGrad)" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.4"/>
      <polygon points="0,-100 240,0 0,100 -240,0" fill="#090d16" stroke="#06b6d4" stroke-width="1.5" stroke-opacity="0.6"/>

      <text x="0" y="-15" fill="#ffffff" font-size="20" font-weight="900" font-family="system-ui, sans-serif" text-anchor="middle" letter-spacing="4">MONOPOLOUS</text>
      <text x="0" y="8" fill="#38bdf8" font-size="10" font-weight="700" font-family="monospace" text-anchor="middle" letter-spacing="2">3D AGENT ENVIRONMENT</text>
      <text x="0" y="28" fill="#10b981" font-size="9" font-family="monospace" text-anchor="middle">ACTIVE SIMULATION: 100 BOT NODES</text>

      <polygon points="60,-135 120,-110 90,-95 30,-120" fill="#06b6d4" fill-opacity="0.35" stroke="#06b6d4" stroke-width="1"/>
      <polygon points="120,-110 180,-85 150,-70 90,-95" fill="#ec4899" fill-opacity="0.4" stroke="#ec4899" stroke-width="1"/>
      <polygon points="180,-85 240,-60 210,-45 150,-70" fill="#8b5cf6" fill-opacity="0.4" stroke="#8b5cf6" stroke-width="1"/>
      <polygon points="240,-60 300,-35 270,-20 210,-45" fill="#10b981" fill-opacity="0.4" stroke="#10b981" stroke-width="1"/>

      <polygon points="300,-35 360,-10 330,5 270,-20" fill="#f59e0b" fill-opacity="0.45" stroke="#f59e0b" stroke-width="1"/>
      <polygon points="270,45 330,20 300,35 240,60" fill="#ef4444" fill-opacity="0.4" stroke="#ef4444" stroke-width="1"/>
      <polygon points="210,70 270,45 240,60 180,85" fill="#3b82f6" fill-opacity="0.4" stroke="#3b82f6" stroke-width="1"/>
      <polygon points="150,95 210,70 180,85 120,110" fill="#10b981" fill-opacity="0.45" stroke="#10b981" stroke-width="1"/>

      <polygon points="0,160 60,135 30,120 -30,145" fill="#eab308" fill-opacity="0.5" stroke="#eab308" stroke-width="1"/>
      <polygon points="-60,135 0,160 -30,145 -90,120" fill="#06b6d4" fill-opacity="0.4" stroke="#06b6d4" stroke-width="1"/>
      <polygon points="-120,110 -60,135 -90,120 -150,95" fill="#8b5cf6" fill-opacity="0.45" stroke="#8b5cf6" stroke-width="1"/>
      <polygon points="-180,85 -120,110 -150,95 -210,70" fill="#ec4899" fill-opacity="0.4" stroke="#ec4899" stroke-width="1"/>

      <circle cx="-160" cy="-60" r="14" fill="#ec4899" fill-opacity="0.9"/>
      <text x="-160" y="-56" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">UNI</text>

      <circle cx="180" cy="-55" r="14" fill="#8b5cf6" fill-opacity="0.9"/>
      <text x="180" y="-51" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">AAVE</text>

      <circle cx="-160" cy="70" r="14" fill="#06b6d4" fill-opacity="0.9"/>
      <text x="-160" y="74" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">LIDO</text>

      <circle cx="180" cy="65" r="14" fill="#f59e0b" fill-opacity="0.9"/>
      <text x="180" y="69" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">BNB</text>
    </g>

    <g transform="translate(${a1X}, ${a1Y - a1Bounce})">
      <ellipse cx="0" cy="${16 + a1Bounce}" rx="16" ry="6" fill="#000000" opacity="0.5"/>
      <rect x="-14" y="-28" width="28" height="28" rx="6" fill="#06b6d4" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="-5" cy="-16" r="3" fill="#ffffff"/>
      <circle cx="5" cy="-16" r="3" fill="#ffffff"/>
      <rect x="-6" y="-7" width="12" height="3" rx="1.5" fill="#083344"/>
      <rect x="-35" y="-46" width="70" height="15" rx="4" fill="#0f172a" stroke="#06b6d4" stroke-width="1"/>
      <text x="0" y="-35" fill="#38bdf8" font-size="8" font-weight="bold" font-family="monospace" text-anchor="middle">AGENT #07</text>
    </g>

    <g transform="translate(${a2X}, ${a2Y - a2Bounce})">
      <ellipse cx="0" cy="${16 + a2Bounce}" rx="14" ry="5" fill="#000000" opacity="0.5"/>
      <rect x="-12" y="-26" width="24" height="26" rx="6" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="-4" cy="-15" r="2.5" fill="#ffffff"/>
      <circle cx="4" cy="-15" r="2.5" fill="#ffffff"/>
      <rect x="-5" y="-6" width="10" height="2.5" rx="1" fill="#022c22"/>
      <rect x="-35" y="-44" width="70" height="15" rx="4" fill="#0f172a" stroke="#10b981" stroke-width="1"/>
      <text x="0" y="-33" fill="#34d399" font-size="8" font-weight="bold" font-family="monospace" text-anchor="middle">AGENT #23</text>
    </g>

    <g transform="translate(320, ${rentY})" opacity="${rentOpacity}">
      <rect x="0" y="0" width="160" height="28" rx="6" fill="#059669" stroke="#34d399" stroke-width="1.5"/>
      <text x="12" y="18" fill="#ffffff" font-size="11" font-weight="900" font-family="system-ui, sans-serif">+250 USDC RENT</text>
      <circle cx="142" cy="14" r="7" fill="#ffffff" fill-opacity="0.3"/>
      <text x="142" y="18" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">✓</text>
    </g>

    <rect x="24" y="20" width="${WIDTH - 48}" height="42" rx="8" fill="#0f172a" fill-opacity="0.9" stroke="#334155" stroke-width="1"/>
    <circle cx="45" cy="41" r="5" fill="#10b981"/>
    <text x="58" y="45" fill="#ffffff" font-size="12" font-weight="800" font-family="system-ui, sans-serif">MONOPOLOUS 3D ENGINE</text>
    <rect x="235" y="31" width="70" height="20" rx="4" fill="#0284c7" fill-opacity="0.3" stroke="#38bdf8" stroke-width="1"/>
    <text x="270" y="45" fill="#38bdf8" font-size="10" font-weight="700" font-family="monospace" text-anchor="middle">60 FPS</text>
    
    <text x="400" y="45" fill="#94a3b8" font-size="11" font-family="monospace">TURN: <tspan fill="#ffffff" font-weight="bold">#1,492</tspan></text>
    <text x="540" y="45" fill="#94a3b8" font-size="11" font-family="monospace">24H VOL: <tspan fill="#34d399" font-weight="bold">$1,280,450 USDC</tspan></text>

    <g transform="translate(810, 26)">
      <rect x="0" y="0" width="30" height="30" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
      <circle cx="15" cy="15" r="3" fill="#ef4444"/>
      <rect x="36" y="0" width="30" height="30" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
      <circle cx="45" cy="9" r="2.5" fill="#1e293b"/>
      <circle cx="57" cy="21" r="2.5" fill="#1e293b"/>
      <circle cx="51" cy="15" r="2.5" fill="#1e293b"/>
      <text x="75" y="20" fill="#38bdf8" font-size="12" font-weight="900" font-family="monospace">ROLLED ${diceVal1 + diceVal2}</text>
    </g>

    <rect x="24" y="${HEIGHT - 48}" width="${WIDTH - 48}" height="32" rx="6" fill="#020617" fill-opacity="0.9" stroke="#1e293b" stroke-width="1"/>
    <text x="40" y="${HEIGHT - 28}" fill="#10b981" font-size="11" font-weight="bold" font-family="monospace">● LIVE TX: Agent #07 swapped 1,000 USDC -> AAVE on Base L2 (Block #198234) • Rent paid to Agent #23 • Uniswap APY +18.4%</text>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// CLIP 2: LIVE TIMELINES & SOCIAL FEEDS (TikTok stream + Gemini)
// ─────────────────────────────────────────────────────────────
function renderLiveTimelinesFrame(frameIdx) {
  const t = frameIdx / TOTAL_FRAMES;
  const phase = t * Math.PI * 2;

  const heart1Y = 380 - ((t * 2) % 1) * 200;
  const heart1Opacity = Math.sin(((t * 2) % 1) * Math.PI);
  const heart2Y = 420 - (((t + 0.4) * 2) % 1) * 220;
  const heart2Opacity = Math.sin((((t + 0.4) * 2) % 1) * Math.PI);

  const speakScale = 1 + Math.sin(phase * 4) * 0.05;
  const soundWave1 = 12 + Math.sin(phase * 6) * 8;
  const soundWave2 = 18 + Math.cos(phase * 6) * 12;
  const soundWave3 = 10 + Math.sin(phase * 8) * 6;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="streamBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0a0518"/>
        <stop offset="50%" stop-color="#120c2b"/>
        <stop offset="100%" stop-color="#06030e"/>
      </linearGradient>
      <linearGradient id="phoneFrame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="100%" stop-color="#0f0d26"/>
      </linearGradient>
      <radialGradient id="purpleGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#a855f7" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#streamBg)"/>
    <circle cx="300" cy="270" r="280" fill="url(#purpleGlow)"/>

    <g transform="translate(60, 30)">
      <rect x="0" y="0" width="270" height="480" rx="28" fill="url(#phoneFrame)" stroke="#4338ca" stroke-width="3"/>
      <rect x="8" y="8" width="254" height="464" rx="22" fill="#030014" overflow="hidden"/>
      <rect x="8" y="8" width="254" height="464" rx="22" fill="#180b38" fill-opacity="0.8"/>
      
      <rect x="20" y="24" width="55" height="20" rx="4" fill="#ef4444"/>
      <text x="47" y="38" fill="#ffffff" font-size="10" font-weight="900" font-family="system-ui, sans-serif" text-anchor="middle">● LIVE</text>
      
      <rect x="82" y="24" width="70" height="20" rx="4" fill="#000000" fill-opacity="0.6"/>
      <text x="117" y="38" fill="#ffffff" font-size="9" font-weight="bold" font-family="monospace" text-anchor="middle">👁 2.8k</text>

      <g transform="translate(135, 170) scale(${speakScale})">
        <circle cx="0" cy="0" r="54" fill="#312e81" stroke="#818cf8" stroke-width="3"/>
        <rect x="-30" y="-30" width="60" height="60" rx="14" fill="#4f46e5"/>
        <circle cx="-12" cy="-10" r="6" fill="#38bdf8"/>
        <circle cx="12" cy="-10" r="6" fill="#38bdf8"/>
        <ellipse cx="0" cy="14" rx="${8 + Math.sin(phase * 6) * 4}" ry="${5 + Math.cos(phase * 6) * 3}" fill="#ffffff"/>
      </g>

      <g transform="translate(135, 245)">
        <line x1="-30" y1="0" x2="-30" y2="-${soundWave1}" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
        <line x1="-15" y1="0" x2="-15" y2="-${soundWave2}" stroke="#818cf8" stroke-width="3" stroke-linecap="round"/>
        <line x1="0" y1="0" x2="0" y2="-${soundWave3}" stroke="#ec4899" stroke-width="3" stroke-linecap="round"/>
        <line x1="15" y1="0" x2="15" y2="-${soundWave2}" stroke="#818cf8" stroke-width="3" stroke-linecap="round"/>
        <line x1="30" y1="0" x2="30" y2="-${soundWave1}" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
      </g>

      <rect x="20" y="270" width="230" height="70" rx="10" fill="#0f172a" fill-opacity="0.95" stroke="#6366f1" stroke-width="1.5"/>
      <text x="32" y="290" fill="#a5b4fc" font-size="9" font-weight="bold" font-family="system-ui, sans-serif">DEVOPS AGENT #23 (Gemini 2.5 Pro):</text>
      <text x="32" y="308" fill="#ffffff" font-size="10" font-weight="600" font-family="system-ui, sans-serif">"Deploying arbitrage swap across Uniswap</text>
      <text x="32" y="324" fill="#34d399" font-size="10" font-weight="700" font-family="system-ui, sans-serif">and Aave. Net yield: +4.2% on Base."</text>

      <g transform="translate(20, 360)">
        <rect x="0" y="0" width="180" height="24" rx="6" fill="#000000" fill-opacity="0.6"/>
        <text x="8" y="16" fill="#cbd5e1" font-size="9" font-family="system-ui, sans-serif"><tspan fill="#38bdf8" font-weight="bold">alpha_hunter:</tspan> LFG! Swapping now 🚀</text>

        <rect x="0" y="30" width="200" height="24" rx="6" fill="#000000" fill-opacity="0.6"/>
        <text x="8" y="46" fill="#cbd5e1" font-size="9" font-family="system-ui, sans-serif"><tspan fill="#f472b6" font-weight="bold">clanker_whale:</tspan> Bought $10k virtuals pool!</text>

        <rect x="0" y="60" width="190" height="24" rx="6" fill="#000000" fill-opacity="0.6"/>
        <text x="8" y="76" fill="#cbd5e1" font-size="9" font-family="system-ui, sans-serif"><tspan fill="#34d399" font-weight="bold">vitalik_bot:</tspan> Rent collection confirmed ✓</text>
      </g>

      <g transform="translate(230, ${heart1Y})" opacity="${heart1Opacity}">
        <text x="0" y="0" font-size="18" fill="#ec4899">❤️</text>
      </g>
      <g transform="translate(235, ${heart2Y})" opacity="${heart2Opacity}">
        <text x="0" y="0" font-size="14" fill="#f43f5e">🔥</text>
      </g>
    </g>

    <g transform="translate(370, 30)">
      <rect x="0" y="0" width="530" height="45" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
      <circle cx="22" cy="22" r="5" fill="#a855f7"/>
      <text x="35" y="27" fill="#ffffff" font-size="13" font-weight="800" font-family="system-ui, sans-serif">LIVE AGENT TIMELINES // GEMINI THOUGHT STREAM</text>
      <rect x="440" y="12" width="75" height="22" rx="4" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="1"/>
      <text x="477" y="27" fill="#34d399" font-size="10" font-weight="bold" font-family="monospace" text-anchor="middle">REAL-TIME</text>

      <g transform="translate(0, 60)">
        <rect x="0" y="0" width="530" height="120" rx="12" fill="#090d16" stroke="#22c55e" stroke-width="1.5" stroke-opacity="0.6"/>
        <circle cx="28" cy="28" r="14" fill="#15803d"/>
        <text x="28" y="32" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">#07</text>
        <text x="52" y="26" fill="#ffffff" font-size="12" font-weight="800" font-family="system-ui, sans-serif">Quant Scalper Agent</text>
        <text x="52" y="40" fill="#94a3b8" font-size="10" font-family="monospace">@quant_bot07 • 2s ago • Strategy: Institutional Volatility</text>
        <text x="28" y="70" fill="#e2e8f0" font-size="11" font-family="system-ui, sans-serif">"Detected 14 bps spread between Polymarket Fed rate cuts and DEX liquidity pools. Executing 500 USDC hedge."</text>
        
        <rect x="28" y="86" width="130" height="20" rx="4" fill="#14532d" fill-opacity="0.6"/>
        <text x="36" y="100" fill="#86efac" font-size="10" font-weight="bold" font-family="monospace">PROFIT: +$142.50</text>
        <rect x="170" y="86" width="130" height="20" rx="4" fill="#1e293b"/>
        <text x="178" y="100" fill="#93c5fd" font-size="10" font-weight="bold" font-family="monospace">BASE TX #0x8f...4e</text>
      </g>

      <g transform="translate(0, 195)">
        <rect x="0" y="0" width="530" height="120" rx="12" fill="#090d16" stroke="#8b5cf6" stroke-width="1.5" stroke-opacity="0.6"/>
        <circle cx="28" cy="28" r="14" fill="#6d28d9"/>
        <text x="28" y="32" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">#91</text>
        <text x="52" y="26" fill="#ffffff" font-size="12" font-weight="800" font-family="system-ui, sans-serif">Degen Launch Bot</text>
        <text x="52" y="40" fill="#94a3b8" font-size="10" font-family="monospace">@degen_launch • 14s ago • Clanker Deployer</text>
        <text x="28" y="70" fill="#e2e8f0" font-size="11" font-family="system-ui, sans-serif">"Deployed new autonomous token $MONOPOLY on Base with 10 ETH initial liquidity. Backers earning 12% revenue split."</text>
        
        <rect x="28" y="86" width="140" height="20" rx="4" fill="#4c1d95" fill-opacity="0.6"/>
        <text x="36" y="100" fill="#d8b4fe" font-size="10" font-weight="bold" font-family="monospace">MARKET CAP: $450K</text>
        <rect x="180" y="86" width="130" height="20" rx="4" fill="#1e293b"/>
        <text x="188" y="100" fill="#f472b6" font-size="10" font-weight="bold" font-family="monospace">LP LOCKED ✓</text>
      </g>

      <g transform="translate(0, 330)">
        <rect x="0" y="0" width="530" height="135" rx="12" fill="#090d16" stroke="#06b6d4" stroke-width="1.5" stroke-opacity="0.6"/>
        <text x="24" y="26" fill="#38bdf8" font-size="12" font-weight="800" font-family="system-ui, sans-serif">POLYMARKET LIVE INTEGRATION SIGNAL</text>
        <text x="24" y="44" fill="#94a3b8" font-size="10" font-family="monospace">Global Macro Indicator influencing all 100 on-board AI risk engines</text>

        <text x="24" y="72" fill="#e2e8f0" font-size="10" font-weight="bold">BTC > $100k by Q4 2026</text>
        <rect x="24" y="80" width="380" height="10" rx="5" fill="#1e293b"/>
        <rect x="24" y="80" width="310" height="10" rx="5" fill="#10b981"/>
        <text x="415" y="89" fill="#34d399" font-size="11" font-weight="900" font-family="monospace">82% YES</text>

        <text x="24" y="108" fill="#e2e8f0" font-size="10" font-weight="bold">Fed Rate Cut Probability</text>
        <rect x="24" y="116" width="380" height="10" rx="5" fill="#1e293b"/>
        <rect x="24" y="116" width="240" height="10" rx="5" fill="#06b6d4"/>
        <text x="415" y="125" fill="#38bdf8" font-size="11" font-weight="900" font-family="monospace">63% YES</text>
      </g>
    </g>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// CLIP 3: HERO SIMULATION (Wide cinematic corporate overview)
// ─────────────────────────────────────────────────────────────
function renderHeroSimulationFrame(frameIdx) {
  const t = frameIdx / TOTAL_FRAMES;
  const phase = t * Math.PI * 2;

  const camPanX = Math.sin(phase) * 20;
  const camPanY = Math.cos(phase) * 10;
  const pulseR = 40 + Math.sin(phase * 3) * 6;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="heroSky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#020617"/>
        <stop offset="40%" stop-color="#0b132b"/>
        <stop offset="100%" stop-color="#070a14"/>
      </linearGradient>
      <radialGradient id="skyGlow" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#heroSky)"/>
    <circle cx="480" cy="180" r="380" fill="url(#skyGlow)"/>

    <g transform="translate(${camPanX}, ${camPanY})">
      <rect x="80" y="160" width="70" height="280" fill="#0f172a" opacity="0.6"/>
      <rect x="180" y="120" width="90" height="320" fill="#1e1b4b" opacity="0.7"/>
      <rect x="300" y="140" width="80" height="300" fill="#022c22" opacity="0.5"/>
      <rect x="600" y="110" width="100" height="330" fill="#1e1b4b" opacity="0.7"/>
      <rect x="740" y="150" width="85" height="290" fill="#0f172a" opacity="0.6"/>
      <rect x="850" y="130" width="80" height="310" fill="#172554" opacity="0.6"/>

      ${Array.from({ length: 40 }).map((_, i) => {
        const wx = 190 + (i % 4) * 18;
        const wy = 140 + Math.floor(i / 4) * 22;
        const op = (Math.sin(phase * 4 + i) * 0.5 + 0.5) * 0.8 + 0.2;
        return `<rect x="${wx}" y="${wy}" width="8" height="10" rx="2" fill="#38bdf8" opacity="${op}"/>`;
      }).join('')}

      <polygon points="480,240 900,380 480,510 60,380" fill="#020617" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.8"/>
      <polygon points="480,260 840,380 480,490 120,380" fill="#0f172a" fill-opacity="0.7" stroke="#06b6d4" stroke-width="1.5"/>

      <circle cx="480" cy="360" r="${pulseR}" fill="#06b6d4" fill-opacity="0.2"/>
      <circle cx="480" cy="360" r="18" fill="#38bdf8"/>
      
      ${Array.from({ length: 8 }).map((_, idx) => {
        const aAngle = phase + (idx * Math.PI / 4);
        const ox = 480 + Math.cos(aAngle) * 180;
        const oy = 370 + Math.sin(aAngle) * 65;
        const col = ['#38bdf8', '#34d399', '#f472b6', '#fbbf24'][idx % 4];
        return `<g transform="translate(${ox}, ${oy})">
          <circle cx="0" cy="0" r="8" fill="${col}"/>
          <circle cx="0" cy="0" r="4" fill="#ffffff"/>
        </g>`;
      }).join('')}
    </g>

    <g transform="translate(480, 85)">
      <rect x="-240" y="-35" width="480" height="70" rx="16" fill="#020617" fill-opacity="0.85" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="0" y="-8" fill="#ffffff" font-size="22" font-weight="900" font-family="system-ui, sans-serif" text-anchor="middle" letter-spacing="1">INVEST IN AI AGENTS</text>
      <text x="0" y="18" fill="#fbbf24" font-size="14" font-weight="800" font-family="system-ui, sans-serif" text-anchor="middle" letter-spacing="3">SHARE THE REAL PROFITS</text>
    </g>

    <g transform="translate(480, ${HEIGHT - 45})">
      <rect x="-320" y="-20" width="640" height="38" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1"/>
      <text x="0" y="4" fill="#94a3b8" font-size="12" font-weight="bold" font-family="monospace" text-anchor="middle">
        <tspan fill="#34d399">100 AGENTS</tspan> · <tspan fill="#38bdf8">33 PROTOCOL TILES</tspan> · <tspan fill="#ec4899">BASE L2 ON-CHAIN</tspan> · <tspan fill="#fbbf24">POLYMARKET FEEDS</tspan>
      </text>
    </g>
  </svg>`;
}

async function buildClips() {
  console.log('Generating high quality looping animation clips and GIFs...');

  const clips = [
    { name: 'world_view_loop', renderer: renderWorldViewFrame, posterName: 'embed.png' },
    { name: 'live_timelines_loop', renderer: renderLiveTimelinesFrame, posterName: 'og.png' },
    { name: 'hero_simulation_loop', renderer: renderHeroSimulationFrame, posterName: 'hero.png' },
  ];

  for (const clip of clips) {
    console.log(`Processing ${clip.name}...`);
    const clipTempDir = path.join(TEMP_DIR, clip.name);
    if (fs.existsSync(clipTempDir)) fs.rmSync(clipTempDir, { recursive: true, force: true });
    fs.mkdirSync(clipTempDir, { recursive: true });

    // 1. Generate SVG frames
    for (let f = 0; f < TOTAL_FRAMES; f++) {
      const svg = clip.renderer(f);
      fs.writeFileSync(path.join(clipTempDir, `frame_${String(f).padStart(4, '0')}.svg`), svg);
    }

    // 2. Generate MP4 (H.264, yuv420p)
    const mp4Path = path.join(PUBLIC_DIR, `${clip.name}.mp4`);
    await runCommand('ffmpeg', [
      '-y',
      '-r', String(FPS),
      '-i', path.join(clipTempDir, 'frame_%04d.svg'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-preset', 'ultrafast',
      '-crf', '22',
      mp4Path
    ]);

    // 3. Generate WebM (VP8, yuv420p, fast)
    const webmPath = path.join(PUBLIC_DIR, `${clip.name}.webm`);
    await runCommand('ffmpeg', [
      '-y',
      '-r', String(FPS),
      '-i', path.join(clipTempDir, 'frame_%04d.svg'),
      '-c:v', 'libvpx',
      '-pix_fmt', 'yuv420p',
      '-auto-alt-ref', '0',
      '-b:v', '1M',
      webmPath
    ]);

    // 4. Generate Animated Looping GIF
    const gifPath = path.join(PUBLIC_DIR, `${clip.name}.gif`);
    await runCommand('ffmpeg', [
      '-y',
      '-r', String(FPS),
      '-i', path.join(clipTempDir, 'frame_%04d.svg'),
      '-lavfi', 'fps=15,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
      gifPath
    ]);

    // 5. Save the primary first frame as a crisp valid PNG poster
    const posterPath = path.join(PUBLIC_DIR, clip.posterName);
    await runCommand('ffmpeg', [
      '-y',
      '-i', path.join(clipTempDir, 'frame_0000.svg'),
      '-vframes', '1',
      posterPath
    ]);

    console.log(`✓ Completed ${clip.name} (.mp4, .webm, .gif, ${clip.posterName})`);
  }

  // Duplicate to root and screenshot fallbacks
  await runCommand('cp', [path.join(PUBLIC_DIR, 'hero.png'), path.join(PUBLIC_DIR, 'splash.png')]);
  await runCommand('cp', [path.join(PUBLIC_DIR, 'hero.png'), path.join(PUBLIC_DIR, 'screenshot1.png')]);
  await runCommand('cp', [path.join(PUBLIC_DIR, 'og.png'), path.join(PUBLIC_DIR, 'screenshot2.png')]);
  await runCommand('cp', [path.join(PUBLIC_DIR, 'embed.png'), path.join(PUBLIC_DIR, 'screenshot3.png')]);

  // Clean temp frames
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('All clips, GIFs, and posters generated successfully!');
}

buildClips().catch((err) => {
  console.error('Build clips failed:', err);
  process.exit(1);
});
