import * as THREE from 'three';
import { useStore } from '../../store/useStore';

export class WeatherSystem {
  private group: THREE.Group;
  private particleCount = 600;
  private particleGeometry: THREE.BufferGeometry;
  private particleMaterial: THREE.PointsMaterial;
  private points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private currentWeather: 'sun' | 'rain' | 'snow' | 'none' = 'none';

  constructor(private scene: THREE.Scene) {
    this.group = new THREE.Group();

    this.particleGeometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      this.positions[i * 3 + 0] = (Math.random() - 0.5) * 60;
      this.positions[i * 3 + 1] = Math.random() * 30;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 60;

      this.velocities[i * 3 + 0] = 0;
      this.velocities[i * 3 + 1] = -0.3;
      this.velocities[i * 3 + 2] = 0;
    }

    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.particleMaterial = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.35,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.group.add(this.points);
    this.scene.add(this.group);
  }

  public update() {
    const store = useStore.getState();
    const weather = store.weather;

    if (weather === 'none') {
      this.group.visible = false;
      this.currentWeather = weather;
      return;
    } else {
      this.group.visible = true;
    }

    if (weather !== this.currentWeather) {
      this.currentWeather = weather;
      if (weather === 'rain') {
        this.particleMaterial.color.set(0x38bdf8); // Cyan rain
        this.particleMaterial.size = 0.25;
        this.particleMaterial.opacity = 0.7;
      } else if (weather === 'snow') {
        this.particleMaterial.color.set(0x94a3b8); // Crypto winter snow
        this.particleMaterial.size = 0.55;
        this.particleMaterial.opacity = 0.9;
      } else {
        this.particleMaterial.color.set(0xfbbf24); // Sunny golden dust / boom
        this.particleMaterial.size = 0.4;
        this.particleMaterial.opacity = 0.6;
      }
    }

    const posAttr = this.particleGeometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < this.particleCount; i++) {
      let py = arr[i * 3 + 1];
      let px = arr[i * 3 + 0];
      let pz = arr[i * 3 + 2];

      if (this.currentWeather === 'rain') {
        py -= 0.75;
        px += 0.05;
        if (py < 0) {
          py = 30;
          px = (Math.random() - 0.5) * 60;
          pz = (Math.random() - 0.5) * 60;
        }
      } else if (this.currentWeather === 'snow') {
        py -= 0.12;
        px += Math.sin(Date.now() * 0.002 + i) * 0.04;
        pz += Math.cos(Date.now() * 0.002 + i) * 0.04;
        if (py < 0) {
          py = 30;
        }
      } else {
        // Sun / Bull market golden dust floating gently upward/sideways
        py += 0.03;
        px += Math.sin(Date.now() * 0.001 + i) * 0.02;
        if (py > 25) {
          py = 0;
          px = (Math.random() - 0.5) * 60;
          pz = (Math.random() - 0.5) * 60;
        }
      }

      arr[i * 3 + 0] = px;
      arr[i * 3 + 1] = py;
      arr[i * 3 + 2] = pz;
    }

    posAttr.needsUpdate = true;
  }

  public dispose() {
    this.scene.remove(this.group);
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
  }
}
