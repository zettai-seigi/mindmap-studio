import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultTheme } from '../themes';

// LocalStorage keys
const STORAGE_KEY_MAP = 'mindmap-studio-map';
const STORAGE_KEY_VIEW = 'mindmap-studio-view';
const STORAGE_KEY_FORMAT = 'mindmap-studio-format';
import type {
  MindMap,
  MindMapNode,
  CanvasState,
  ViewState,
  Relationship,
  Boundary,
  Summary,
  MapTheme,
  StructureType,
  Marker,
  Label,
  Position,
  FloatingClipart,
} from '../types';

// Default theme - imported from themes
const defaultTheme: MapTheme = getDefaultTheme();

// Sheet format settings interface
export interface SheetFormat {
  backgroundColor: string;
  wallpaper: string;
  wallpaperOpacity: number;
  showLegend: boolean;
  legendBackgroundColor: string;
  taperedLines: boolean;
  gradientColor: boolean;
  multiBranchColor: boolean;
  showLabel: boolean;
  showNotes: boolean;
  showHyperlink: boolean;
  showAudioNotes: boolean;
  showTaskInfo: boolean;
  infoCardBackgroundColor: string;
}

const defaultSheetFormat: SheetFormat = {
  backgroundColor: '#1e293b',
  wallpaper: '',
  wallpaperOpacity: 60,
  showLegend: false,
  legendBackgroundColor: '#ff6b6b',
  taperedLines: false,
  gradientColor: false,
  multiBranchColor: false,
  showLabel: true,
  showNotes: false,
  showHyperlink: false,
  showAudioNotes: false,
  showTaskInfo: false,
  infoCardBackgroundColor: '#ff6b6b',
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
  // Set default structure on root node
  rootNode.structure = 'mindmap';
  return {
    id: uuidv4(),
    name,
    root: rootNode,
    floatingTopics: [],
    floatingCliparts: [],
    relationships: [],
    boundaries: [],
    summaries: [],
    theme: { ...defaultTheme },
    structure: 'mindmap', // Kept for backwards compatibility, but root.structure is the source of truth
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
    selectedRelationshipId: null,
    selectedBoundaryId: null,
    selectedSummaryId: null,
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

  const sheetFormat = ref<SheetFormat>({ ...defaultSheetFormat });

  // ============================================
  // Getters
  // ============================================

  const root = computed(() => currentMap.value.root);
  const theme = computed(() => currentMap.value.theme);
  // Structure is derived from root node's structure (or fallback to 'mindmap')
  const structure = computed(() => currentMap.value.root.structure || 'mindmap');
  const relationships = computed(() => currentMap.value.relationships);
  const boundaries = computed(() => currentMap.value.boundaries);
  const summaries = computed(() => currentMap.value.summaries);
  const floatingTopics = computed(() => currentMap.value.floatingTopics);
  const floatingCliparts = computed(() => currentMap.value.floatingCliparts);

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

  function addFloatingClipart(position: Position, icon: string, clipartId: string): FloatingClipart {
    saveHistory();
    const newClipart: FloatingClipart = {
      id: uuidv4(),
      icon,
      clipartId,
      position,
      size: 48,
    };
    currentMap.value.floatingCliparts.push(newClipart);
    currentMap.value.updatedAt = Date.now();
    return newClipart;
  }

  function removeFloatingClipart(clipartId: string) {
    saveHistory();
    currentMap.value.floatingCliparts = currentMap.value.floatingCliparts.filter(c => c.id !== clipartId);
    currentMap.value.updatedAt = Date.now();
  }

  function updateNodeText(nodeId: string, text: string) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    node.text = text;
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function updateNodeNotes(nodeId: string, notes: string) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    node.notes = notes;
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function updateNodeStyle(nodeId: string, style: Partial<{
    shape: string;
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
  }>) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    if (!node.style) {
      node.style = {};
    }
    Object.assign(node.style, style);
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  // Set node-level structure (affects how this node's children are laid out)
  function setNodeStructure(nodeId: string, structure: StructureType | undefined) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    if (structure === undefined) {
      delete node.structure;
    } else {
      node.structure = structure;
    }
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function addComment(nodeId: string, author: string, text: string) {
    const node = findNodeById(nodeId);
    if (!node) return null;

    saveHistory();
    if (!node.comments) {
      node.comments = [];
    }
    const comment = {
      id: uuidv4(),
      author,
      text,
      createdAt: Date.now(),
    };
    node.comments.push(comment);
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
    return comment;
  }

  function deleteComment(nodeId: string, commentId: string) {
    const node = findNodeById(nodeId);
    if (!node || !node.comments) return;

    saveHistory();
    node.comments = node.comments.filter(c => c.id !== commentId);
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function updateTaskInfo(nodeId: string, taskInfo: Partial<{
    assignee: string;
    priority: number;
    startDate: number | null;
    duration: number;
    progress: number;
    isCheckpoint: boolean;
    dependencies: string[];
  }>) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();

    // Initialize task if not exists
    if (!node.task) {
      node.task = {
        progress: 0,
        priority: 0,
        completed: false,
      };
    }

    // Update task properties
    if (taskInfo.assignee !== undefined) node.task.assignee = taskInfo.assignee || undefined;
    if (taskInfo.priority !== undefined) node.task.priority = taskInfo.priority;
    if (taskInfo.startDate !== undefined) node.task.startDate = taskInfo.startDate || undefined;
    if (taskInfo.duration !== undefined) node.task.duration = taskInfo.duration;
    if (taskInfo.progress !== undefined) {
      node.task.progress = taskInfo.progress;
      node.task.completed = taskInfo.progress >= 100;
    }
    if (taskInfo.isCheckpoint !== undefined) node.task.isCheckpoint = taskInfo.isCheckpoint;
    if (taskInfo.dependencies !== undefined) node.task.dependencies = taskInfo.dependencies;

    // Calculate end date based on start + duration
    if (node.task.startDate && node.task.duration) {
      node.task.endDate = node.task.startDate + (node.task.duration * 24 * 60 * 60 * 1000);
    }

    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function clearTaskInfo(nodeId: string) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    node.task = undefined;
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

  function expandNode(nodeId: string) {
    const node = findNodeById(nodeId);
    if (!node) return;

    if (node.collapsed) {
      node.collapsed = false;
      node.updatedAt = Date.now();
    }
  }

  function expandParentsOf(nodeId: string) {
    let parent = findParentNode(nodeId);
    while (parent) {
      if (parent.collapsed) {
        parent.collapsed = false;
        parent.updatedAt = Date.now();
      }
      parent = findParentNode(parent.id);
    }
  }

  function moveNodeUp(nodeId: string) {
    const parent = findParentNode(nodeId);
    if (!parent) return;

    const index = parent.children.findIndex(c => c.id === nodeId);
    if (index <= 0) return;

    const currentNode = parent.children[index];
    const prevNode = parent.children[index - 1];
    if (!currentNode || !prevNode) return;

    saveHistory();
    // Swap with previous sibling
    parent.children[index - 1] = currentNode;
    parent.children[index] = prevNode;
    parent.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function moveNodeDown(nodeId: string) {
    const parent = findParentNode(nodeId);
    if (!parent) return;

    const index = parent.children.findIndex(c => c.id === nodeId);
    if (index === -1 || index >= parent.children.length - 1) return;

    const currentNode = parent.children[index];
    const nextNode = parent.children[index + 1];
    if (!currentNode || !nextNode) return;

    saveHistory();
    // Swap with next sibling
    parent.children[index] = nextNode;
    parent.children[index + 1] = currentNode;
    parent.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function sortChildrenAlphabetically(nodeId: string) {
    const node = findNodeById(nodeId);
    if (!node || node.children.length < 2) return;

    saveHistory();
    node.children.sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }));
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  // Calculate aggregated progress for a node based on children with checkboxes/tasks
  function calculateChildrenProgress(nodeId: string): number | null {
    const node = findNodeById(nodeId);
    if (!node || node.children.length === 0) return null;

    // Check if all children have tasks with progress
    const childrenWithTasks = node.children.filter(child => child.task !== undefined);
    if (childrenWithTasks.length === 0) return null;

    // Only show roll-up if ALL children have tasks
    if (childrenWithTasks.length !== node.children.length) return null;

    // Calculate average progress
    const totalProgress = childrenWithTasks.reduce((sum, child) => {
      return sum + (child.task?.progress || 0);
    }, 0);

    return Math.round(totalProgress / childrenWithTasks.length);
  }

  // Create mind map from clipboard text (supports plain text, markdown, bullet lists)
  function createMapFromClipboard(text: string): MindMapNode | null {
    if (!text.trim()) return null;

    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;

    // Parse the structure
    const rootText = lines[0]?.replace(/^#+\s*/, '').replace(/^[-*•]\s*/, '').trim() || 'New Mind Map';
    const rootNode = createNode(rootText);

    // Parse remaining lines as children
    const parseIndentedLines = (startIndex: number, parentIndent: number): MindMapNode[] => {
      const children: MindMapNode[] = [];
      let i = startIndex;

      while (i < lines.length) {
        const line = lines[i] || '';
        const trimmed = line.trim();
        if (!trimmed) {
          i++;
          continue;
        }

        // Calculate indent level
        const indent = line.search(/\S|$/);

        // If this line has less or equal indent than parent, we're done with this level
        if (indent <= parentIndent && i !== startIndex) {
          break;
        }

        // Clean the text (remove markdown/bullet markers)
        const cleanText = trimmed
          .replace(/^#+\s*/, '')      // Remove markdown headers
          .replace(/^[-*•+]\s*/, '')  // Remove bullet points
          .replace(/^\d+\.\s*/, '')   // Remove numbered lists
          .replace(/^\[.\]\s*/, '')   // Remove checkboxes [x] or [ ]
          .trim();

        if (cleanText) {
          const childNode = createNode(cleanText);

          // Check if it was a checkbox and set task info
          if (/^\[x\]/i.test(trimmed.replace(/^[-*•+]\s*/, ''))) {
            childNode.task = { progress: 100, priority: 0, completed: true };
          } else if (/^\[\s\]/.test(trimmed.replace(/^[-*•+]\s*/, ''))) {
            childNode.task = { progress: 0, priority: 0, completed: false };
          }

          i++;

          // Recursively parse children of this node
          if (i < lines.length) {
            const nextLine = lines[i] || '';
            const nextIndent = nextLine.search(/\S|$/);
            if (nextIndent > indent) {
              const result = parseIndentedLines(i, indent);
              childNode.children = result;
              // Find where we stopped
              let skipCount = 0;
              const countChildren = (nodes: MindMapNode[]): number => {
                let count = nodes.length;
                for (const n of nodes) {
                  count += countChildren(n.children);
                }
                return count;
              };
              skipCount = countChildren(result);
              i += skipCount;
            }
          }

          children.push(childNode);
        } else {
          i++;
        }
      }

      return children;
    };

    if (lines.length > 1) {
      rootNode.children = parseIndentedLines(1, -1);
    }

    return rootNode;
  }

  function importFromClipboardText(text: string) {
    const rootNode = createMapFromClipboard(text);
    if (!rootNode) return;

    saveHistory();
    currentMap.value.root = rootNode;
    currentMap.value.name = rootNode.text;
    currentMap.value.updatedAt = Date.now();
  }

  function setNodePosition(nodeId: string, position: Position) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    node.position = position;
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function clearNodePosition(nodeId: string) {
    const node = findNodeById(nodeId);
    if (!node) return;

    saveHistory();
    node.position = undefined;
    node.updatedAt = Date.now();
    currentMap.value.updatedAt = Date.now();
  }

  function clearAllPositions() {
    saveHistory();
    const clearPositions = (node: MindMapNode) => {
      node.position = undefined;
      node.children.forEach(clearPositions);
    };
    clearPositions(currentMap.value.root);
    currentMap.value.floatingTopics.forEach(clearPositions);
    currentMap.value.updatedAt = Date.now();
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

  function updateRelationship(relationshipId: string, updates: Partial<{
    label: string;
    labelOffset: Position;
    style: 'solid' | 'dashed' | 'dotted';
    color: string;
    curvature: number;
    startArrow: boolean;
    endArrow: boolean;
    controlPoint1: Position;
    controlPoint2: Position;
  }>, saveToHistory: boolean = true) {
    const rel = currentMap.value.relationships.find(r => r.id === relationshipId);
    if (!rel) return;

    if (saveToHistory) {
      saveHistory();
    }
    Object.assign(rel, updates);
    currentMap.value.updatedAt = Date.now();
  }

  // ============================================
  // Boundary Operations
  // ============================================

  function addBoundary(
    nodeIds: string[],
    label?: string,
    shape: Boundary['shape'] = 'rounded'
  ): Boundary | null {
    if (nodeIds.length === 0) return null;

    saveHistory();
    const boundary: Boundary = {
      id: uuidv4(),
      nodeIds,
      label,
      shape,
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

  function updateBoundary(boundaryId: string, updates: Partial<Boundary>) {
    const boundary = currentMap.value.boundaries.find(b => b.id === boundaryId);
    if (!boundary) return;

    saveHistory();
    Object.assign(boundary, updates);
    currentMap.value.updatedAt = Date.now();
  }

  // ============================================
  // Summary Operations
  // ============================================

  function updateSummary(summaryId: string, updates: Partial<Summary>) {
    const summary = currentMap.value.summaries.find(s => s.id === summaryId);
    if (!summary) return;

    saveHistory();
    Object.assign(summary, updates);
    currentMap.value.updatedAt = Date.now();
  }

  function removeSummary(summaryId: string) {
    saveHistory();
    currentMap.value.summaries = currentMap.value.summaries.filter(s => s.id !== summaryId);
    if (canvasState.value.selectedSummaryId === summaryId) {
      canvasState.value.selectedSummaryId = null;
    }
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
    canvasState.value.selectedRelationshipId = null;
    canvasState.value.selectedBoundaryId = null;
    canvasState.value.selectedSummaryId = null;
  }

  function selectRelationship(relationshipId: string | null) {
    canvasState.value.selectedRelationshipId = relationshipId;
    if (relationshipId) {
      canvasState.value.selectedNodeIds = [];
      canvasState.value.selectedBoundaryId = null;
      canvasState.value.selectedSummaryId = null;
    }
  }

  function selectBoundary(boundaryId: string | null) {
    canvasState.value.selectedBoundaryId = boundaryId;
    if (boundaryId) {
      canvasState.value.selectedNodeIds = [];
      canvasState.value.selectedRelationshipId = null;
      canvasState.value.selectedSummaryId = null;
    }
  }

  function selectSummary(summaryId: string | null) {
    canvasState.value.selectedSummaryId = summaryId;
    if (summaryId) {
      canvasState.value.selectedNodeIds = [];
      canvasState.value.selectedRelationshipId = null;
      canvasState.value.selectedBoundaryId = null;
    }
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
    // Set structure on root node (same as setNodeStructure for root)
    setNodeStructure(currentMap.value.root.id, structure);
  }

  // ============================================
  // Sheet Format Operations
  // ============================================

  function updateSheetFormat(updates: Partial<SheetFormat>) {
    sheetFormat.value = { ...sheetFormat.value, ...updates };
  }

  function resetSheetFormat() {
    sheetFormat.value = { ...defaultSheetFormat };
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
  // LocalStorage Persistence
  // ============================================

  function saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_MAP, JSON.stringify(currentMap.value));
      localStorage.setItem(STORAGE_KEY_VIEW, JSON.stringify({
        zoom: viewState.value.zoom,
        panX: viewState.value.panX,
        panY: viewState.value.panY,
      }));
      localStorage.setItem(STORAGE_KEY_FORMAT, JSON.stringify(sheetFormat.value));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  function loadFromLocalStorage(): boolean {
    try {
      const savedMap = localStorage.getItem(STORAGE_KEY_MAP);
      const savedView = localStorage.getItem(STORAGE_KEY_VIEW);
      const savedFormat = localStorage.getItem(STORAGE_KEY_FORMAT);

      if (savedMap) {
        const map = JSON.parse(savedMap) as MindMap;
        currentMap.value = map;
        history.value = [JSON.parse(JSON.stringify(map))];
        historyIndex.value = 0;

        if (savedView) {
          const view = JSON.parse(savedView);
          viewState.value.zoom = view.zoom ?? 1;
          viewState.value.panX = view.panX ?? 0;
          viewState.value.panY = view.panY ?? 0;
        }

        if (savedFormat) {
          sheetFormat.value = { ...defaultSheetFormat, ...JSON.parse(savedFormat) };
        }

        return true;
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
    return false;
  }

  function clearLocalStorage() {
    localStorage.removeItem(STORAGE_KEY_MAP);
    localStorage.removeItem(STORAGE_KEY_VIEW);
    localStorage.removeItem(STORAGE_KEY_FORMAT);
  }

  // Auto-save when map changes (debounced via updatedAt)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  watch(
    () => currentMap.value.updatedAt,
    () => {
      // Debounce saves to avoid too frequent writes
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveToLocalStorage();
      }, 500);
    }
  );

  // Also save view state and format changes
  watch(
    [() => viewState.value.zoom, () => viewState.value.panX, () => viewState.value.panY],
    () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveToLocalStorage();
      }, 500);
    }
  );

  watch(
    sheetFormat,
    () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveToLocalStorage();
      }, 500);
    },
    { deep: true }
  );

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
    sheetFormat,

    // Getters
    root,
    theme,
    structure,
    relationships,
    boundaries,
    summaries,
    floatingTopics,
    floatingCliparts,
    selectedNodes,
    canUndo,
    canRedo,

    // Node operations
    findNodeById,
    findParentNode,
    addChild,
    addSibling,
    addFloatingTopic,
    addFloatingClipart,
    removeFloatingClipart,
    updateNodeText,
    updateNodeNotes,
    updateNodeStyle,
    setNodeStructure,
    deleteNode,
    moveNode,
    moveNodeUp,
    moveNodeDown,
    sortChildrenAlphabetically,
    toggleCollapse,
    expandNode,
    expandParentsOf,
    setNodePosition,
    clearNodePosition,
    clearAllPositions,
    calculateChildrenProgress,
    importFromClipboardText,

    // Markers & Labels
    addMarker,
    removeMarker,
    addLabel,
    removeLabel,

    // Comments
    addComment,
    deleteComment,

    // Tasks
    updateTaskInfo,
    clearTaskInfo,

    // Relationships
    addRelationship,
    removeRelationship,
    updateRelationship,

    // Boundaries
    addBoundary,
    removeBoundary,
    updateBoundary,

    // Summaries
    updateSummary,
    removeSummary,

    // History
    undo,
    redo,

    // Selection
    selectNode,
    selectRelationship,
    selectBoundary,
    selectSummary,
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

    // Sheet Format
    updateSheetFormat,
    resetSheetFormat,

    // Map operations
    newMap,
    loadMap,
    getMapData,
    init,

    // Link mode
    startLinkMode,
    cancelLinkMode,
    completeLinkMode,

    // Persistence
    saveToLocalStorage,
    loadFromLocalStorage,
    clearLocalStorage,
  };
});
