import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type {
  MindMap,
  MindMapNode,
  CanvasState,
  ViewState,
  Relationship,
  Boundary,
  MapTheme,
  StructureType,
  Marker,
  Label,
  Position,
} from '../types';

// Default theme
const defaultTheme: MapTheme = {
  id: 'default',
  name: 'Default',
  colors: {
    background: '#ffffff',
    rootNode: '#1e40af',
    branches: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
    text: '#1f2937',
    lines: '#94a3b8',
  },
  handDrawn: false,
  rainbowBranches: true,
};

// Create a new node
function createNode(text: string): MindMapNode {
  return {
    id: uuidv4(),
    text,
    children: [],
    markers: [],
    labels: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Create a new map
function createMap(name: string): MindMap {
  const rootNode = createNode(name);
  return {
    id: uuidv4(),
    name,
    root: rootNode,
    floatingTopics: [],
    relationships: [],
    boundaries: [],
    summaries: [],
    theme: { ...defaultTheme },
    structure: 'mindmap',
    zoom: 1,
    panX: 0,
    panY: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0',
  };
}

export const useMindMapStore = defineStore('mindmap', () => {
  // ============================================
  // State
  // ============================================

  const currentMap = ref<MindMap>(createMap('New Mind Map'));

  const canvasState = ref<CanvasState>({
    selectedNodeIds: [],
    hoveredNodeId: null,
    editingNodeId: null,
    draggingNodeId: null,
    dragOffset: null,
    selectionBox: null,
    linkMode: {
      active: false,
      sourceId: null,
    },
  });

  const viewState = ref<ViewState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    viewMode: 'normal',
    showBranch: null,
  });

  const history = ref<MindMap[]>([]);
  const historyIndex = ref(-1);
  const isLocked = ref(false);

  // ============================================
  // Getters
  // ============================================

  const root = computed(() => currentMap.value.root);
  const theme = computed(() => currentMap.value.theme);
  const structure = computed(() => currentMap.value.structure);
  const relationships = computed(() => currentMap.value.relationships);
  const boundaries = computed(() => currentMap.value.boundaries);
  const floatingTopics = computed(() => currentMap.value.floatingTopics);

  const selectedNodes = computed(() => {
    const nodes: MindMapNode[] = [];
    const findNodes = (node: MindMapNode) => {
      if (canvasState.value.selectedNodeIds.includes(node.id)) {
        nodes.push(node);
      }
      node.children.forEach(findNodes);
    };
    findNodes(currentMap.value.root);
    currentMap.value.floatingTopics.forEach(findNodes);
    return nodes;
  });

  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value < history.value.length - 1);

  // ============================================
  // Node Operations
  // ============================================

  function findNodeById(id: string, node?: MindMapNode): MindMapNode | null {
    const searchNode = node || currentMap.value.root;
    if (searchNode.id === id) return searchNode;

    for (const child of searchNode.children) {
      const found = findNodeById(id, child);
      if (found) return found;
    }

    // Check floating topics
    if (!node) {
      for (const floating of currentMap.value.floatingTopics) {
        const found = findNodeById(id, floating);
        if (found) return found;
      }
    }

    return null;
  }

  function findParentNode(nodeId: string, node?: MindMapNode, parent?: MindMapNode): MindMapNode | null {
    const searchNode = node || currentMap.value.root;
    if (searchNode.id === nodeId) return parent || null;

    for (const child of searchNode.children) {
      const found = findParentNode(nodeId, child, searchNode);
      if (found !== null) return found;
    }

    return null;
  }

  function saveHistory() {
    // Remove any future history if we're not at the end
    history.value = history.value.slice(0, historyIndex.value + 1);
    history.value.push(JSON.parse(JSON.stringify(currentMap.value)));
    historyIndex.value = history.value.length - 1;

    // Limit history size
    if (history.value.length > 100) {
      history.value.shift();
      historyIndex.value--;
    }
  }

  function addChild(parentId: string, text: string = 'New Topic'): MindMapNode | null {
    const parent = findNodeById(parentId);
    if (!parent) return null;

    saveHistory();
    const newNode = createNode(text);
    parent.children.push(newNode);
    parent.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();

    return newNode;
  }

  function addSibling(nodeId: string, text: string = 'New Topic'): MindMapNode | null {
    const parent = findParentNode(nodeId);
    if (!parent) return null;

    saveHistory();
    const newNode = createNode(text);
    const index = parent.children.findIndex(c => c.id === nodeId);
    parent.children.splice(index + 1, 0, newNode);
    parent.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();

    return newNode;
  }

  function addFloatingTopic(position: Position, text: string = 'Floating Topic'): MindMapNode {
    saveHistory();
    const newNode = createNode(text);
    newNode.isFloating = true;
    newNode.position = position;
    currentMap.value.floatingTopics.push(newNode);
    currentMap.value.updatedAt = Date.now();
    return newNode;
  }

  function updateNodeText(nodeId: string, text: string) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    node.text = text;
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function deleteNode(nodeId: string) {
    // Can't delete root
    if (nodeId === currentMap.value.root.id) return;

    const parent = findParentNode(nodeId);
    if (parent) {
      saveHistory();
      const index = parent.children.findIndex(c => c.id === nodeId);
      if (index > -1) {
        parent.children.splice(index, 1);
        parent.updatedAt = Date.now();
      }
    } else {
      // Check floating topics
      const index = currentMap.value.floatingTopics.findIndex(t => t.id === nodeId);
      if (index > -1) {
        saveHistory();
        currentMap.value.floatingTopics.splice(index, 1);
      }
    }

    // Remove from selection
    canvasState.value.selectedNodeIds = canvasState.value.selectedNodeIds.filter(id => id !== nodeId);

    // Remove related relationships
    currentMap.value.relationships = currentMap.value.relationships.filter(
      r => r.sourceId !== nodeId && r.targetId !== nodeId
    );

    currentMap.value.updatedAt = Date.now();
  }

  function moveNode(nodeId: string, newParentId: string) {
    if (nodeId === newParentId) return;
    if (nodeId === currentMap.value.root.id) return;

    const node = findNodeById(nodeId);
    const newParent = findNodeById(newParentId);
    const oldParent = findParentNode(nodeId);

    if (!node || !newParent) return;

    // Prevent moving to descendant
    const isDescendant = (parent: MindMapNode, childId: string): boolean => {
      if (parent.id === childId) return true;
      return parent.children.some(c => isDescendant(c, childId));
    };
    if (isDescendant(node, newParentId)) return;

    saveHistory();

    // Remove from old parent
    if (oldParent) {
      const index = oldParent.children.findIndex(c => c.id === nodeId);
      if (index > -1) {
        oldParent.children.splice(index, 1);
        oldParent.updatedAt = Date.now();
      }
    } else {
      // Was floating
      const index = currentMap.value.floatingTopics.findIndex(t => t.id === nodeId);
      if (index > -1) {
        currentMap.value.floatingTopics.splice(index, 1);
      }
    }

    // Add to new parent
    node.isFloating = false;
    node.position = undefined;
    newParent.children.push(node);
    newParent.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function toggleCollapse(nodeId: string) {
    const node = findNodeById(nodeId);
    if (!node || node.children.length === 0) return;

    node.collapsed = !node.collapsed;
    node.updatedAt = Date.now();
  }

  // ============================================
  // Marker & Label Operations
  // ============================================

  function addMarker(nodeId: string, marker: Marker) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    // Remove existing marker of same category
    node.markers = node.markers.filter(m => m.category !== marker.category);
    node.markers.push(marker);
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function removeMarker(nodeId: string, markerId: string) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    node.markers = node.markers.filter(m => m.id !== markerId);
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function addLabel(nodeId: string, label: Label) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    node.labels.push(label);
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function removeLabel(nodeId: string, labelId: string) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    node.labels = node.labels.filter(l => l.id !== labelId);
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  // ============================================
  // Relationship Operations
  // ============================================

  function addRelationship(sourceId: string, targetId: string, label?: string): Relationship | null {
    if (sourceId === targetId) return null;

    // Check if relationship already exists
    const exists = currentMap.value.relationships.some(
      r => (r.sourceId === sourceId && r.targetId === targetId) ||
           (r.sourceId === targetId && r.targetId === sourceId)
    );
    if (exists) return null;

    saveHistory();
    const relationship: Relationship = {
      id: uuidv4(),
      sourceId,
      targetId,
      label,
      style: 'solid',
      color: '#3b82f6',
      curvature: 0.3,
      startArrow: false,
      endArrow: true,
    };
    currentMap.value.relationships.push(relationship);
    currentMap.value.updatedAt = Date.now();
    return relationship;
  }

  function removeRelationship(relationshipId: string) {
    saveHistory();
    currentMap.value.relationships = currentMap.value.relationships.filter(r => r.id !== relationshipId);
    currentMap.value.updatedAt = Date.now();
  }

  // ============================================
  // Boundary Operations
  // ============================================

  function addBoundary(nodeIds: string[], label?: string): Boundary | null {
    if (nodeIds.length === 0) return null;

    saveHistory();
    const boundary: Boundary = {
      id: uuidv4(),
      nodeIds,
      label,
      shape: 'rounded',
      color: '#3b82f6',
      backgroundColor: '#3b82f620',
      opacity: 0.5,
    };
    currentMap.value.boundaries.push(boundary);
    currentMap.value.updatedAt = Date.now();
    return boundary;
  }

  function removeBoundary(boundaryId: string) {
    saveHistory();
    currentMap.value.boundaries = currentMap.value.boundaries.filter(b => b.id !== boundaryId);
    currentMap.value.updatedAt = Date.now();
  }

  // ============================================
  // History Operations
  // ============================================

  function undo() {
    if (!canUndo.value) return;
    historyIndex.value--;
    currentMap.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]));
  }

  function redo() {
    if (!canRedo.value) return;
    historyIndex.value++;
    currentMap.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]));
  }

  // ============================================
  // Selection Operations
  // ============================================

  function selectNode(nodeId: string, addToSelection: boolean = false) {
    if (addToSelection) {
      if (canvasState.value.selectedNodeIds.includes(nodeId)) {
        canvasState.value.selectedNodeIds = canvasState.value.selectedNodeIds.filter(id => id !== nodeId);
      } else {
        canvasState.value.selectedNodeIds.push(nodeId);
      }
    } else {
      canvasState.value.selectedNodeIds = [nodeId];
    }
  }

  function clearSelection() {
    canvasState.value.selectedNodeIds = [];
  }

  function startEditing(nodeId: string) {
    canvasState.value.editingNodeId = nodeId;
  }

  function stopEditing() {
    canvasState.value.editingNodeId = null;
  }

  // ============================================
  // View Operations
  // ============================================

  function setZoom(zoom: number) {
    viewState.value.zoom = Math.max(0.1, Math.min(5, zoom));
  }

  function setPan(x: number, y: number) {
    viewState.value.panX = x;
    viewState.value.panY = y;
  }

  function resetView() {
    viewState.value.zoom = 1;
    viewState.value.panX = 0;
    viewState.value.panY = 0;
  }

  function setViewMode(mode: ViewState['viewMode']) {
    viewState.value.viewMode = mode;
  }

  function showBranchOnly(nodeId: string | null) {
    viewState.value.showBranch = nodeId;
  }

  // ============================================
  // Theme Operations
  // ============================================

  function setTheme(theme: MapTheme) {
    saveHistory();
    currentMap.value.theme = theme;
    currentMap.value.updatedAt = Date.now();
  }

  function setStructure(structure: StructureType) {
    saveHistory();
    currentMap.value.structure = structure;
    currentMap.value.updatedAt = Date.now();
  }

  // ============================================
  // Map Operations
  // ============================================

  function newMap(name: string = 'New Mind Map') {
    currentMap.value = createMap(name);
    history.value = [JSON.parse(JSON.stringify(currentMap.value))];
    historyIndex.value = 0;
    clearSelection();
    resetView();
  }

  function loadMap(map: MindMap) {
    currentMap.value = map;
    history.value = [JSON.parse(JSON.stringify(currentMap.value))];
    historyIndex.value = 0;
    clearSelection();
    resetView();
  }

  function getMapData(): MindMap {
    return JSON.parse(JSON.stringify(currentMap.value));
  }

  // Initialize
  function init() {
    history.value = [JSON.parse(JSON.stringify(currentMap.value))];
    historyIndex.value = 0;
  }

  // ============================================
  // Link Mode
  // ============================================

  function startLinkMode(sourceId: string) {
    canvasState.value.linkMode = {
      active: true,
      sourceId,
    };
  }

  function cancelLinkMode() {
    canvasState.value.linkMode = {
      active: false,
      sourceId: null,
    };
  }

  function completeLinkMode(targetId: string, label?: string) {
    if (!canvasState.value.linkMode.sourceId) return;
    addRelationship(canvasState.value.linkMode.sourceId, targetId, label);
    cancelLinkMode();
  }

  return {
    // State
    currentMap,
    canvasState,
    viewState,
    isLocked,

    // Getters
    root,
    theme,
    structure,
    relationships,
    boundaries,
    floatingTopics,
    selectedNodes,
    canUndo,
    canRedo,

    // Node operations
    findNodeById,
    findParentNode,
    addChild,
    addSibling,
    addFloatingTopic,
    updateNodeText,
    deleteNode,
    moveNode,
    toggleCollapse,

    // Markers & Labels
    addMarker,
    removeMarker,
    addLabel,
    removeLabel,

    // Relationships
    addRelationship,
    removeRelationship,

    // Boundaries
    addBoundary,
    removeBoundary,

    // History
    undo,
    redo,

    // Selection
    selectNode,
    clearSelection,
    startEditing,
    stopEditing,

    // View
    setZoom,
    setPan,
    resetView,
    setViewMode,
    showBranchOnly,

    // Theme & Structure
    setTheme,
    setStructure,

    // Map operations
    newMap,
    loadMap,
    getMapData,
    init,

    // Link mode
    startLinkMode,
    cancelLinkMode,
    completeLinkMode,
  };
});
