
import * as THREE from 'three';

export class Engine {
  public renderer: THREE.WebGLRenderer;
  public timer: THREE.Timer;

  constructor(container: HTMLElement) {
    // Option E: Adaptive Mobile DPR & Quality Scaler (clamp pixelRatio to max 1.75 to prevent GPU thermal throttling on mobile)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    const maxDPR = isMobile ? 1.5 : 2.0;
    const adaptivePixelRatio = Math.min(window.devicePixelRatio, maxDPR);

    this.renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(adaptivePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(this.renderer.domElement);
    this.timer = new THREE.Timer();
  }

  public async init() {
    // WebGLRenderer doesn't need async init, but we keep the signature
    return Promise.resolve();
  }

  public onResize(width: number, height: number) {
    this.renderer.setSize(width, height);
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer.render(scene, camera);
  }

  public dispose() {
    this.renderer.setAnimationLoop(null);
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }
}
