import * as THREE from 'three';
import { BoardTile } from '../../types';
import { AGENTS } from '../../data/agents';
import { useStore } from '../../store/useStore';
import { getExchangeBranding } from '../utils/exchangeLogoMapper';

export class Board {
  private group: THREE.Group;
  private tileMeshes: THREE.Mesh[] = [];
  private skyscraperMeshes: (THREE.Mesh | null)[] = [];

  constructor(private scene: THREE.Scene, private tiles: BoardTile[], private worldSize: number) {
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.init();
  }

  private init() {
    const tileSize = (this.worldSize * 2) / 8; // 8 tiles per side for 32 total tiles
    const halfWorld = this.worldSize;
    const isMobile = useStore.getState().mobileOptimizationMode || (typeof window !== 'undefined' && window.innerWidth < 768);
    const res = isMobile ? 256 : 512;

    this.tiles.forEach((tile, index) => {
      // Elevated 3D Box Geometry for gorgeous architectural district tiles
      const geometry = new THREE.BoxGeometry(tileSize * 0.92, 0.22, tileSize * 0.92);
      
      // Create canvas for tile texture (reduced resolution on mobile for GPU performance)
      const canvas = document.createElement('canvas');
      canvas.width = res;
      canvas.height = res;
      const ctx = canvas.getContext('2d')!;

      if (tile.type === 'prediction') {
        // ── Prediction tile: deep cyberpunk purple gradient + Polymarket / Kalshi branding ──
        const grad = ctx.createLinearGradient(0, 0, res, res);
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(1, '#581c87');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, res, res);

        // Neon Border
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = isMobile ? 8 : 16;
        ctx.strokeRect(0, 0, res, res);

        // Top banner
        ctx.fillStyle = '#f3e8ff';
        ctx.font = `bold ${isMobile ? 18 : 36}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('PREDICTION MARKET', res / 2, isMobile ? 16 : 32);

        // Central target / prediction icon
        ctx.font = `${isMobile ? 50 : 100}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText('🎯', res / 2, res / 2);

        // Topic subtitle
        ctx.fillStyle = '#e9d5ff';
        ctx.font = `bold ${isMobile ? 16 : 32}px sans-serif`;
        ctx.textBaseline = 'bottom';
        ctx.fillText(tile.name.toUpperCase(), res / 2, res - (isMobile ? 20 : 42));

        // Probability indicator bar
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(0, res - (isMobile ? 10 : 20), res / 2, isMobile ? 10 : 20);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(res / 2, res - (isMobile ? 10 : 20), res / 2, isMobile ? 10 : 20);
      } else {
        // District tile / Exchange Branding
        const branding = getExchangeBranding(tile);
        
        // Background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, res, res);
        bgGrad.addColorStop(0, branding.primaryColor);
        bgGrad.addColorStop(1, branding.secondaryColor);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, res, res);

        // Dark outer border
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = isMobile ? 7 : 14;
        ctx.strokeRect(0, 0, res, res);

        // Header color strip for category badge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, res, isMobile ? 55 : 110);

        // Category / Ticker Sub-badge
        ctx.fillStyle = branding.primaryColor;
        ctx.font = `bold ${isMobile ? 12 : 24}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`[ ${branding.ticker} ] ${branding.badgeText}`, res / 2, isMobile ? 6 : 14);

        // Tile Name
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${isMobile ? 20 : 38}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(branding.name, res / 2, isMobile ? 36 : 72);

        // Exchange Logo / Insignia Symbol
        ctx.font = `${isMobile ? 48 : 96}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(branding.iconSymbol, res / 2, res / 2 + 10);

        // Price or Volume footer tag
        if (tile.price) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(0, res - (isMobile ? 40 : 80), res, isMobile ? 40 : 80);

          ctx.fillStyle = '#38bdf8';
          ctx.font = `bold ${isMobile ? 22 : 44}px sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.fillText(`$${tile.price} VAL`, res / 2, res - (isMobile ? 20 : 40));
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.generateMipmaps = !isMobile;
      texture.minFilter = isMobile ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;

      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: isMobile ? 0.5 : 0.35,
        metalness: isMobile ? 0.05 : 0.15,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.11; // Lifted above floor
      mesh.castShadow = !isMobile;
      mesh.receiveShadow = true;

      // Calculate position along perimeter (32 tiles, 8 per side)
      let x = 0, z = 0;
      if (index < 8) { // Bottom side
        x = halfWorld - (index * tileSize);
        z = halfWorld;
      } else if (index < 16) { // Left side
        x = -halfWorld;
        z = halfWorld - ((index - 8) * tileSize);
      } else if (index < 24) { // Top side
        x = -halfWorld + ((index - 16) * tileSize);
        z = -halfWorld;
      } else { // Right side
        x = halfWorld;
        z = -halfWorld + ((index - 24) * tileSize);
      }

      mesh.position.x = x;
      mesh.position.z = z;

      if (tile.type === 'start') {
        mesh.scale.set(1.15, 1.3, 1.15);
      }

      this.group.add(mesh);
      this.tileMeshes.push(mesh);

      // Skyscraper mesh for profitable property floors
      if (tile.type === 'property') {
        const skyscraperGeo = new THREE.BoxGeometry(tileSize * 0.65, 1, tileSize * 0.65);
        const skyscraperMat = new THREE.MeshStandardMaterial({
          color: '#0ea5e9',
          emissive: '#22d3ee',
          emissiveIntensity: 0.6,
          roughness: 0.2,
          metalness: 0.8,
        });
        const skyscraperMesh = new THREE.Mesh(skyscraperGeo, skyscraperMat);
        skyscraperMesh.position.set(x, 0.5, z);
        skyscraperMesh.visible = (tile.floors || 0) > 0;
        if ((tile.floors || 0) > 0) {
          skyscraperMesh.scale.y = (tile.floors || 1) * 0.8;
          skyscraperMesh.position.y = 0.22 + (skyscraperMesh.scale.y / 2);
        }
        this.group.add(skyscraperMesh);
        this.skyscraperMeshes.push(skyscraperMesh);
      } else {
        this.skyscraperMeshes.push(null);
      }
    });
  }

  public update(tiles: BoardTile[], isHeatmapMode: boolean = false) {
    const time = Date.now() * 0.003;
    tiles.forEach((tile, i) => {
      const mesh = this.tileMeshes[i];
      if (!mesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;

      // Update Skyscraper heights & profitability glowing highlight feedback
      const skyscraper = this.skyscraperMeshes[i];
      if (skyscraper) {
        const floors = tile.floors || 0;
        if (floors > 0) {
          skyscraper.visible = true;
          const targetHeight = floors * 0.8;
          // Smooth upward scaling animation towards target height
          skyscraper.scale.y += (targetHeight - skyscraper.scale.y) * 0.1;
          skyscraper.position.y = 0.22 + (skyscraper.scale.y / 2);

          // Glowing profitability pulse highlight
          const skMat = skyscraper.material as THREE.MeshStandardMaterial;
          const pulse = Math.sin(time * 4 + i) * 0.4 + 0.8;
          skMat.emissiveIntensity = pulse;
        } else {
          skyscraper.visible = false;
        }
      }

      if (isHeatmapMode) {
        const score = tile.volumeScore ?? 50;
        if (score >= 85) {
          material.emissive.set('#ff3b30'); // Fiery Red
          material.emissiveIntensity = 1.2;
        } else if (score >= 65) {
          material.emissive.set('#f59e0b'); // Amber
          material.emissiveIntensity = 0.9;
        } else {
          material.emissive.set('#06b6d4'); // Cyan
          material.emissiveIntensity = 0.5;
        }
      } else {
        if (tile.type === 'prediction') {
          material.emissive.set('#9333ea');
          material.emissiveIntensity = 0.5;
        } else if (tile.ownerIndex !== undefined && tile.ownerIndex !== null) {
          const agent = AGENTS[tile.ownerIndex];
          if (agent) {
            material.emissive.set(agent.color);
            material.emissiveIntensity = 0.7;
          }
        } else {
          material.emissive.set('#000000');
          material.emissiveIntensity = 0;
        }
      }
    });
  }
}

