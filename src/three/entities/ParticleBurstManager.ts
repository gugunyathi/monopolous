import * as THREE from 'three';

interface BurstEffect {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  positions: Float32Array;
  velocities: Float32Array;
  life: number;
  maxLife: number;
}

export class ParticleBurstManager {
  private bursts: BurstEffect[] = [];

  constructor(private scene: THREE.Scene) {}

  public spawnBurst(x: number, y: number, z: number, type: 'trade' | 'property') {
    const particleCount = type === 'property' ? 45 : 25;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y + 0.5;
      positions[i * 3 + 2] = z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 0.08 + Math.random() * 0.15;

      velocities[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = (Math.cos(phi) * speed) + 0.05; // Upward bias
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const color = type === 'property' ? 0x10b981 : 0xfbbf24; // Emerald for property, Gold for trade
    const material = new THREE.PointsMaterial({
      color: color,
      size: type === 'property' ? 0.45 : 0.35,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.bursts.push({
      points,
      geometry,
      material,
      positions,
      velocities,
      life: 0,
      maxLife: 45 // frames (~0.75s at 60fps)
    });
  }

  public update() {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.life++;

      const posAttr = burst.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const progress = burst.life / burst.maxLife;

      for (let p = 0; p < arr.length / 3; p++) {
        arr[p * 3 + 0] += burst.velocities[p * 3 + 0];
        arr[p * 3 + 1] += burst.velocities[p * 3 + 1];
        arr[p * 3 + 2] += burst.velocities[p * 3 + 2];
        // gravity dampening
        burst.velocities[p * 3 + 1] -= 0.004;
      }

      posAttr.needsUpdate = true;
      burst.material.opacity = 1.0 - progress;

      if (burst.life >= burst.maxLife) {
        this.scene.remove(burst.points);
        burst.geometry.dispose();
        burst.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  public dispose() {
    for (const burst of this.bursts) {
      this.scene.remove(burst.points);
      burst.geometry.dispose();
      burst.material.dispose();
    }
    this.bursts = [];
  }
}
