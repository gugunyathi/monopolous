
import * as THREE from 'three';
import { BoardTile } from '../../types';
import { AGENTS } from '../../data/agents';

export class Board {
  private group: THREE.Group;
  private tileMeshes: THREE.Mesh[] = [];

  constructor(private scene: THREE.Scene, private tiles: BoardTile[], private worldSize: number) {
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.init();
  }

  private init() {
    const tileSize = (this.worldSize * 2) / 9; // 9 tiles per side
    const halfWorld = this.worldSize;

    this.tiles.forEach((tile, index) => {
      const geometry = new THREE.PlaneGeometry(tileSize * 0.95, tileSize * 0.95);
      
      // Create canvas for label
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;

      if (tile.type === 'prediction') {
        // ── Prediction tile: purple gradient + Polymarket branding ──
        const grad = ctx.createLinearGradient(0, 0, 256, 256);
        grad.addColorStop(0, '#2e1065');
        grad.addColorStop(1, '#4a1d96');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        // Border
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 12;
        ctx.strokeRect(0, 0, 256, 256);

        // Top label
        ctx.fillStyle = '#d8b4fe';
        ctx.font = 'bold 22px Space Grotesk';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('POLYMARKET', 128, 18);

        // Central dice emoji
        ctx.font = '72px serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎯', 128, 120);

        // Topic
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 20px Space Grotesk';
        ctx.textBaseline = 'bottom';
        ctx.fillText(tile.polymarketTopic?.toUpperCase() ?? 'BETS', 128, 238);

        // YES/NO indicator strip
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(0, 248, 128, 8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(128, 248, 128, 8);
      } else {
        ctx.fillStyle = tile.color || '#ffffff';
        ctx.fillRect(0, 0, 256, 256);

        // Add border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, 256, 256);

        // Add text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 40px Space Grotesk';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.name, 128, 128);

        if (tile.price) {
          ctx.font = 'bold 30px Space Grotesk';
          ctx.fillText(`$${tile.price}`, 128, 180);
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0.2,
        transparent: true,
        opacity: 0.9
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.01; // Slightly above floor

      // Calculate position along the perimeter
      const sideCount = 8; // 8 tiles per side excluding corners
      let x = 0, z = 0;

      if (index < 9) { // Bottom side
        x = halfWorld - (index * tileSize);
        z = halfWorld;
      } else if (index < 17) { // Left side
        x = -halfWorld;
        z = halfWorld - ((index - 8) * tileSize);
      } else if (index < 25) { // Top side
        x = -halfWorld + ((index - 16) * tileSize);
        z = -halfWorld;
      } else { // Right side
        x = halfWorld;
        z = -halfWorld + ((index - 24) * tileSize);
      }

      mesh.position.x = x;
      mesh.position.z = z;

      // Add text label (simplified as a small cube for now or just color)
      if (tile.type === 'start') mesh.scale.set(1.2, 1.2, 1.2);
      
      this.group.add(mesh);
      this.tileMeshes.push(mesh);
    });
  }

  public update(tiles: BoardTile[]) {
    tiles.forEach((tile, i) => {
      if (tile.type === 'prediction') {
        // Prediction tiles glow purple
        const material = this.tileMeshes[i].material as THREE.MeshStandardMaterial;
        material.emissive.set('#7c3aed');
        material.emissiveIntensity = 0.6;
      } else if (tile.ownerIndex !== undefined && tile.ownerIndex !== null) {
        // Highlight owned properties with agent's color
        const material = this.tileMeshes[i].material as THREE.MeshStandardMaterial;
        const agent = AGENTS[tile.ownerIndex];
        if (agent) {
          material.emissive.set(agent.color);
          material.emissiveIntensity = 0.8;
        }
      }
    });
  }
}
