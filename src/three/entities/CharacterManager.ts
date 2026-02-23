
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  Fn,
  instanceIndex,
  storage,
  float,
  vec3,
  vec4,
  mat3,
  mat4,
  uint,
  If,
  Loop,
  uniform,
  atan,
  attribute,
  positionLocal,
  time,
  texture,
  sin,
  cos
} from 'three/tsl';
import { BoidsParams, AgentBehavior } from '../../types';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { AGENTS, PLAYER_INDEX } from '../../data/agents';
import { useStore } from '../../store/useStore';

export class CharacterManager {
  private instanceCount = 100;
  private colors = ['#7EACEA', '#f472b6', '#fb7185', '#4ade80', '#fbbf24'];

  // Compute Buffers (GPU)
  private posAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private velAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private timeOffsetAttribute: THREE.InstancedBufferAttribute | null = null;
  private colorAttribute: THREE.InstancedBufferAttribute | null = null;
  private positionStorage: any;
  private velocityStorage: any;

  // Agent state buffer (CPU+GPU): waypoint + behavior state per instance
  private agentStateBuffer: AgentStateBuffer | null = null;

  // CPU-side mirror of GPU positions (updated via GPU readback each frame)
  private debugPosArray: Float32Array | null = null;

  // Logic Nodes
  private computeNode: any;

  // Assets & Objects
  private instancedMesh: THREE.Mesh | null = null;
  private baseGeometry: THREE.BufferGeometry | null = null;
  private baseMaterial: THREE.MeshStandardMaterial | null = null;

  // Animation Data
  private bakedWalkBuffer: THREE.StorageBufferAttribute | null = null;
  private bakedIdleBuffer: THREE.StorageBufferAttribute | null = null;
  private bakedWaveBuffer: THREE.StorageBufferAttribute | null = null;
  private numWalkFrames = 0;
  private numIdleFrames = 0;
  private numWaveFrames = 0;
  private walkDuration = 0;
  private idleDuration = 0;
  private waveDuration = 0;
  private numBones = 0;

  // ADK Agent Badges — floating sprites above autonomous agents
  private badgeSprites: THREE.Sprite[] = [];

  // Uniforms
  private uSpeed = uniform(0.015);
  private uSeparationRadius = uniform(0.6);
  private uSeparationStrength = uniform(0.030);
  private uWorldSize = uniform(25.0);  // matches store default
  private worldSize = 25.0;            // matches store default

  public isLoaded = false;

  constructor(private scene: THREE.Scene) {}

  public async load() {
    const loader = new GLTFLoader();
    try {
      console.log('[CharacterManager] Loading character model…');
      const gltf = await loader.loadAsync('/models/character.glb');
      const model = gltf.scene;
      console.log('[CharacterManager] Model loaded — animations:', gltf.animations.length);

      let skinnedMesh: THREE.SkinnedMesh | null = null;
      model.traverse((child) => {
        if ((child as any).isSkinnedMesh && !skinnedMesh) {
          skinnedMesh = child as THREE.SkinnedMesh;
        }
      });

      if (skinnedMesh) {
        console.log('[CharacterManager] SkinnedMesh found');
        this.baseGeometry = skinnedMesh.geometry;
        this.baseMaterial = skinnedMesh.material as THREE.MeshStandardMaterial;

        const clips = gltf.animations;
        if (clips.length > 0) {
          try {
            // Map animations by name if possible, or by index as safe fallback
            const idleClip = clips.find(c => c.name.toLowerCase().includes('idle')) || clips[0];
            const walkClip = clips.find(c => c.name.toLowerCase().includes('walk')) || clips[Math.min(1, clips.length - 1)];
            const waveClip = clips.find(c => c.name.toLowerCase().includes('wave')) || clips[Math.min(2, clips.length - 1)] || clips[0];

            const walkData = this.bakeAnimation(skinnedMesh, walkClip, model);
            this.bakedWalkBuffer = walkData.buffer;
            this.numWalkFrames = walkData.numFrames;
            this.walkDuration = walkData.duration;
            this.numBones = walkData.numBones;

            const idleData = this.bakeAnimation(skinnedMesh, idleClip, model);
            this.bakedIdleBuffer = idleData.buffer;
            this.numIdleFrames = idleData.numFrames;
            this.idleDuration = idleData.duration;

            const waveData = this.bakeAnimation(skinnedMesh, waveClip, model);
            this.bakedWaveBuffer = waveData.buffer;
            this.numWaveFrames = waveData.numFrames;
            this.waveDuration = waveData.duration;

            console.log('[CharacterManager] Animations baked — walk:', this.numWalkFrames, 'idle:', this.numIdleFrames, 'wave:', this.numWaveFrames, 'bones:', this.numBones);
          } catch (animErr) {
            console.warn('[CharacterManager] Animation baking failed, using static mesh:', animErr);
          }
        } else {
          console.warn('[CharacterManager] No animation clips in model');
        }
      } else {
        console.warn('[CharacterManager] No SkinnedMesh — looking for any mesh…');
        model.traverse((child) => {
          if ((child as any).isMesh && !this.baseGeometry) {
            const m = child as THREE.Mesh;
            this.baseGeometry = m.geometry;
            this.baseMaterial = m.material as THREE.MeshStandardMaterial;
            console.log('[CharacterManager] Using non-skinned mesh fallback');
          }
        });
      }
    } catch (err) {
      console.error('[CharacterManager] Failed to load character model:', err);
    }

    // ── FALLBACK: if no geometry was obtained, create simple capsules ──
    if (!this.baseGeometry) {
      console.warn('[CharacterManager] Using fallback CapsuleGeometry');
      this.baseGeometry = new THREE.CapsuleGeometry(0.2, 0.6, 4, 8);
      this.baseMaterial = new THREE.MeshStandardMaterial({ color: 0x4ade80 });
    }

    // Always create instances — agents must be visible regardless of model quality
    this.initInstances();
    this.isLoaded = true;
    this.initBadges();
    console.log('[CharacterManager] Ready — instances:', this.instanceCount,
      'hasAnimations:', !!(this.bakedWalkBuffer && this.bakedIdleBuffer && this.bakedWaveBuffer));
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
    this.uSpeed.value = params.speed;
    this.uSeparationRadius.value = params.separationRadius;
    this.uSeparationStrength.value = params.separationStrength;
  }

  public updateWorldSize(size: number) {
    const changed = this.worldSize !== size;
    this.uWorldSize.value = size;
    this.worldSize = size;
    // Reinitialize spawn positions if already loaded and the world size changed
    if (changed && this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }

  /**
   * Reads back the GPU position buffer to CPU.
   * Must be called after renderer.compute() each frame.
   * Returns the updated positions (1-frame GPU lag).
   */
  public async syncFromGPU(renderer: any): Promise<Float32Array | null> {
    if (!this.posAttribute) return null;
    try {
      const buffer = await renderer.getArrayBufferAsync(this.posAttribute);
      this.debugPosArray = new Float32Array(buffer);
    } catch {
      // WebGPU readback not available – fall back to stale data
    }
    return this.debugPosArray;
  }

  private _firstUpdate = true;
  public update(delta: number, renderer: any) {
    if (this.computeNode) {
      try {
        renderer.compute(this.computeNode);
        if (this._firstUpdate) {
          console.log('[CharacterManager] First compute dispatch OK');
          this._firstUpdate = false;
        }
      } catch (err) {
        if (this._firstUpdate) {
          console.error('[CharacterManager] Compute failed:', err);
          this._firstUpdate = false;
        }
      }
    } else if (this._firstUpdate) {
      console.warn('[CharacterManager] update() called but no computeNode');
      this._firstUpdate = false;
    }

    // Update badge positions for ADK agents
    this.updateBadges();
  }

  /**
   * Create floating sprite badges for all agents.
   * Initially all badges are hidden (scale 0).
   */
  private initBadges() {
    // Create a canvas texture for the brain emoji badge
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#8b5cf6'; // violet background
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

    // Create sprite for each agent
    for (let i = 0; i < this.instanceCount; i++) {
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(0, 0, 1); // hidden by default
      sprite.renderOrder = 1000; // render on top
      this.scene.add(sprite);
      this.badgeSprites.push(sprite);
    }

    console.log('[CharacterManager] Created', this.badgeSprites.length, 'ADK badge sprites');
  }

  /**
   * Update badge positions to follow ADK agents.
   * Badges float 1.2 units above the agent's head.
   */
  private updateBadges() {
    if (!this.debugPosArray || this.badgeSprites.length === 0) return;

    const activeADKAgents = useStore.getState().activeADKAgents;

    for (let i = 0; i < this.instanceCount; i++) {
      const sprite = this.badgeSprites[i];
      if (!sprite) continue;

      if (activeADKAgents.has(i)) {
        // Show badge — position it above the agent
        const px = this.debugPosArray[i * 4 + 0];
        const py = this.debugPosArray[i * 4 + 1] || 0;
        const pz = this.debugPosArray[i * 4 + 2];

        sprite.position.set(px, py + 1.2, pz);
        sprite.scale.set(0.6, 0.6, 1); // visible size
      } else {
        // Hide badge
        sprite.scale.set(0, 0, 1);
      }
    }
  }

  private cleanupInstances() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh = null;
    }
    this.computeNode = null;

    // Clean up badges
    for (const sprite of this.badgeSprites) {
      this.scene.remove(sprite);
      sprite.material.dispose();
      if (sprite.material.map) sprite.material.map.dispose();
    }
    this.badgeSprites = [];
  }

  private initInstances() {
    if (!this.baseGeometry || !this.baseMaterial) {
      console.error('[CharacterManager] initInstances called without geometry/material');
      return;
    }
    console.log('[CharacterManager] initInstances — count:', this.instanceCount, 'worldSize:', this.worldSize);

    const posArray = new Float32Array(this.instanceCount * 4);
    const velArray = new Float32Array(this.instanceCount * 4);
    const timeOffsetArray = new Float32Array(this.instanceCount);
    const colorArray = new Float32Array(this.instanceCount * 3);

    const tempColor = new THREE.Color();

    // Board perimeter tile positions — same formula as BehaviorManager.getTilePosition
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

    // Deterministic pseudo-random matching BehaviorManager jitter
    const seededRand = (seed: number) => {
      const x = Math.sin(seed + 1) * 43758.5453123;
      return x - Math.floor(x);
    };

    for (let i = 0; i < this.instanceCount; i++) {
      const agent = AGENTS[i] || AGENTS[0];
      tempColor.set(agent.color);

      if (i === PLAYER_INDEX) {
        // Player starts at GENESIS tile (tile 0 — top-right corner)
        const genesis = getBoardTilePos(0);
        posArray[i * 4 + 0] = genesis.x;
        posArray[i * 4 + 2] = genesis.z;
        posArray[i * 4 + 3] = 1;
      } else {
        // Distribute NPCs evenly around the board perimeter tiles
        const startTile = (i - 1) % NUM_BOARD_TILES;
        const tilePos = getBoardTilePos(startTile);
        // Jitter only along the edge so agents stay on the board perimeter
        const isHorizontalEdge = startTile < 9 || (startTile >= 17 && startTile < 25);
        const jitter = (seededRand(i * 3 + 1) - 0.5) * tileSize * 0.35;
        posArray[i * 4 + 0] = tilePos.x + (isHorizontalEdge ? jitter : 0);
        posArray[i * 4 + 2] = tilePos.z + (isHorizontalEdge ? 0 : jitter);
        posArray[i * 4 + 3] = 1;
        // Small initial velocity along the board edge
        velArray[i * 4 + 0] = (isHorizontalEdge ? -0.01 : 0);
        velArray[i * 4 + 2] = (isHorizontalEdge ? 0 : -0.01);

        // Adjust color based on risk level
        if (agent.riskLevel === 'Degen') {
          tempColor.multiplyScalar(1.5); // Brighter
        } else if (agent.riskLevel === 'Low') {
          tempColor.lerp(new THREE.Color('#ffffff'), 0.3); // More washed out/professional
        }
      }

      timeOffsetArray[i] = Math.random() * 10;
      colorArray[i * 3 + 0] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    }

    this.debugPosArray = new Float32Array(posArray);

    this.posAttribute = new THREE.StorageInstancedBufferAttribute(posArray, 4);
    this.velAttribute = new THREE.StorageInstancedBufferAttribute(velArray, 4);
    this.timeOffsetAttribute = new THREE.InstancedBufferAttribute(timeOffsetArray, 1);
    this.colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);

    this.positionStorage = storage(this.posAttribute, 'vec4', this.instanceCount);
    this.velocityStorage = storage(this.velAttribute, 'vec4', this.instanceCount);

    // Agent state buffer — player starts FROZEN, NPCs start FROZEN (safe default).
    // BehaviorManager will override to GOTO once it is constructed, but this
    // ensures the very first GPU frame doesn't scatter agents via BOIDS.
    this.agentStateBuffer = new AgentStateBuffer(this.instanceCount);
    this.agentStateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
    for (let i = 1; i < this.instanceCount; i++) {
      // Pre-set each NPC's waypoint to its spawn position so GOTO works immediately
      const startTile = (i - 1) % NUM_BOARD_TILES;
      const tp = getBoardTilePos(startTile);
      const isH = startTile < 9 || (startTile >= 17 && startTile < 25);
      const j = (seededRand(i * 3 + 1) - 0.5) * tileSize * 0.35;
      this.agentStateBuffer.setWaypoint(i, tp.x + (isH ? j : 0), tp.z + (isH ? 0 : j));
      this.agentStateBuffer.setState(i, AgentBehavior.GOTO);
    }

    this.initComputeNode();
    this.createInstancedMesh();
    console.log('[CharacterManager] initInstances complete — mesh added to scene:', !!this.instancedMesh);
  }

  private initComputeNode() {
    const agentStorage = this.agentStateBuffer!.storageNode;

    this.computeNode = Fn(() => {
      const index = instanceIndex;

      const posElement = this.positionStorage.element(index);
      const velElement = this.velocityStorage.element(index);
      const agentData  = agentStorage.element(index);   // vec4: (wpX, 0, wpZ, state)
      const agentState = agentData.w;                   // float: 0=BOIDS 1=FROZEN 2=GOTO

      const pos = posElement.xyz.toVar();

      // ── FROZEN/WAVE (state ≈ 1 or 3) ─────────────
      If(agentState.greaterThan(float(0.5)), () => {

        // ── GOTO (state ≈ 2, > 1.5 and < 2.5) ───────────────────────────
        If(agentState.greaterThan(float(1.5)).and(agentState.lessThan(float(2.5))), () => {
          const waypointXZ = vec3(agentData.x, float(0), agentData.z);
          const toTarget = waypointXZ.sub(pos);
          const dist = toTarget.length();
          If(dist.greaterThan(float(0.2)), () => {
            const gotoVel = toTarget.normalize().mul(this.uSpeed.mul(4.0));
            velElement.assign(vec4(gotoVel, 0.0));
            posElement.assign(vec4(pos.add(gotoVel), 1.0));
          }).Else(() => {
            posElement.assign(vec4(pos, 1.0));
          });

        }).Else(() => {
          // FROZEN (1) or WAVE (3) — hold position, use agentData.xz as facing direction if non-zero
          const facing = vec3(agentData.x, float(0), agentData.z);
          If(facing.length().greaterThan(float(0.001)), () => {
            velElement.assign(vec4(facing, 0.0));
          });
          posElement.assign(vec4(pos, 1.0));
        });

      }).Else(() => {
        // ── BOIDS (state ≈ 0) ──────────────────────────────────
        const vel   = velElement.xyz.toVar();
        const accel = vec3(0).toVar();

        // World boundary (square)
        const halfSize = this.uWorldSize;
        If(pos.x.abs().greaterThan(halfSize).or(pos.z.abs().greaterThan(halfSize)), () => {
          accel.addAssign(pos.negate().normalize().mul(0.01));
        });

        // Separation
        Loop({ start: uint(0), end: uint(this.instanceCount), type: 'uint' }, ({ i }) => {
          const otherPos = this.positionStorage.element(i).xyz;
          const diff = pos.sub(otherPos);
          const dist = diff.length();
          If(dist.lessThan(this.uSeparationRadius).and(dist.greaterThan(0.01)), () => {
            accel.addAssign(diff.normalize().mul(this.uSeparationStrength));
          });
        });

        const newVel = vel.add(accel).toVar();
        const speed  = newVel.length();
        If(speed.greaterThan(0.001), () => {
          newVel.assign(newVel.normalize().mul(this.uSpeed));
        }).Else(() => {
          newVel.assign(vec3(0, 0, this.uSpeed));
        });

        velElement.assign(vec4(newVel, 0.0));
        posElement.assign(vec4(pos.add(newVel), 1.0));
      });

    })().compute(this.instanceCount);
  }

  private createInstancedMesh() {
    const instancedGeometry = new THREE.InstancedBufferGeometry();
    instancedGeometry.copy(this.baseGeometry as any);
    instancedGeometry.instanceCount = this.instanceCount;

    // Solo dejamos el atributo que NO se calcula en el Compute Shader
    if (this.timeOffsetAttribute) instancedGeometry.setAttribute('instanceTimeOffset', this.timeOffsetAttribute);
    if (this.colorAttribute) instancedGeometry.setAttribute('instanceColor', this.colorAttribute);

    const material = new THREE.MeshStandardNodeMaterial();
    material.roughness = 1;
    material.metalness = 0.25;

    const map = (this.baseMaterial as any).map;
    const instanceColor = attribute('instanceColor', 'vec3');

    if (map) {
      const texColor = texture(map);
      material.colorNode = vec4(texColor.rgb.mul(instanceColor), texColor.a);
    } else {
      material.colorNode = vec4(instanceColor, 1.0);
    }

    material.positionNode = this.createVertexNode();

    this.instancedMesh = new THREE.Mesh(instancedGeometry, material);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;
    this.scene.add(this.instancedMesh);
    console.log('[CharacterManager] Instanced mesh added — vertices:', instancedGeometry.getAttribute('position')?.count, 'instanceCount:', instancedGeometry.instanceCount);
  }

  private createVertexNode() {
    return Fn(() => {
      const instancePos = this.positionStorage.element(instanceIndex).xyz;
      const rawVel = this.velocityStorage.element(instanceIndex).xyz;
      const timeOffset = attribute('instanceTimeOffset');

      // When velocity is zero (FROZEN/GOTO-arrived) atan(0,0) = NaN breaks the mesh.
      // Fall back to facing +Z so the rotation matrix is always valid.
      const isMoving = rawVel.length().greaterThan(float(0.001));
      const safeVel = vec3(0, 0, 1).toVar();
      If(isMoving, () => { safeVel.assign(rawVel); });

      const angle = atan(safeVel.z, safeVel.x).negate().add(float(Math.PI / 2));
      const rotationMat = mat3(
        vec3(cos(angle), float(0), sin(angle).negate()),
        vec3(float(0), float(1), float(0)),
        vec3(sin(angle), float(0), cos(angle))
      );

      const finalPosition = positionLocal.toVar();

      if (this.bakedWalkBuffer && this.bakedIdleBuffer && this.bakedWaveBuffer) {
        const walkBuffer = storage(this.bakedWalkBuffer, 'mat4', this.numWalkFrames * this.numBones);
        const idleBuffer = storage(this.bakedIdleBuffer, 'mat4', this.numIdleFrames * this.numBones);
        const waveBuffer = storage(this.bakedWaveBuffer, 'mat4', this.numWaveFrames * this.numBones);
        const agentState = this.agentStateBuffer!.storageNode.element(instanceIndex).w;

        const skinIndex = attribute('skinIndex');
        const skinWeight = attribute('skinWeight');
        const skinMat = mat4(0).toVar();

        // Animation selection:
        // 0 = BOIDS (Walk)
        // 1 = FROZEN (Idle)
        // 2 = GOTO (Walk)
        // 3 = WAVE (Wave)
        const isIdle = agentState.greaterThan(float(0.5)).and(agentState.lessThan(float(1.5)));
        const isWave = agentState.greaterThan(float(2.5));

        const buildSkinMat = (animBuf: any, numFrames: number, duration: number) => {
          const animTime = time.add(timeOffset);
          const t = animTime.div(float(duration)).fract();
          const currentFrame = t.mul(float(numFrames)).toInt();
          const safeFrame = currentFrame.min(uint(numFrames - 1));
          const addInfluence = (boneIdxNode: any, weightNode: any) => {
            If(weightNode.greaterThan(0), () => {
              const address = safeFrame.mul(uint(this.numBones)).add(boneIdxNode.toInt());
              skinMat.addAssign(animBuf.element(address).mul(weightNode));
            });
          };
          addInfluence(skinIndex.x, skinWeight.x);
          addInfluence(skinIndex.y, skinWeight.y);
          addInfluence(skinIndex.z, skinWeight.z);
          addInfluence(skinIndex.w, skinWeight.w);
        };

        If(isIdle, () => {
          buildSkinMat(idleBuffer, this.numIdleFrames, this.idleDuration);
        }).ElseIf(isWave, () => {
          buildSkinMat(waveBuffer, this.numWaveFrames, this.waveDuration);
        }).Else(() => {
          buildSkinMat(walkBuffer, this.numWalkFrames, this.walkDuration);
        });

        finalPosition.assign(skinMat.mul(vec4(positionLocal, 1.0)).xyz);
      }

      return rotationMat.mul(finalPosition).add(instancePos);
    })();
  }

  private bakeAnimation(mesh: THREE.SkinnedMesh, clip: THREE.AnimationClip, root: THREE.Object3D) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const skeleton = mesh.skeleton;
    const duration = clip.duration;
    const numFrames = Math.ceil(duration * 60);
    const numBones = skeleton.bones.length;
    const data = new Float32Array(numFrames * numBones * 16);
    for (let f = 0; f < numFrames; f++) {
      mixer.setTime((f / numFrames) * duration);
      root.updateMatrixWorld(true);
      skeleton.update();
      for (let b = 0; b < numBones; b++) {
        const i = (f * numBones + b) * 16;
        for (let k = 0; k < 16; k++) data[i + k] = skeleton.boneMatrices[b * 16 + k];
      }
    }
    return {
      buffer: new THREE.StorageBufferAttribute(data, 16),
      numFrames,
      numBones,
      duration,
    };
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

  /** Exposes the agent state buffer so BehaviorManager can read/write states. */
  public getAgentStateBuffer(): AgentStateBuffer | null {
    return this.agentStateBuffer;
  }

  /** Returns the current CPU-tracked positions buffer (vec4 stride). Updated each simulateOnCPU call. */
  public getCPUPositions(): Float32Array | null {
    return this.debugPosArray;
  }

  /** Returns the world position of a single character from the CPU buffer. */
  public getCPUPosition(index: number): THREE.Vector3 | null {
    if (!this.debugPosArray || index < 0 || index >= this.instanceCount) return null;
    const i = index * 4;
    return new THREE.Vector3(this.debugPosArray[i], this.debugPosArray[i + 1], this.debugPosArray[i + 2]);
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
