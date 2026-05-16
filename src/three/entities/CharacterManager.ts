import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BoidsParams, AgentBehavior } from '../../types';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { AGENTS, ARC_AGENTS, ARC_AGENT_START, PLAYER_INDEX } from '../../data/agents';

/** Map a 3D scene instance index (0-based) back to its logical agent index. */
export function sceneIndexToAgentIndex(i: number): number {
  if (i < AGENTS.length) return i;
  const arcIdx = i - AGENTS.length;
  return arcIdx < ARC_AGENTS.length ? ARC_AGENTS[arcIdx].index : i;
}

/** Map a logical agent index (possibly 2000+) to a 3D scene instance index. */
export function agentIndexToSceneIndex(agentIndex: number): number {
  if (agentIndex < AGENTS.length) return agentIndex;
  if (agentIndex >= ARC_AGENT_START) {
    const arcIdx = ARC_AGENTS.findIndex(a => a.index === agentIndex);
    if (arcIdx !== -1) return AGENTS.length + arcIdx;
  }
  return -1; // not in scene
}
import { useStore } from '../../store/useStore';

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

  public async load() {
    const loader = new GLTFLoader();
    try {
      console.log('[CharacterManager] Loading character model…');
      const gltf = await loader.loadAsync('/models/character.glb');
      const model = gltf.scene;

      let skinnedMesh: THREE.SkinnedMesh | null = null;
      model.traverse((child) => {
        if ((child as any).isSkinnedMesh && !skinnedMesh) {
          skinnedMesh = child as THREE.SkinnedMesh;
        }
      });

      if (skinnedMesh) {
        this.baseGeometry = skinnedMesh.geometry;
        this.baseMaterial = skinnedMesh.material as THREE.MeshStandardMaterial;
      } else {
        model.traverse((child) => {
          if ((child as any).isMesh && !this.baseGeometry) {
            const m = child as THREE.Mesh;
            this.baseGeometry = m.geometry;
            this.baseMaterial = m.material as THREE.MeshStandardMaterial;
          }
        });
      }
    } catch (err) {
      console.error('[CharacterManager] Failed to load character model:', err);
    }

    if (!this.baseGeometry) {
      this.baseGeometry = new THREE.CapsuleGeometry(0.2, 0.6, 4, 8);
      this.baseMaterial = new THREE.MeshStandardMaterial({ color: 0x4ade80 });
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
          vx = (dx / dist) * this.speed * 4.0;
          vz = (dz / dist) * this.speed * 4.0;
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
          vx = (vx / speed) * this.speed;
          vz = (vz / speed) * this.speed;
        } else {
          vx = 0;
          vz = this.speed;
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
        // Bobbing
        this.dummy.position.y = py + Math.abs(Math.sin(localTime * 10)) * 0.1;
        this.dummy.rotation.set(0, facingAngle, Math.sin(localTime * 5) * 0.1);
      } else if (state === AgentBehavior.WAVE) {
        // Waving (jumping slightly and rotating)
        this.dummy.position.y = py + Math.abs(Math.sin(localTime * 15)) * 0.2;
        this.dummy.rotation.set(0, facingAngle + Math.sin(localTime * 10) * 0.5, 0);
      } else {
        // Idle breathing
        this.dummy.position.y = py + Math.sin(localTime * 2) * 0.02;
        this.dummy.rotation.set(0, facingAngle, 0);
      }

      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.updateBadges();
  }

  private initBadges() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧠', 64, 64);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    for (let i = 0; i < this.instanceCount; i++) {
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
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

    const activeADKAgents = useStore.getState().activeADKAgents;

    if (this.ceoLabelSprite && this.posArray) {
      const cx = this.posArray[PLAYER_INDEX * 4 + 0];
      const cy = this.posArray[PLAYER_INDEX * 4 + 1] || 0;
      const cz = this.posArray[PLAYER_INDEX * 4 + 2];
      this.ceoLabelSprite.position.set(cx, cy + 0.65, cz);
    }

    for (let i = 0; i < this.instanceCount; i++) {
      const sprite = this.badgeSprites[i];
      if (!sprite) continue;

      if (activeADKAgents.has(i)) {
        const px = this.posArray[i * 4 + 0];
        const py = this.posArray[i * 4 + 1] || 0;
        const pz = this.posArray[i * 4 + 2];

        sprite.position.set(px, py + 1.2, pz);
        sprite.scale.set(0.6, 0.6, 1);
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
    const tileSize = (this.worldSize * 2) / 9;
    const halfWorld = this.worldSize;

    const getBoardTilePos = (tileIdx: number) => {
      const t = tileIdx % NUM_BOARD_TILES;
      let tx = 0, tz = 0;
      if (t < 9) {
        tx = halfWorld - (t * tileSize);
        tz = halfWorld;
      } else if (t < 17) {
        tx = -halfWorld;
        tz = halfWorld - ((t - 8) * tileSize);
      } else if (t < 25) {
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
      const agent = i < AGENTS.length
        ? AGENTS[i]
        : (ARC_AGENTS[i - AGENTS.length] || AGENTS[0]);
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
