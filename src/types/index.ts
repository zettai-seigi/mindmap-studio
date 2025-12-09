// ============================================
// Core Types for Mind Map Studio
// ============================================

export type StructureType =
  | 'mindmap'      // Classic radial structure
  | 'logic'        // Linear flow (left-to-right)
  | 'brace'        // Mathematical grouping with braces
  | 'orgchart'     // Hierarchical top-down
  | 'fishbone'     // Cause-and-effect (Ishikawa)
  | 'timeline'     // Chronological
  | 'matrix'       // Two-dimensional table
  | 'tree'         // Tree chart
  | 'treetable'    // Spreadsheet-like
  | 'grid';        // Block-based layout

export type NodeShape =
  | 'rectangle'
  | 'rounded'
  | 'ellipse'
  | 'diamond'
  | 'parallelogram'
  | 'cloud'
  | 'capsule'
  | 'hexagon'
  | 'underline'
  | 'none';

export type LineStyle =
  | 'straight'
  | 'curved'
  | 'angular'
  | 'tapered'
  | 'dashed';

export type BranchDirection =
  | 'right'
  | 'left'
  | 'both'
  | 'up'
  | 'down';

// ============================================
// Marker System
// ============================================

export interface Marker {
  id: string;
  category: 'priority' | 'progress' | 'flag' | 'star' | 'face' | 'arrow' | 'symbol' | 'month' | 'week' | 'people' | 'clipart' | 'custom';
  value: string;
  color?: string;
}

export interface Label {
  id: string;
  text: string;
  color: string;
}

// ============================================
// Node/Topic Types
// ============================================

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface NodeStyle {
  shape: NodeShape;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  padding: number;
  shadow: boolean;
  opacity: number;
}

export interface LineStyleConfig {
  style: LineStyle;
  color: string;
  width: number;
}

export interface MindMapNode {
  id: string;
  text: string;
  children: MindMapNode[];

  // Position (for floating topics or manual positioning)
  position?: Position;
  size?: Size;

  // Structure
  structure?: StructureType;
  direction?: BranchDirection;
  collapsed?: boolean;

  // Styling
  style?: Partial<NodeStyle>;
  lineStyle?: Partial<LineStyleConfig>;

  // Content enrichment
  markers: Marker[];
  labels: Label[];
  notes?: string;
  comments?: Comment[];
  hyperlink?: {
    type: 'web' | 'topic' | 'file';
    url: string;
  };
  attachments?: Attachment[];
  audioNote?: string;
  latex?: string;

  // Metadata
  createdAt: number;
  updatedAt: number;

  // Task management
  task?: TaskInfo;

  // Floating topic (not connected to tree)
  isFloating?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  data: string; // Base64 encoded
  size: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  updatedAt?: number;
}

export interface TaskInfo {
  progress: number; // 0-100
  priority: number; // 1-9
  assignee?: string;
  startDate?: number;
  duration?: number; // In days
  endDate?: number;
  completed: boolean;
  isCheckpoint?: boolean;
  dependencies?: string[]; // Node IDs (predecessors)
}

// ============================================
// Relationships & Visual Elements
// ============================================

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  labelOffset?: Position; // Offset from the curve midpoint for draggable label
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
  curvature: number;
  startArrow: boolean;
  endArrow: boolean;
  // Bezier control points (relative offsets from midpoint)
  controlPoint1?: Position;
  controlPoint2?: Position;
}

export interface Boundary {
  id: string;
  nodeIds: string[];
  label?: string;
  shape: 'rectangle' | 'rounded' | 'cloud' | 'wave';
  color: string;
  backgroundColor: string;
  opacity: number;
}

export interface Summary {
  id: string;
  nodeIds: string[];
  summaryNodeId: string;
  position: 'right' | 'left' | 'top' | 'bottom';
}

export interface FloatingClipart {
  id: string;
  icon: string;
  clipartId: string;
  position: Position;
  size?: number;
}

// ============================================
// Document/Map Types
// ============================================

export interface MapTheme {
  id: string;
  name: string;
  colors: {
    background: string;
    rootNode: string;
    branches: string[];
    text: string;
    lines: string;
  };
  handDrawn: boolean;
  rainbowBranches: boolean;
}

export interface MindMap {
  id: string;
  name: string;
  root: MindMapNode;
  floatingTopics: MindMapNode[];
  floatingCliparts: FloatingClipart[];
  relationships: Relationship[];
  boundaries: Boundary[];
  summaries: Summary[];

  // Visual settings
  theme: MapTheme;
  structure: StructureType;

  // View state
  zoom: number;
  panX: number;
  panY: number;

  // Metadata
  createdAt: number;
  updatedAt: number;
  author?: string;
  version: string;
}

// ============================================
// Canvas/Rendering Types
// ============================================

export interface RenderedNode {
  node: MindMapNode;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  level: number;
  parent?: RenderedNode;
  children: RenderedNode[];
}

export interface CanvasState {
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  editingNodeId: string | null;
  draggingNodeId: string | null;
  dragOffset: Position | null;
  selectionBox: { start: Position; end: Position } | null;
  selectedRelationshipId: string | null;
  linkMode: {
    active: boolean;
    sourceId: string | null;
  };
}

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  viewMode: 'normal' | 'zen' | 'pitch' | 'outliner' | 'gantt';
  showBranch: string | null; // For "Show Branch Only" feature
}

// ============================================
// AI Integration Types
// ============================================

export interface AIProvider {
  type: 'ollama' | 'openai' | 'anthropic';
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface AIRequest {
  action: 'expand' | 'brainstorm' | 'criticize' | 'summarize' | 'text-to-map';
  context: string;
  nodeId?: string;
}

export interface AIResponse {
  suggestions: string[];
  structuredMap?: MindMapNode;
}

// ============================================
// File Types
// ============================================

export type ImportFormat =
  | 'xmind'
  | 'freemind'
  | 'mindmanager'
  | 'markdown'
  | 'opml'
  | 'textbundle'
  | 'docx';

export type ExportFormat =
  | 'xmind'
  | 'png'
  | 'svg'
  | 'pdf'
  | 'markdown'
  | 'opml'
  | 'docx'
  | 'pptx'
  | 'xlsx';
