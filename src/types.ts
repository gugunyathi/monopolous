
export interface PerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  entities: number;
}

export interface BoidsParams {
  speed: number;
  separationRadius: number;
  separationStrength: number;
  alignmentRadius: number;
  cohesionRadius: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface SocialPost {
  id: string;
  agentIndex: number;
  type: 'post' | 'live';
  content: string;
  token?: string;
  action?: 'buy' | 'sell';
  likes: number;
  comments: SocialComment[];
  timestamp: number;
  isLive?: boolean;
}

export interface SocialComment {
  id: string;
  agentIndex: number;
  text: string;
  timestamp: number;
}

export interface BoardTile {
  id: string;
  name: string;
  type: 'property' | 'event' | 'start' | 'jail' | 'tax';
  price?: number;
  ownerIndex?: number | null;
  color?: string;
  category?: string;
}

export interface CharacterState {
  currentAction: string;
  isThinking: boolean;
  aiResponse: string;
  isDebugOpen: boolean;
  instanceCount: number;
  worldSize: number;
  boidsParams: BoidsParams;
  debugPositions: Float32Array | null;
  debugStates: Float32Array | null;    // vec4 stride: .w = AgentBehavior per instance
  activeEncounter: ActiveEncounter | null;
  selectedNpcIndex: number | null;    // NPC explicitly clicked in the scene
  selectedPosition: { x: number; y: number } | null; // Screen coordinates for selected bubble
  hoveredNpcIndex: number | null;     // NPC currently under the cursor
  hoverPosition: { x: number; y: number } | null; // Screen coordinates for hover bubble
  isChatting: boolean;
  chatMessages: ChatMessage[];
  
  // Social & Trading
  viewMode: 'world' | 'social';
  socialFeed: SocialPost[];
  activeSocialAgentIndex: number | null;
  following: Set<number>;
  tradingLog: { agentIndex: number; token: string; action: 'buy' | 'sell'; price: number; timestamp: number }[];

  // Auth
  userAddress: string | null;
  setUserAddress: (address: string | null) => void;

  // Monopoly Game State
  boardTiles: BoardTile[];
  agentBalances: Record<number, number>;
  leaderboard: { agentIndex: number; netWorth: number }[];
  
  performance: PerformanceStats;

  setAnimation: (name: string) => void;
  setThinking: (isThinking: boolean) => void;
  setAIResponse: (response: string) => void;
  toggleDebug: () => void;
  setInstanceCount: (count: number) => void;
  setWorldSize: (size: number) => void;
  setBoidsParams: (params: Partial<BoidsParams>) => void;
  setDebugPositions: (positions: Float32Array) => void;
  setDebugStates: (states: Float32Array) => void;
  setActiveEncounter: (encounter: ActiveEncounter | null) => void;
  setSelectedNpc: (index: number | null) => void;
  setSelectedPosition: (pos: { x: number; y: number } | null) => void;
  setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => void;
  startChat: (index: number) => void;
  endChat: () => void;
  sendMessage: (text: string) => Promise<void>;
  updatePerformance: (stats: PerformanceStats) => void;
  
  // Social Actions
  setViewMode: (mode: 'world' | 'social') => void;
  toggleFollow: (index: number) => void;
  addPost: (post: SocialPost) => void;
  addComment: (postId: string, comment: SocialComment) => void;
  likePost: (postId: string) => void;
  setActiveSocialAgentIndex: (index: number | null) => void;

  // Game Actions
  buyProperty: (agentIndex: number, tileId: string) => void;
  updateBalance: (agentIndex: number, amount: number) => void;
  updateLeaderboard: () => void;
}

export enum AnimationName {
  IDLE = 'Idle',
  WALK = 'Walk'
}

/** Stored as a float in the GPU agent buffer (.w component). */
export enum AgentBehavior {
  BOIDS = 0,   // follows Reynolds separation
  FROZEN = 1,  // position locked, velocity zero
  GOTO = 2,    // moves toward waypoint (.x/.z of agent buffer)
  WAVE = 3,    // position locked, performs wave animation
}

export interface ActiveEncounter {
  npcIndex: number;
  npcDepartment: string;
  npcRole: string;
  npcMission: string;
  npcPersonality: string;
}
