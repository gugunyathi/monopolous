import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BoidsParams, AgentBehavior } from '../../types';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { AGENTS, ARC_AGENTS, ARC_AGENT_START, CORE_AGENT_COUNT, PLAYER_INDEX } from '../../data/agents';

/** Map a 3D scene instance index (0-based) back to its logical agent index. */
export function sceneIndexToAgentIndex(i: number): number {
  if (i < CORE_AGENT_COUNT) return i;
  const arcIdx = i - CORE_AGENT_COUNT;
  return arcIdx < ARC_AGENTS.length ? ARC_AGENTS[arcIdx].index : i;
}

/** Map a logical agent index (possibly 2000+) to a 3D scene instance index. */
export function agentIndexToSceneIndex(agentIndex: number): number {
  if (agentIndex < CORE_AGENT_COUNT) return agentIndex;
  if (agentIndex >= ARC_AGENT_START) {
    const arcIdx = ARC_AGENTS.findIndex(a => a.index === agentIndex);
    if (arcIdx !== -1) return CORE_AGENT_COUNT + arcIdx;
  }
  return -1; // not in scene
}
import { useStore } from '../../store/useStore';

const EMOJI_CACHE: Record<string, THREE.CanvasTexture> = {};

function getEmojiTexture(emoji: string): THREE.CanvasTexture {
  if (EMOJI_CACHE[emoji]) return EMOJI_CACHE[emoji];
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  EMOJI_CACHE[emoji] = tex;
  return tex;
}

export class CharacterManager {
  private instanceCount = 100;
  private colors = ['#7EACEA', '#f472b6', '#fb7185', '#4ade80', '#fbbf24'];

  // CPU Buffers
  private posArray: Float32Array | null = null;
  private velArray: Float32Array | null = null;
  private timeOffsetArray: Float32Array | null = null;

  // Agent state buffer (CPU): waypoint + behavior state per instance
  private agentStateBuffer: AgentStateBuffer | null = null;

  // Assets & Objects
  private instancedMesh: THREE.InstancedMesh | null = null;
  private baseGeometry: THREE.BufferGeometry | null = null;
  private baseMaterial: THREE.MeshStandardMaterial | null = null;

  // ADK Agent Badges — floating sprites above autonomous agents
  private badgeSprites: THREE.Sprite[] = [];

  // CEO body label sprite
  private ceoLabelSprite: THREE.Sprite | null = null;

  // Params
  private speed = 0.015;
  private separationRadius = 0.6;
  private separationStrength = 0.030;
  private worldSize = 25.0;

  public isLoaded = false;
  private dummy = new THREE.Object3D();
  private clock = new THREE.Clock();

  constructor(private scene: THREE.Scene) {}

  private createProceduralGeometry(): THREE.BufferGeometry {
    // High quality stylized low-poly agent character geometry: rounded capsule centered at floor level
    const geom = new THREE.CapsuleGeometry(0.22, 0.55, 6, 12);
    geom.translate(0, 0.45, 0);
    return geom;
  }

  public async load() {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync('/models/character.glb');
      const model = gltf.scene;

      let skinnedMesh: THREE.SkinnedMesh | null = null;
      model.traverse((child) => {
        if ((child as any).isSkinnedMesh && !skinnedMesh) {
          skinnedMesh = child as THREE.SkinnedMesh;
        }
      });

      if (skinnedMesh) {
        this.baseGeometry = (skinnedMesh as THREE.SkinnedMesh).geometry;
        this.baseMaterial = (skinnedMesh as THREE.SkinnedMesh).material as THREE.MeshStandardMaterial;
      } else {
        model.traverse((child) => {
          if ((child as any).isMesh && !this.baseGeometry) {
            const m = child as THREE.Mesh;
            this.baseGeometry = m.geometry;
            this.baseMaterial = m.material as THREE.MeshStandardMaterial;
          }
        });
      }
    } catch {
      // Graceful fallback to procedural humanoid geometry
    }

    if (!this.baseGeometry) {
      this.baseGeometry = this.createProceduralGeometry();
      this.baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        roughness: 0.4,
        metalness: 0.1,
      });
    }

    this.initInstances();
    this.isLoaded = true;
    this.initBadges();
  }

  public setInstanceCount(count: number) {
    if (this.instanceCount === count) return;
    this.instanceCount = count;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }

  public updateBoidsParams(params: BoidsParams) {
    this.speed = params.speed;
    this.separationRadius = params.separationRadius;
    this.separationStrength = params.separationStrength;
  }

  public updateWorldSize(size: number) {
    const changed = this.worldSize !== size;
    this.worldSize = size;
    if (changed && this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }

  public async syncFromGPU(renderer: any): Promise<Float32Array | null> {
    return this.posArray;
  }

  public update(delta: number, renderer: any) {
    if (!this.instancedMesh || !this.posArray || !this.velArray || !this.agentStateBuffer || !this.timeOffsetArray) return;

    const time = this.clock.getElapsedTime();
    const halfSize = this.worldSize;

    const storeWeather = useStore.getState().weather;
    let weatherSpeedFactor = 1.0;
    if (storeWeather === 'snow') weatherSpeedFactor = 0.6; // Crypto winter slows movement
    else if (storeWeather === 'sun') weatherSpeedFactor = 1.3; // Bull market speeds movement up
    const effectiveSpeed = this.speed * weatherSpeedFactor;

    for (let i = 0; i < this.instanceCount; i++) {
      const state = this.agentStateBuffer.getState(i);
      const px = this.posArray[i * 4 + 0];
      const py = this.posArray[i * 4 + 1];
      const pz = this.posArray[i * 4 + 2];
      
      let vx = this.velArray[i * 4 + 0];
      let vy = this.velArray[i * 4 + 1];
      let vz = this.velArray[i * 4 + 2];

      let newPx = px;
      let newPz = pz;
      let isMoving = false;

      if (state === AgentBehavior.GOTO) {
        const wp = this.agentStateBuffer.getWaypoint(i);
        const dx = wp.x - px;
        const dz = wp.z - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist > 0.2) {
          vx = (dx / dist) * effectiveSpeed * 4.0;
          vz = (dz / dist) * effectiveSpeed * 4.0;
          newPx += vx;
          newPz += vz;
          isMoving = true;
        } else {
          vx = 0;
          vz = 0;
        }
      } else if (state === AgentBehavior.BOIDS) {
        let ax = 0;
        let az = 0;

        // Boundary
        if (Math.abs(px) > halfSize || Math.abs(pz) > halfSize) {
          const len = Math.sqrt(px * px + pz * pz);
          ax += (-px / len) * 0.01;
          az += (-pz / len) * 0.01;
        }

        // Separation
        for (let j = 0; j < this.instanceCount; j++) {
          if (i === j) continue;
          const ox = this.posArray[j * 4 + 0];
          const oz = this.posArray[j * 4 + 2];
          const dx = px - ox;
          const dz = pz - oz;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < this.separationRadius && dist > 0.01) {
            ax += (dx / dist) * this.separationStrength;
            az += (dz / dist) * this.separationStrength;
          }
        }

        vx += ax;
        vz += az;
        const speed = Math.sqrt(vx * vx + vz * vz);
        if (speed > 0.001) {
          vx = (vx / speed) * effectiveSpeed;
          vz = (vz / speed) * effectiveSpeed;
        } else {
          vx = 0;
          vz = effectiveSpeed;
        }
        newPx += vx;
        newPz += vz;
        isMoving = true;
      } else {
        // FROZEN or WAVE
        const wp = this.agentStateBuffer.getWaypoint(i);
        if (Math.abs(wp.x) > 0.001 || Math.abs(wp.z) > 0.001) {
          vx = wp.x;
          vz = wp.z;
        }
      }

      this.posArray[i * 4 + 0] = newPx;
      this.posArray[i * 4 + 2] = newPz;
      this.velArray[i * 4 + 0] = vx;
      this.velArray[i * 4 + 2] = vz;

      // Update Matrix
      this.dummy.position.set(newPx, py, newPz);
      
      // Procedural Animation
      const timeOffset = this.timeOffsetArray[i];
      const localTime = time + timeOffset;
      
      // Facing direction
      let facingAngle = 0;
      if (Math.abs(vx) > 0.001 || Math.abs(vz) > 0.001) {
        facingAngle = Math.atan2(vx, vz);
      }

      if (isMoving) {
        // Subway Surfers style running & parkour jumping sprint
        this.dummy.position.y = py + Math.abs(Math.sin(localTime * 16)) * 0.45; // High jump leap over board tiles
        // Forward sprint lean + banking into turns
        this.dummy.rotation.set(0.35 + Math.sin(localTime * 16) * 0.1, facingAngle, Math.sin(localTime * 8) * 0.25);
      } else if (state === AgentBehavior.WAVE) {
        // Waving / celebration jump
        this.dummy.position.y = py + Math.abs(Math.sin(localTime * 20)) * 0.6;
        this.dummy.rotation.set(0, facingAngle + Math.sin(localTime * 12) * 0.6, 0);
      } else {
        // Idle breathing stance
        this.dummy.position.y = py + Math.sin(localTime * 2) * 0.03;
        this.dummy.rotation.set(0.1, facingAngle, 0);
      }

      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.updateBadges();
  }

  private initBadges() {
    const defaultTex = getEmojiTexture('📈');

    for (let i = 0; i < this.instanceCount; i++) {
      const spriteMaterial = new THREE.SpriteMaterial({
        map: defaultTex,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(0, 0, 1);
      sprite.renderOrder = 1000;
      this.scene.add(sprite);
      this.badgeSprites.push(sprite);
    }

    const ceoCanvas = document.createElement('canvas');
    ceoCanvas.width = 256;
    ceoCanvas.height = 128;
    const cctx = ceoCanvas.getContext('2d');
    if (cctx) {
      cctx.clearRect(0, 0, 256, 128);
      cctx.font = '900 96px Arial';
      cctx.textAlign = 'center';
      cctx.textBaseline = 'middle';
      cctx.strokeStyle = 'rgba(0,0,0,0.85)';
      cctx.lineWidth = 10;
      cctx.lineJoin = 'round';
      cctx.strokeText('CEO', 128, 64);
      cctx.fillStyle = '#ffffff';
      cctx.fillText('CEO', 128, 64);
    }
    const ceoTex = new THREE.CanvasTexture(ceoCanvas);
    ceoTex.needsUpdate = true;
    const ceoMat = new THREE.SpriteMaterial({
      map: ceoTex,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.ceoLabelSprite = new THREE.Sprite(ceoMat);
    this.ceoLabelSprite.scale.set(1.2, 0.6, 1);
    this.ceoLabelSprite.renderOrder = 999;
    this.scene.add(this.ceoLabelSprite);
  }

  private updateBadges() {
    if (!this.posArray || this.badgeSprites.length === 0) return;

    const store = useStore.getState();
    const agentBalances = store.agentBalances;
    const activeADKAgents = store.activeADKAgents;
    const time = this.clock.getElapsedTime();

    if (this.ceoLabelSprite && this.posArray) {
      const cx = this.posArray[PLAYER_INDEX * 4 + 0];
      const cy = this.posArray[PLAYER_INDEX * 4 + 1] || 0;
      const cz = this.posArray[PLAYER_INDEX * 4 + 2];
      this.ceoLabelSprite.position.set(cx, cy + 0.65, cz);
    }

    for (let i = 0; i < this.instanceCount; i++) {
      const sprite = this.badgeSprites[i];
      if (!sprite) continue;

      // Show floating 3D emoji indicators above active agents or key characters
      if (activeADKAgents.has(i) || i === PLAYER_INDEX || i % 3 === 0) {
        const px = this.posArray[i * 4 + 0];
        const py = this.posArray[i * 4 + 1] || 0;
        const pz = this.posArray[i * 4 + 2];

        const balance = agentBalances[i] ?? 1500;
        let emoji = '📈';
        if (balance > 3000) emoji = '👑';
        else if (balance > 2200) emoji = '🚀';
        else if (balance > 1800) emoji = '💎';
        else if (balance > 1400) emoji = '💰';
        else if (balance > 1000) emoji = '⭐';
        else if (balance > 700) emoji = '☕';
        else emoji = '📉';

        const currentTex = getEmojiTexture(emoji);
        if ((sprite.material as THREE.SpriteMaterial).map !== currentTex) {
          (sprite.material as THREE.SpriteMaterial).map = currentTex;
          (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
        }

        // Gentle floating bobbing animation
        const bob = Math.sin(time * 3 + i * 0.7) * 0.08;
        sprite.position.set(px, py + 1.25 + bob, pz);
        sprite.scale.set(0.55, 0.55, 1);
      } else {
        sprite.scale.set(0, 0, 1);
      }
    }
  }

  private cleanupInstances() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh = null;
    }

    for (const sprite of this.badgeSprites) {
      this.scene.remove(sprite);
      sprite.material.dispose();
      if (sprite.material.map) sprite.material.map.dispose();
    }
    this.badgeSprites = [];

    if (this.ceoLabelSprite) {
      this.scene.remove(this.ceoLabelSprite);
      (this.ceoLabelSprite.material as THREE.SpriteMaterial).map?.dispose();
      this.ceoLabelSprite.material.dispose();
      this.ceoLabelSprite = null;
    }
  }

  private initInstances() {
    if (!this.baseGeometry || !this.baseMaterial) return;

    this.posArray = new Float32Array(this.instanceCount * 4);
    this.velArray = new Float32Array(this.instanceCount * 4);
    this.timeOffsetArray = new Float32Array(this.instanceCount);

    this.instancedMesh = new THREE.InstancedMesh(this.baseGeometry, this.baseMaterial, this.instanceCount);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;

    const tempColor = new THREE.Color();

    const NUM_BOARD_TILES = 32;
    const tileSize = (this.worldSize * 2) / 8;
    const halfWorld = this.worldSize;

    const getBoardTilePos = (tileIdx: number) => {
      const t = tileIdx % NUM_BOARD_TILES;
      let tx = 0, tz = 0;
      if (t < 8) {
        tx = halfWorld - (t * tileSize);
        tz = halfWorld;
      } else if (t < 16) {
        tx = -halfWorld;
        tz = halfWorld - ((t - 8) * tileSize);
      } else if (t < 24) {
        tx = -halfWorld + ((t - 16) * tileSize);
        tz = -halfWorld;
      } else {
        tx = halfWorld;
        tz = -halfWorld + ((t - 24) * tileSize);
      }
      return { x: tx, z: tz };
    };

    const seededRand = (seed: number) => {
      const x = Math.sin(seed + 1) * 43758.5453123;
      return x - Math.floor(x);
    };

    for (let i = 0; i < this.instanceCount; i++) {
      const agent = i < CORE_AGENT_COUNT
        ? AGENTS[i]
        : (ARC_AGENTS[i - CORE_AGENT_COUNT] || AGENTS[0]);
      tempColor.set(agent.color);

      if (i === PLAYER_INDEX) {
        const genesis = getBoardTilePos(0);
        this.posArray[i * 4 + 0] = genesis.x;
        this.posArray[i * 4 + 1] = 0;
        this.posArray[i * 4 + 2] = genesis.z;
        this.posArray[i * 4 + 3] = 1;
      } else {
        const startTile = (i - 1) % NUM_BOARD_TILES;
        const tilePos = getBoardTilePos(startTile);
        const isHorizontalEdge = startTile < 9 || (startTile >= 17 && startTile < 25);
        const jitter = (seededRand(i * 3 + 1) - 0.5) * tileSize * 0.35;
        this.posArray[i * 4 + 0] = tilePos.x + (isHorizontalEdge ? jitter : 0);
        this.posArray[i * 4 + 1] = 0;
        this.posArray[i * 4 + 2] = tilePos.z + (isHorizontalEdge ? 0 : jitter);
        this.posArray[i * 4 + 3] = 1;
        
        this.velArray[i * 4 + 0] = (isHorizontalEdge ? -0.01 : 0);
        this.velArray[i * 4 + 2] = (isHorizontalEdge ? 0 : -0.01);

        if (agent.riskLevel === 'Degen') {
          tempColor.multiplyScalar(1.5);
        } else if (agent.riskLevel === 'Low') {
          tempColor.lerp(new THREE.Color('#ffffff'), 0.3);
        }
      }

      this.timeOffsetArray[i] = Math.random() * 10;
      this.instancedMesh.setColorAt(i, tempColor);
      
      this.dummy.position.set(this.posArray[i * 4 + 0], 0, this.posArray[i * 4 + 2]);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    this.agentStateBuffer = new AgentStateBuffer(this.instanceCount);
    this.agentStateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
    for (let i = 1; i < this.instanceCount; i++) {
      const startTile = (i - 1) % NUM_BOARD_TILES;
      const tp = getBoardTilePos(startTile);
      const isH = startTile < 9 || (startTile >= 17 && startTile < 25);
      const j = (seededRand(i * 3 + 1) - 0.5) * tileSize * 0.35;
      this.agentStateBuffer.setWaypoint(i, tp.x + (isH ? j : 0), tp.z + (isH ? 0 : j));
      this.agentStateBuffer.setState(i, AgentBehavior.GOTO);
    }

    this.scene.add(this.instancedMesh);
  }

  public setAction(name: string, index: number) {
    if (!this.agentStateBuffer) return;
    
    if (name === 'Wave') {
      this.agentStateBuffer.setState(index, AgentBehavior.WAVE);
    } else if (name === 'Idle') {
      this.agentStateBuffer.setState(index, AgentBehavior.FROZEN);
    } else if (name === 'Walk') {
      this.agentStateBuffer.setState(index, AgentBehavior.BOIDS);
    }
  }

  public fadeToAction(name: string, index: number = PLAYER_INDEX) {
    this.setAction(name, index);
  }
  
  public getCount() { return this.instanceCount; }

  public getAgentStateBuffer(): AgentStateBuffer | null {
    return this.agentStateBuffer;
  }

  public getCPUPositions(): Float32Array | null {
    return this.posArray;
  }

  public getCPUPosition(index: number): THREE.Vector3 | null {
    if (!this.posArray || index < 0 || index >= this.instanceCount) return null;
    const i = index * 4;
    return new THREE.Vector3(this.posArray[i], this.posArray[i + 1], this.posArray[i + 2]);
  }

  public getAgentState(index: number): number {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return 0;
    return this.agentStateBuffer.getState(index);
  }

  public setColors(hexColors: string[]) {
    this.colors = hexColors;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }
}
