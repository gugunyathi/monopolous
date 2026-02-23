/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


import React, { useEffect, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { SceneManager } from './three/SceneManager';
import UIOverlay from './components/UIOverlay';
import { startBroadcastScheduler, stopBroadcastScheduler } from './services/broadcastService';
import { startPostScheduler, stopPostScheduler } from './services/postGeneratorService';
import { startWalletSimulator, stopWalletSimulator } from './services/walletSimulatorService';
import { startADKOrchestrator, stopADKOrchestrator } from './services/adk/orchestrator';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager | null>(null);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  useEffect(() => {
    if (canvasRef.current && !managerRef.current) {
      managerRef.current = new SceneManager(canvasRef.current);
    }
    startBroadcastScheduler();
    startPostScheduler();
    startWalletSimulator();
    startADKOrchestrator();

    return () => {
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
      stopBroadcastScheduler();
      stopPostScheduler();
      stopWalletSimulator();
      stopADKOrchestrator();
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-white overflow-hidden" style={{ height: '100dvh' }}>
      {/* Three.js Container */}
      <div ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* UI Layer */}
      <UIOverlay />
    </div>
  );
};

export default App;
