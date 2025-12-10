<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { layoutNodes, getAllRenderedNodes, findRenderedNodeById, getBoundingBox } from '../layouts';
import type { RenderedNode, Position } from '../types';
import ContextMenu from './ContextMenu.vue';
import { getMarkerDisplay } from '../composables/useMarkerDisplay';
import { useCanvasCoordinates } from '../composables/useCanvasCoordinates';
import { useCanvasHitDetection } from '../composables/useCanvasHitDetection';
import { useTheme } from '../composables/useTheme';

const props = defineProps<{
  focusMode?: boolean;
  tagFilters?: string[];
}>();

const store = useMindMapStore();
const { canvasBackground, isDark } = useTheme();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const textInputRef = ref<HTMLInputElement | null>(null);

// Canvas dimensions
const canvasWidth = ref(0);
const canvasHeight = ref(0);

// Interaction state
const isDragging = ref(false);
const isPanning = ref(false);
const dragStart = ref<Position | null>(null);
const lastMousePos = ref<Position | null>(null);
const draggedNode = ref<RenderedNode | null>(null);
const dragOffset = ref<Position>({ x: 0, y: 0 });
const dragStartNodePos = ref<Position | null>(null); // Original node position when drag started
const hasDraggedSignificantly = ref(false); // Track if node actually moved

// Relationship control point dragging
const draggingControlPoint = ref<{ relId: string; point: 1 | 2 } | null>(null);
const draggingRelationshipLabel = ref<{ relId: string; startPos: Position } | null>(null);
const controlPointRadius = 8;

// Computed: selected relationship from store
const selectedRelationshipId = computed(() => store.canvasState.selectedRelationshipId);

// Relationship label editing state
const editingRelationshipLabel = ref<{
  relId: string;
  x: number;
  y: number;
  text: string;
} | null>(null);
const relationshipLabelInputRef = ref<HTMLInputElement | null>(null);

// Store label positions for hit detection (updated during render)
const relationshipLabelPositions = new Map<string, { x: number; y: number; baseX: number; baseY: number }>();

// Store boundary and summary bounds for hit detection (updated during render)
const boundaryBounds = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
const summaryBounds = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();

// Computed: selected boundary and summary from store
const selectedBoundaryId = computed(() => store.canvasState.selectedBoundaryId);
const selectedSummaryId = computed(() => store.canvasState.selectedSummaryId);

// Context menu state
const contextMenu = ref<{ show: boolean; x: number; y: number; nodeId: string | null }>({
  show: false,
  x: 0,
  y: 0,
  nodeId: null,
});

// Inline editing state
const editingNode = ref<{ id: string; x: number; y: number; width: number; height: number; text: string } | null>(null);

// Rendered layout
const renderedRoot = ref<RenderedNode | null>(null);
const allNodes = computed(() => {
  if (!renderedRoot.value) return [];
  return getAllRenderedNodes(renderedRoot.value);
});

// Colors based on theme
const colors = computed(() => store.theme.colors);
const fonts = computed(() => store.theme.fonts);
const theme = computed(() => store.theme);

// Computed relationships from store
const relationships = computed(() => store.relationships);

// ============================================
// Composables Setup
// ============================================

// Canvas coordinate utilities
const { screenToWorld, getNodeEdgePoint } = useCanvasCoordinates({
  canvasRef,
  canvasWidth,
  canvasHeight,
  zoom: () => store.viewState.zoom,
  panX: () => store.viewState.panX,
  panY: () => store.viewState.panY,
});

// Floating topics from store
const floatingTopics = computed(() => store.floatingTopics);

// Hit detection utilities
const {
  findNodeAtPosition,
  findRelationshipAtPosition,
  findControlPointAtPosition,
  findRelationshipLabelAtPosition,
} = useCanvasHitDetection({
  renderedRoot,
  allNodes,
  floatingTopics,
  relationships,
  selectedRelationshipId,
  relationshipLabelPositions,
  controlPointRadius,
  getRelationshipControlPoints,
});

// ============================================
// Layout & Rendering
// ============================================

function updateLayout() {
  if (!store.root) return;

  const config = {
    centerX: canvasWidth.value / 2,
    centerY: canvasHeight.value / 2,
  };

  renderedRoot.value = layoutNodes(store.root, store.structure, config);
}

function render() {
  if (!ctx.value || !canvasRef.value) return;

  const canvas = canvasRef.value;
  const c = ctx.value;
  const dpr = window.devicePixelRatio || 1;

  // Reset any transforms first
  c.setTransform(1, 0, 0, 1, 0, 0);

  // Clear and fill entire canvas with background color
  // Use mindmap theme background if available, otherwise use system theme background
  const themeBgColor = colors.value.background || canvasBackground.value;
  c.fillStyle = themeBgColor;
  c.fillRect(0, 0, canvas.width, canvas.height);

  // Apply DPR scaling, then zoom and pan
  // Use CSS dimensions for coordinate system consistency
  const cssWidth = canvasWidth.value;
  const cssHeight = canvasHeight.value;

  c.save();
  c.scale(dpr, dpr); // Scale for high-DPI displays
  c.translate(cssWidth / 2, cssHeight / 2);
  c.scale(store.viewState.zoom, store.viewState.zoom);
  c.translate(
    -cssWidth / 2 + store.viewState.panX,
    -cssHeight / 2 + store.viewState.panY
  );

  // Draw wallpaper pattern (optional)
  drawGrid(c);

  // Draw connections
  if (renderedRoot.value) {
    drawConnections(c, renderedRoot.value);
  }

  // Draw relationships
  drawRelationships(c);

  // Draw boundaries
  drawBoundaries(c);

  // Draw nodes
  if (renderedRoot.value) {
    drawNodes(c, renderedRoot.value);
  }

  // Draw floating topics as mini mind maps with their children
  store.floatingTopics.forEach(topic => {
    if (topic.position) {
      // Layout the floating topic as a mini mind map
      // Use startLevel: 1 so floating topics use branch styling (not root styling)
      const floatingRendered = layoutNodes(topic, 'mindmap', {
        centerX: topic.position.x + 60, // Offset so position is top-left corner
        centerY: topic.position.y + 20,
        startLevel: 1,
      });

      // Draw connections for this floating topic tree
      drawConnections(c, floatingRendered);

      // Draw all nodes in this floating topic tree
      drawNodes(c, floatingRendered);
    }
  });

  // Draw summaries (brackets that group children)
  drawSummaries(c);

  // Draw floating cliparts
  store.floatingCliparts.forEach(clipart => {
    drawFloatingClipart(c, clipart);
  });

  // Draw selection box
  if (store.canvasState.selectionBox) {
    const { start, end } = store.canvasState.selectionBox;
    c.strokeStyle = '#3b82f6';
    c.lineWidth = 1;
    c.setLineDash([5, 5]);
    c.strokeRect(
      Math.min(start.x, end.x),
      Math.min(start.y, end.y),
      Math.abs(end.x - start.x),
      Math.abs(end.y - start.y)
    );
    c.setLineDash([]);
  }

  c.restore();
}

function drawGrid(c: CanvasRenderingContext2D) {
  const sf = store.sheetFormat;

  // Only draw wallpaper patterns if selected
  if (!sf.wallpaper) return;

  const gridSize = 50;
  const opacity = sf.wallpaperOpacity / 100;

  if (sf.wallpaper === 'grid') {
    c.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.15})`;
    c.lineWidth = 0.5;

    for (let x = 0; x < canvasWidth.value * 2; x += gridSize) {
      c.beginPath();
      c.moveTo(x - canvasWidth.value / 2, -canvasHeight.value);
      c.lineTo(x - canvasWidth.value / 2, canvasHeight.value * 2);
      c.stroke();
    }

    for (let y = 0; y < canvasHeight.value * 2; y += gridSize) {
      c.beginPath();
      c.moveTo(-canvasWidth.value, y - canvasHeight.value / 2);
      c.lineTo(canvasWidth.value * 2, y - canvasHeight.value / 2);
      c.stroke();
    }
  } else if (sf.wallpaper === 'dots') {
    c.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
    for (let x = 0; x < canvasWidth.value * 2; x += gridSize) {
      for (let y = 0; y < canvasHeight.value * 2; y += gridSize) {
        c.beginPath();
        c.arc(x - canvasWidth.value / 2, y - canvasHeight.value / 2, 2, 0, Math.PI * 2);
        c.fill();
      }
    }
  } else if (sf.wallpaper === 'lines') {
    c.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.1})`;
    c.lineWidth = 1;
    for (let y = 0; y < canvasHeight.value * 2; y += gridSize) {
      c.beginPath();
      c.moveTo(-canvasWidth.value, y - canvasHeight.value / 2);
      c.lineTo(canvasWidth.value * 2, y - canvasHeight.value / 2);
      c.stroke();
    }
  }
}

function drawConnections(c: CanvasRenderingContext2D, rendered: RenderedNode, inheritedStructure?: string) {
  // Determine effective structure for this node
  const effectiveStructure = rendered.node.structure || inheritedStructure;

  rendered.children.forEach((child, index) => {
    // Use theme's line color, or branch colors if rainbow branches enabled for connections
    let color: string;
    if (theme.value.rainbowBranches && rendered.level === 0) {
      color = colors.value.branches[index % colors.value.branches.length] || colors.value.lines || '#3b82f6';
    } else {
      color = colors.value.lines || colors.value.branches[0] || '#94a3b8';
    }
    drawConnection(c, rendered, child, color, index, effectiveStructure);
    drawConnections(c, child, effectiveStructure);
  });
}

function drawConnection(
  c: CanvasRenderingContext2D,
  parent: RenderedNode,
  child: RenderedNode,
  color: string,
  _index: number,
  inheritedStructure?: string
) {
  c.strokeStyle = color;
  c.lineWidth = Math.max(1.5, 3 - child.level * 0.5);
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // Determine effective structure: node's own structure overrides inherited, then global
  const effectiveStructure = parent.node.structure || inheritedStructure || store.structure;

  // Fishbone structure (either node-level or inherited): draw diagonal lines
  if (effectiveStructure === 'fishbone') {
    const startX = parent.x + parent.width / 2;
    const startY = parent.y + parent.height / 2;
    const endX = child.x + child.width / 2;
    const endY = child.y + child.height / 2;

    // Simple diagonal line for fishbone children
    c.beginPath();
    c.moveTo(startX, startY);
    c.lineTo(endX, endY);
    c.stroke();
    return;
  }

  const structure = effectiveStructure;

  // Org Chart / Tree: straight lines from bottom-center of parent to top-center of child
  if (structure === 'orgchart' || structure === 'tree') {
    const startX = parent.x + parent.width / 2;
    const startY = parent.y + parent.height;
    const endX = child.x + child.width / 2;
    const endY = child.y;

    // Draw elbow connection (straight lines with right angles)
    const midY = (startY + endY) / 2;

    c.beginPath();
    c.moveTo(startX, startY);
    c.lineTo(startX, midY);  // Vertical down from parent
    c.lineTo(endX, midY);    // Horizontal to align with child
    c.lineTo(endX, endY);    // Vertical down to child
    c.stroke();
    return;
  }

  // Logic Chart: straight horizontal lines with elbow
  if (structure === 'logic') {
    const startX = parent.x + parent.width;
    const startY = parent.y + parent.height / 2;
    const endX = child.x;
    const endY = child.y + child.height / 2;

    const midX = (startX + endX) / 2;

    c.beginPath();
    c.moveTo(startX, startY);
    c.lineTo(midX, startY);  // Horizontal from parent
    c.lineTo(midX, endY);    // Vertical to align with child
    c.lineTo(endX, endY);    // Horizontal to child
    c.stroke();
    return;
  }

  // Timeline: straight vertical/horizontal lines
  if (structure === 'timeline') {
    const startX = parent.x + parent.width / 2;
    const startY = parent.y + parent.height / 2;
    const endX = child.x + child.width / 2;
    const endY = child.y + child.height / 2;

    // Main timeline items: horizontal line to item, then vertical
    if (child.level === 1) {
      c.beginPath();
      c.moveTo(startX, startY);
      c.lineTo(endX, startY);  // Horizontal along timeline
      c.lineTo(endX, endY);    // Vertical to item
      c.stroke();
    } else {
      // Sub-items: vertical line
      c.beginPath();
      c.moveTo(startX, startY);
      c.lineTo(endX, endY);
      c.stroke();
    }
    return;
  }

  // Mind Map (default): curved S-lines
  const parentCenterY = parent.y + parent.height / 2;
  const childCenterY = child.y + child.height / 2;

  // Determine if child is to the right or left of parent
  const childIsRight = child.x > parent.x + parent.width / 2;

  let startX: number, startY: number, endX: number, endY: number;

  if (childIsRight) {
    // Child is on the right - connect from parent's right edge to child's left edge
    startX = parent.x + parent.width;
    startY = parentCenterY;
    endX = child.x;
    endY = childCenterY;
  } else {
    // Child is on the left - connect from parent's left edge to child's right edge
    startX = parent.x;
    startY = parentCenterY;
    endX = child.x + child.width;
    endY = childCenterY;
  }

  // Calculate control points for smooth S-curve
  const midX = (startX + endX) / 2;

  c.beginPath();
  c.moveTo(startX, startY);
  c.bezierCurveTo(
    midX, startY,  // First control point - horizontal from start
    midX, endY,    // Second control point - horizontal to end
    endX, endY
  );
  c.stroke();
}

function getRelationshipControlPoints(rel: typeof store.relationships[0], startX: number, startY: number, endX: number, endY: number) {
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Default control points create a smooth curve
  const defaultOffset = 50 * (rel.curvature || 0.3);
  const dx = endX - startX;
  const dy = endY - startY;
  const perpX = -dy * 0.3;
  const perpY = dx * 0.3;

  // Control point 1 (near source)
  const cp1 = rel.controlPoint1 || {
    x: midX + perpX - defaultOffset * 0.5,
    y: midY + perpY - defaultOffset
  };

  // Control point 2 (near target)
  const cp2 = rel.controlPoint2 || {
    x: midX - perpX + defaultOffset * 0.5,
    y: midY - perpY - defaultOffset
  };

  return { cp1, cp2, midX, midY };
}

// Helper to find a rendered node by ID (searches main tree and floating topics)
function findNodeInAllTrees(nodeId: string): RenderedNode | null {
  // First check main tree
  if (renderedRoot.value) {
    const node = findRenderedNodeById(renderedRoot.value, nodeId);
    if (node) return node;
  }

  // Then check floating topic trees
  for (const topic of store.floatingTopics) {
    if (topic.position) {
      const floatingRendered = layoutNodes(topic, 'mindmap', {
        centerX: topic.position.x + 60,
        centerY: topic.position.y + 20,
        startLevel: 1,
      });
      const node = findRenderedNodeById(floatingRendered, nodeId);
      if (node) return node;
    }
  }

  return null;
}

function drawRelationships(c: CanvasRenderingContext2D) {
  store.relationships.forEach(rel => {
    const sourceNode = findNodeInAllTrees(rel.sourceId);
    const targetNode = findNodeInAllTrees(rel.targetId);

    if (!sourceNode || !targetNode) return;

    const isSelected = selectedRelationshipId.value === rel.id;

    c.strokeStyle = rel.color;
    c.lineWidth = isSelected ? 3 : 2;
    c.setLineDash(rel.style === 'dashed' ? [8, 4] : rel.style === 'dotted' ? [2, 2] : []);

    const startX = sourceNode.x + sourceNode.width / 2;
    const startY = sourceNode.y + sourceNode.height / 2;
    const endX = targetNode.x + targetNode.width / 2;
    const endY = targetNode.y + targetNode.height / 2;

    // Get control points
    const { cp1, cp2 } = getRelationshipControlPoints(rel, startX, startY, endX, endY);

    // Calculate edge points for arrows (where line meets node boundary)
    const startEdge = getNodeEdgePoint(sourceNode, cp1.x, cp1.y);
    const endEdge = getNodeEdgePoint(targetNode, cp2.x, cp2.y);

    // Draw cubic Bezier curve (still from center to center for smooth curve)
    c.beginPath();
    c.moveTo(startX, startY);
    c.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endX, endY);
    c.stroke();

    // Draw end arrow (at target node edge)
    if (rel.endArrow) {
      const angle = Math.atan2(endEdge.y - cp2.y, endEdge.x - cp2.x);
      drawArrow(c, endEdge.x, endEdge.y, angle, rel.color);
    }

    // Draw start arrow (at source node edge)
    if (rel.startArrow) {
      const angle = Math.atan2(startEdge.y - cp1.y, startEdge.x - cp1.x);
      drawArrow(c, startEdge.x, startEdge.y, angle, rel.color);
    }

    // Draw label at curve midpoint (or with offset if set)
    // Calculate base position at t=0.5 on cubic Bezier
    const t = 0.5;
    const baseLabelX = Math.pow(1-t, 3) * startX + 3 * Math.pow(1-t, 2) * t * cp1.x + 3 * (1-t) * Math.pow(t, 2) * cp2.x + Math.pow(t, 3) * endX;
    const baseLabelY = Math.pow(1-t, 3) * startY + 3 * Math.pow(1-t, 2) * t * cp1.y + 3 * (1-t) * Math.pow(t, 2) * cp2.y + Math.pow(t, 3) * endY;

    // Apply offset if exists
    const labelX = baseLabelX + (rel.labelOffset?.x || 0);
    const labelY = baseLabelY + (rel.labelOffset?.y || 0);

    // Store label position for hit detection
    relationshipLabelPositions.set(rel.id, {
      x: labelX,
      y: labelY,
      baseX: baseLabelX,
      baseY: baseLabelY
    });

    if (rel.label || isSelected) {
      const labelText = rel.label || (isSelected ? 'Double-click to add label' : '');
      c.font = '12px sans-serif';
      const metrics = c.measureText(labelText);
      const padding = 6;
      const labelWidth = metrics.width + padding * 2;
      const labelHeight = 20;

      // Draw label background
      c.fillStyle = rel.label ? 'rgba(30, 30, 30, 0.9)' : 'rgba(30, 30, 30, 0.5)';
      c.beginPath();
      c.roundRect(labelX - labelWidth / 2, labelY - labelHeight / 2 - 2, labelWidth, labelHeight, 4);
      c.fill();

      // Draw label border when selected
      if (isSelected) {
        c.strokeStyle = rel.color;
        c.lineWidth = 1;
        c.stroke();
      }

      // Draw label text
      c.fillStyle = rel.label ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(labelText, labelX, labelY - 2);
    }

    c.setLineDash([]);

    // Draw control point handles when selected
    if (isSelected) {
      // Draw lines from endpoints to control points
      c.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      c.lineWidth = 1;
      c.setLineDash([4, 4]);

      // Line from start to cp1
      c.beginPath();
      c.moveTo(startX, startY);
      c.lineTo(cp1.x, cp1.y);
      c.stroke();

      // Line from end to cp2
      c.beginPath();
      c.moveTo(endX, endY);
      c.lineTo(cp2.x, cp2.y);
      c.stroke();

      c.setLineDash([]);

      // Draw control point 1 handle
      c.fillStyle = '#3b82f6';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cp1.x, cp1.y, controlPointRadius, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Draw control point 2 handle
      c.beginPath();
      c.arc(cp2.x, cp2.y, controlPointRadius, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  });
}

function drawArrow(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string
) {
  const size = 10;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(
    x - size * Math.cos(angle - Math.PI / 6),
    y - size * Math.sin(angle - Math.PI / 6)
  );
  c.lineTo(
    x - size * Math.cos(angle + Math.PI / 6),
    y - size * Math.sin(angle + Math.PI / 6)
  );
  c.closePath();
  c.fill();
}

function drawBoundaries(c: CanvasRenderingContext2D) {
  // Clear previous bounds
  boundaryBounds.clear();

  store.boundaries.forEach(boundary => {
    const nodes = boundary.nodeIds
      .map(id => renderedRoot.value ? findRenderedNodeById(renderedRoot.value, id) : null)
      .filter(Boolean) as RenderedNode[];

    if (nodes.length === 0) return;

    // Calculate bounding box with padding
    const padding = 25;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      minX = Math.min(minX, node.x - padding);
      minY = Math.min(minY, node.y - padding);
      maxX = Math.max(maxX, node.x + node.width + padding);
      maxY = Math.max(maxY, node.y + node.height + padding);
    });

    // Store bounds for hit detection
    boundaryBounds.set(boundary.id, { minX, minY, maxX, maxY });

    const width = maxX - minX;
    const height = maxY - minY;

    const isSelected = selectedBoundaryId.value === boundary.id;

    c.fillStyle = boundary.backgroundColor;
    c.strokeStyle = isSelected ? '#3b82f6' : boundary.color;
    c.lineWidth = isSelected ? 3 : 2;
    c.setLineDash([]);

    switch (boundary.shape) {
      case 'rounded':
        drawBoundaryRounded(c, minX, minY, width, height, 15);
        break;
      case 'rectangle':
        c.fillRect(minX, minY, width, height);
        c.strokeRect(minX, minY, width, height);
        break;
      case 'cloud':
        drawBoundaryCloud(c, minX, minY, width, height);
        break;
      case 'wave':
        drawBoundaryWave(c, minX, minY, width, height);
        break;
      default:
        drawBoundaryRounded(c, minX, minY, width, height, 15);
    }

    // Draw label if present
    if (boundary.label) {
      const labelMargin = 12; // Margin from edges for left/right alignment
      const labelPadding = 6;
      const labelFont = 'bold 12px system-ui, sans-serif';
      c.font = labelFont;

      const textMetrics = c.measureText(boundary.label);
      const labelWidth = textMetrics.width + labelPadding * 2;
      const labelHeight = 18;

      // Calculate label X position based on alignment
      const align = boundary.labelAlign || 'center';
      let labelX: number;
      let textAlign: CanvasTextAlign;

      switch (align) {
        case 'left':
          labelX = minX + labelMargin;
          textAlign = 'left';
          break;
        case 'right':
          labelX = maxX - labelMargin;
          textAlign = 'right';
          break;
        case 'center':
        default:
          labelX = minX + width / 2;
          textAlign = 'center';
          break;
      }

      // Calculate background box position
      let bgX: number;
      switch (align) {
        case 'left':
          bgX = labelX - labelPadding;
          break;
        case 'right':
          bgX = labelX - textMetrics.width - labelPadding;
          break;
        case 'center':
        default:
          bgX = labelX - labelWidth / 2;
          break;
      }

      const labelY = minY - labelHeight / 2 - 2;

      // Draw label background
      c.fillStyle = boundary.backgroundColor || 'rgba(255, 255, 255, 0.95)';
      c.beginPath();
      const bgRadius = 4;
      c.roundRect(bgX, labelY - labelHeight / 2, labelWidth, labelHeight, bgRadius);
      c.fill();

      // Draw label border
      c.strokeStyle = boundary.color;
      c.lineWidth = 1.5;
      c.stroke();

      // Draw label text
      c.fillStyle = boundary.color;
      c.font = labelFont;
      c.textAlign = textAlign;
      c.textBaseline = 'middle';
      c.fillText(boundary.label, labelX, labelY);
    }
  });
}

function drawBoundaryRounded(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  c.fill();
  c.stroke();
}

function drawBoundaryCloud(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
) {
  // Draw a simple rounded rectangle with scalloped edges
  const scallop = 12;
  const padding = scallop;

  // Adjust bounds to account for scallops
  const innerX = x + padding;
  const innerY = y + padding;
  const innerW = w - padding * 2;
  const innerH = h - padding * 2;

  c.beginPath();

  // Calculate number of scallops for each edge
  const topScallops = Math.max(3, Math.round(innerW / 40));
  const sideScallops = Math.max(2, Math.round(innerH / 40));

  // Start at top-left
  c.moveTo(innerX, innerY);

  // Top edge scallops
  const topStep = innerW / topScallops;
  for (let i = 0; i < topScallops; i++) {
    const sx = innerX + i * topStep;
    const ex = innerX + (i + 1) * topStep;
    const midX = (sx + ex) / 2;
    c.quadraticCurveTo(midX, innerY - scallop, ex, innerY);
  }

  // Right edge scallops
  const rightStep = innerH / sideScallops;
  for (let i = 0; i < sideScallops; i++) {
    const sy = innerY + i * rightStep;
    const ey = innerY + (i + 1) * rightStep;
    const midY = (sy + ey) / 2;
    c.quadraticCurveTo(innerX + innerW + scallop, midY, innerX + innerW, ey);
  }

  // Bottom edge scallops (reverse)
  for (let i = topScallops - 1; i >= 0; i--) {
    const ex = innerX + i * topStep;
    const sx = innerX + (i + 1) * topStep;
    const midX = (sx + ex) / 2;
    c.quadraticCurveTo(midX, innerY + innerH + scallop, ex, innerY + innerH);
  }

  // Left edge scallops (reverse)
  for (let i = sideScallops - 1; i >= 0; i--) {
    const ey = innerY + i * rightStep;
    const sy = innerY + (i + 1) * rightStep;
    const midY = (sy + ey) / 2;
    c.quadraticCurveTo(innerX - scallop, midY, innerX, ey);
  }

  c.closePath();
  c.fill();
  c.stroke();
}

function drawBoundaryWave(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
) {
  const waveHeight = 6;
  const numWaves = Math.max(4, Math.round(w / 50));
  const waveLength = w / numWaves;

  c.beginPath();

  // Start at top-left
  c.moveTo(x, y);

  // Top edge - wavy
  for (let i = 0; i < numWaves; i++) {
    const startX = x + i * waveLength;
    const endX = x + (i + 1) * waveLength;
    const midX = (startX + endX) / 2;
    c.quadraticCurveTo(midX, y - waveHeight, endX, y);
  }

  // Right edge - straight
  c.lineTo(x + w, y + h);

  // Bottom edge - wavy (reverse direction)
  for (let i = numWaves; i > 0; i--) {
    const startX = x + i * waveLength;
    const endX = x + (i - 1) * waveLength;
    const midX = (startX + endX) / 2;
    c.quadraticCurveTo(midX, y + h + waveHeight, endX, y + h);
  }

  // Left edge - straight back to start
  c.lineTo(x, y);

  c.closePath();
  c.fill();
  c.stroke();
}

// Draw summaries (bracket shapes that group children)
function drawSummaries(c: CanvasRenderingContext2D) {
  // Clear previous bounds
  summaryBounds.clear();

  store.summaries.forEach((summary: { id: string; parentNodeId: string; rangeStart: number; rangeEnd: number; topicId: string; topicText: string; color?: string; backgroundColor?: string }) => {
    // Find the parent node to get the summarized children
    if (!renderedRoot.value) return;

    const parentNode = findRenderedNodeById(renderedRoot.value, summary.parentNodeId);
    if (!parentNode) return;

    // Get the children in the range
    const startIdx = summary.rangeStart;
    const endIdx = Math.min(summary.rangeEnd, parentNode.children.length - 1);

    if (startIdx > parentNode.children.length - 1) return;

    const summarizedChildren = parentNode.children.slice(startIdx, endIdx + 1);
    if (summarizedChildren.length === 0) return;

    // Calculate bounding box of summarized children
    let minY = Infinity;
    let maxY = -Infinity;
    let bracketX = 0;
    let childMinX = Infinity;
    let childMaxX = -Infinity;

    // Determine bracket side based on first child's position relative to parent
    const firstChild = summarizedChildren[0];
    if (!firstChild) return;
    const isRightSide = firstChild.x > parentNode.x + parentNode.width / 2;

    summarizedChildren.forEach(child => {
      minY = Math.min(minY, child.y);
      maxY = Math.max(maxY, child.y + child.height);
      childMinX = Math.min(childMinX, child.x);
      childMaxX = Math.max(childMaxX, child.x + child.width);

      if (isRightSide) {
        // Bracket on the right side of children
        bracketX = Math.max(bracketX, child.x + child.width);
      } else {
        // Bracket on the left side of children
        bracketX = bracketX === 0 ? child.x : Math.min(bracketX, child.x);
      }
    });

    // Add padding
    const bracketPadding = 15;
    const bracketWidth = 12;

    if (isRightSide) {
      bracketX += bracketPadding;
    } else {
      bracketX -= bracketPadding;
    }

    const isSelected = selectedSummaryId.value === summary.id;
    const summaryColor = summary.color || colors.value.lines || '#64748b';

    // Store bounds for hit detection (include bracket and label area)
    const textPaddingForBounds = 8;
    const labelWidth = 100; // Approximate max label width
    if (isRightSide) {
      summaryBounds.set(summary.id, {
        minX: bracketX,
        minY: minY - 10,
        maxX: bracketX + bracketWidth + textPaddingForBounds + labelWidth,
        maxY: maxY + 10
      });
    } else {
      summaryBounds.set(summary.id, {
        minX: bracketX - bracketWidth - textPaddingForBounds - labelWidth,
        minY: minY - 10,
        maxX: bracketX,
        maxY: maxY + 10
      });
    }

    // Draw the bracket
    c.strokeStyle = isSelected ? '#3b82f6' : summaryColor;
    c.lineWidth = isSelected ? 3 : 2;
    c.setLineDash([]);

    const midY = (minY + maxY) / 2;
    const bracketCurve = 8;

    c.beginPath();
    if (isRightSide) {
      // Right-side bracket: ]
      c.moveTo(bracketX, minY);
      c.quadraticCurveTo(bracketX + bracketCurve, minY, bracketX + bracketCurve, minY + bracketCurve);
      c.lineTo(bracketX + bracketCurve, midY - bracketCurve);
      c.quadraticCurveTo(bracketX + bracketCurve, midY, bracketX + bracketWidth, midY);
      c.quadraticCurveTo(bracketX + bracketCurve, midY, bracketX + bracketCurve, midY + bracketCurve);
      c.lineTo(bracketX + bracketCurve, maxY - bracketCurve);
      c.quadraticCurveTo(bracketX + bracketCurve, maxY, bracketX, maxY);
    } else {
      // Left-side bracket: [
      c.moveTo(bracketX, minY);
      c.quadraticCurveTo(bracketX - bracketCurve, minY, bracketX - bracketCurve, minY + bracketCurve);
      c.lineTo(bracketX - bracketCurve, midY - bracketCurve);
      c.quadraticCurveTo(bracketX - bracketCurve, midY, bracketX - bracketWidth, midY);
      c.quadraticCurveTo(bracketX - bracketCurve, midY, bracketX - bracketCurve, midY + bracketCurve);
      c.lineTo(bracketX - bracketCurve, maxY - bracketCurve);
      c.quadraticCurveTo(bracketX - bracketCurve, maxY, bracketX, maxY);
    }
    c.stroke();

    // Draw summary topic text
    const textPadding = 8;
    const textX = isRightSide ? bracketX + bracketWidth + textPadding : bracketX - bracketWidth - textPadding;

    c.font = `${fonts.value.branchSize - 2}px ${fonts.value.branch}`;
    c.fillStyle = colors.value.branchText || '#1e293b';
    c.textAlign = isRightSide ? 'left' : 'right';
    c.textBaseline = 'middle';

    // Draw background for text
    const textMetrics = c.measureText(summary.topicText);
    const textHeight = fonts.value.branchSize;
    const bgPadding = 6;
    const bgX = isRightSide ? textX - bgPadding : textX - textMetrics.width - bgPadding;
    const bgWidth = textMetrics.width + bgPadding * 2;

    const bgColor = summary.backgroundColor || colors.value.subTopicBg || '#f1f5f9';
    c.fillStyle = bgColor;
    c.beginPath();
    const bgRadius = 4;
    c.roundRect(bgX, midY - textHeight / 2 - bgPadding / 2, bgWidth, textHeight + bgPadding, bgRadius);
    c.fill();

    // Draw border
    c.strokeStyle = isSelected ? '#3b82f6' : summaryColor;
    c.lineWidth = isSelected ? 2 : 1;
    c.stroke();

    // Draw text
    c.fillStyle = colors.value.subTopicText || colors.value.branchText || '#1e293b';
    c.fillText(summary.topicText, textX, midY);

    // Draw connecting line from bracket tip to text box
    c.strokeStyle = isSelected ? '#3b82f6' : summaryColor;
    c.lineWidth = isSelected ? 3 : 2;
    c.beginPath();
    if (isRightSide) {
      c.moveTo(bracketX + bracketWidth, midY);
      c.lineTo(textX - bgPadding, midY);
    } else {
      c.moveTo(bracketX - bracketWidth, midY);
      c.lineTo(textX + bgPadding, midY);
    }
    c.stroke();
  });
}


// Shape drawing functions
type NodeShapeType = 'rectangle' | 'rounded' | 'ellipse' | 'diamond' | 'parallelogram' | 'cloud' | 'capsule' | 'hexagon' | 'underline' | 'none';

function drawShape(
  c: CanvasRenderingContext2D,
  shape: NodeShapeType,
  x: number,
  y: number,
  w: number,
  h: number,
  fillOnly: boolean = false
) {
  c.beginPath();

  switch (shape) {
    case 'rectangle':
      c.rect(x, y, w, h);
      break;

    case 'rounded':
      const r = Math.min(h / 3, 10);
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      break;

    case 'ellipse':
      c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;

    case 'diamond':
      c.moveTo(x + w / 2, y);
      c.lineTo(x + w, y + h / 2);
      c.lineTo(x + w / 2, y + h);
      c.lineTo(x, y + h / 2);
      break;

    case 'parallelogram':
      const skew = w * 0.15;
      c.moveTo(x + skew, y);
      c.lineTo(x + w, y);
      c.lineTo(x + w - skew, y + h);
      c.lineTo(x, y + h);
      break;

    case 'cloud':
      // Draw cloud shape using bezier curves
      const rw = w / 2;
      const rh = h / 2;
      c.moveTo(x + rw * 0.5, y + rh);
      c.bezierCurveTo(x - rw * 0.1, y + rh * 0.3, x + rw * 0.2, y - rh * 0.3, x + rw, y + rh * 0.2);
      c.bezierCurveTo(x + rw * 1.3, y - rh * 0.2, x + w + rw * 0.1, y + rh * 0.5, x + w - rw * 0.2, y + rh);
      c.bezierCurveTo(x + w + rw * 0.1, y + h - rh * 0.2, x + w - rw * 0.3, y + h + rh * 0.1, x + rw, y + h - rh * 0.1);
      c.bezierCurveTo(x + rw * 0.5, y + h + rh * 0.2, x - rw * 0.1, y + h - rh * 0.3, x + rw * 0.5, y + rh);
      break;

    case 'capsule':
      const capsuleR = h / 2;
      c.moveTo(x + capsuleR, y);
      c.lineTo(x + w - capsuleR, y);
      c.arc(x + w - capsuleR, y + capsuleR, capsuleR, -Math.PI / 2, Math.PI / 2);
      c.lineTo(x + capsuleR, y + h);
      c.arc(x + capsuleR, y + capsuleR, capsuleR, Math.PI / 2, -Math.PI / 2);
      break;

    case 'hexagon':
      const hexInset = w * 0.15;
      c.moveTo(x + hexInset, y);
      c.lineTo(x + w - hexInset, y);
      c.lineTo(x + w, y + h / 2);
      c.lineTo(x + w - hexInset, y + h);
      c.lineTo(x + hexInset, y + h);
      c.lineTo(x, y + h / 2);
      break;

    case 'underline':
      // Just draw an underline, no shape fill
      if (!fillOnly) {
        c.moveTo(x, y + h);
        c.lineTo(x + w, y + h);
        c.stroke();
      }
      return; // Don't fill or close path

    case 'none':
      return; // Don't draw anything

    default:
      // Default to rounded rect
      const defaultR = Math.min(h / 3, 6);
      c.moveTo(x + defaultR, y);
      c.arcTo(x + w, y, x + w, y + h, defaultR);
      c.arcTo(x + w, y + h, x, y + h, defaultR);
      c.arcTo(x, y + h, x, y, defaultR);
      c.arcTo(x, y, x + w, y, defaultR);
  }

  c.closePath();
  c.fill();
  if (!fillOnly) {
    c.stroke();
  }
}

// Get all node IDs in the selected branch (for focus mode)
function getSelectedBranchIds(): Set<string> {
  const ids = new Set<string>();
  const selectedIds = store.canvasState.selectedNodeIds;

  if (selectedIds.length === 0) return ids;

  // For each selected node, add it and all its ancestors and descendants
  selectedIds.forEach(selectedId => {
    // Add the selected node
    ids.add(selectedId);

    // Add all ancestors
    let currentId = selectedId;
    while (currentId) {
      const parent = store.findParentNode(currentId);
      if (parent) {
        ids.add(parent.id);
        currentId = parent.id;
      } else {
        break;
      }
    }

    // Add all descendants
    const addDescendants = (node: typeof store.root) => {
      ids.add(node.id);
      node.children.forEach(addDescendants);
    };

    const selectedNode = store.findNodeById(selectedId);
    if (selectedNode) {
      addDescendants(selectedNode);
    }
  });

  return ids;
}

// Get all node IDs that have ANY of the filtered tags (and their ancestors/descendants)
function getTagFilteredNodeIds(): Set<string> {
  const ids = new Set<string>();
  const tagFilters = props.tagFilters || [];

  if (tagFilters.length === 0) return ids;

  // Helper to check if a node has any of the filtered tags
  function hasMatchingTag(node: typeof store.root): boolean {
    return node.labels.some(label => tagFilters.includes(label.text));
  }

  // Helper to collect node and all its descendants
  function collectDescendants(node: typeof store.root) {
    ids.add(node.id);
    node.children.forEach(collectDescendants);
  }

  // Helper to collect ancestors
  function collectAncestors(nodeId: string, current: typeof store.root, path: string[] = []): boolean {
    if (current.id === nodeId) {
      path.forEach(id => ids.add(id));
      return true;
    }
    for (const child of current.children) {
      if (collectAncestors(nodeId, child, [...path, current.id])) {
        return true;
      }
    }
    return false;
  }

  // Find all nodes with matching tags
  function findMatchingNodes(node: typeof store.root) {
    if (hasMatchingTag(node)) {
      ids.add(node.id);
      // Add ancestors
      collectAncestors(node.id, store.root);
      // Add descendants
      node.children.forEach(collectDescendants);
    }
    node.children.forEach(findMatchingNodes);
  }

  findMatchingNodes(store.root);
  store.floatingTopics.forEach(topic => {
    if (hasMatchingTag(topic)) {
      ids.add(topic.id);
      topic.children.forEach(collectDescendants);
    }
  });

  return ids;
}

function drawNodes(c: CanvasRenderingContext2D, rendered: RenderedNode) {
  const focusBranchIds = props.focusMode ? getSelectedBranchIds() : null;
  const tagFilteredIds = (props.tagFilters && props.tagFilters.length > 0) ? getTagFilteredNodeIds() : null;
  drawNodesRecursive(c, rendered, focusBranchIds, tagFilteredIds);
}

function drawNodesRecursive(c: CanvasRenderingContext2D, rendered: RenderedNode, focusBranchIds: Set<string> | null, tagFilteredIds: Set<string> | null) {
  drawNode(c, rendered, focusBranchIds, tagFilteredIds);
  rendered.children.forEach(child => drawNodesRecursive(c, child, focusBranchIds, tagFilteredIds));
}

function drawNode(c: CanvasRenderingContext2D, rendered: RenderedNode, focusBranchIds: Set<string> | null = null, tagFilteredIds: Set<string> | null = null) {
  const { node, x, y, width, height, level } = rendered;
  const isSelected = store.canvasState.selectedNodeIds.includes(node.id);
  const isHovered = store.canvasState.hoveredNodeId === node.id;

  // Focus mode: check if this node is in the focused branch
  const isInFocusBranch = !focusBranchIds || focusBranchIds.size === 0 || focusBranchIds.has(node.id);

  // Tag filter: check if this node matches the active tag filter
  const passesTagFilter = !tagFilteredIds || tagFilteredIds.size === 0 || tagFilteredIds.has(node.id);

  // Combine both filters - lower opacity if failing either filter
  const focusOpacity = (isInFocusBranch && passesTagFilter) ? 1 : 0.2;

  // Apply combined opacity to the entire node rendering
  c.globalAlpha = focusOpacity;

  // Get node shape from style, or use theme defaults based on level
  let nodeShape: NodeShapeType;
  if (node.style?.shape) {
    nodeShape = node.style.shape as NodeShapeType;
  } else if (level === 0) {
    // Root node uses theme's rootShape
    nodeShape = (theme.value.rootShape as NodeShapeType) || 'rounded';
  } else if (level === 1) {
    // Main branches use theme's branchShape
    nodeShape = (theme.value.branchShape as NodeShapeType) || 'rounded';
  } else {
    // Sub-topics use subTopicShape if defined, otherwise default to rounded
    nodeShape = (theme.value.subTopicShape as NodeShapeType) || 'rounded';
  }

  // Background color - use theme colors based on node level
  // Level 0: root node, Level 1: main branches, Level 2+: sub-topics
  let bgColor: string;
  if (node.style?.backgroundColor) {
    bgColor = node.style.backgroundColor;
  } else if (level === 0) {
    bgColor = colors.value.rootNode;
  } else if (level === 1) {
    // Main branches - use rainbow branches if enabled
    const branchIndex = theme.value.rainbowBranches
      ? (node.id.charCodeAt(0) + node.id.charCodeAt(node.id.length - 1)) % colors.value.branches.length
      : 0;
    bgColor = colors.value.branches[branchIndex] ?? colors.value.branches[0] ?? '#3b82f6';
  } else {
    // Sub-topics - use subTopicBg from theme
    bgColor = colors.value.subTopicBg ?? colors.value.branches[level % colors.value.branches.length] ?? '#f1f5f9';
  }

  c.fillStyle = bgColor;
  c.lineWidth = 1;

  // Handle underline shape specially - use theme line color for the underline
  if (nodeShape === 'underline') {
    c.strokeStyle = colors.value.lines || bgColor;
    c.lineWidth = 2;
    drawShape(c, nodeShape, x, y, width, height);
  } else if (nodeShape === 'none') {
    // No shape to draw, just show text
  } else {
    // Regular shapes with shadow
    c.strokeStyle = 'transparent';
    c.shadowColor = 'rgba(0, 0, 0, 0.1)';
    c.shadowBlur = 10;
    c.shadowOffsetX = 2;
    c.shadowOffsetY = 2;
    drawShape(c, nodeShape, x, y, width, height);
    c.shadowColor = 'transparent';
  }

  // Selection highlight - use rounded rect for underline/none shapes
  if (isSelected) {
    c.fillStyle = 'transparent';
    c.strokeStyle = '#3b82f6';
    c.lineWidth = 3;
    const highlightShape = (nodeShape === 'underline' || nodeShape === 'none') ? 'rounded' : nodeShape;
    drawShape(c, highlightShape, x - 3, y - 3, width + 6, height + 6);
  }

  // Hover highlight - use rounded rect for underline/none shapes
  if (isHovered && !isSelected) {
    c.fillStyle = 'transparent';
    c.strokeStyle = '#93c5fd';
    c.lineWidth = 2;
    const highlightShape = (nodeShape === 'underline' || nodeShape === 'none') ? 'rounded' : nodeShape;
    drawShape(c, highlightShape, x - 2, y - 2, width + 4, height + 4);
  }

  // Calculate markers width first (markers go inside the node, left of text)
  const markerSize = 16;
  const markerSpacing = 2;
  const markersCount = Math.min(node.markers.length, 5); // Show up to 5 markers
  const markersWidth = markersCount > 0 ? (markersCount * markerSize) + ((markersCount - 1) * markerSpacing) + 6 : 0;

  // Calculate content area
  const padding = 10;
  const contentStartX = x + padding + markersWidth;
  const textMaxWidth = width - padding * 2 - markersWidth - (node.children.length > 0 ? 20 : 0);

  // Draw markers inside the node, left side
  if (node.markers.length > 0) {
    let markerX = x + padding;
    const markerY = y + height / 2;

    node.markers.slice(0, 5).forEach(marker => {
      // Handle clipart markers (they have category='clipart' and value contains the emoji)
      if (marker.category === 'clipart' && marker.value) {
        c.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(marker.value, markerX + markerSize / 2, markerY);
        markerX += markerSize + markerSpacing;
        return;
      }

      // Get marker display info based on ID
      const markerInfo = getMarkerDisplay(marker.id, marker.color);

      c.textAlign = 'center';
      c.textBaseline = 'middle';

      if (markerInfo.type === 'badge') {
        // Numbered badge (priority, month) - draw as small colored circle with number
        c.fillStyle = markerInfo.bg || '#3b82f6';
        c.beginPath();
        c.arc(markerX + markerSize / 2, markerY, markerSize / 2 - 1, 0, Math.PI * 2);
        c.fill();

        c.fillStyle = markerInfo.textColor || 'white';
        c.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
        c.fillText(markerInfo.label || '', markerX + markerSize / 2, markerY);
      } else if (markerInfo.type === 'emoji') {
        // Emoji marker
        c.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
        c.fillText(markerInfo.emoji || '', markerX + markerSize / 2, markerY);
      } else if (markerInfo.type === 'icon') {
        // Icon marker (stars, flags, arrows, etc.)
        if (markerInfo.bg) {
          c.fillStyle = markerInfo.bg;
          c.beginPath();
          c.arc(markerX + markerSize / 2, markerY, markerSize / 2 - 1, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = 'white';
        } else {
          c.fillStyle = markerInfo.color || marker.color || '#3b82f6';
        }
        c.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        c.fillText(markerInfo.icon || '', markerX + markerSize / 2, markerY);
      } else {
        // Default circle fallback
        c.fillStyle = marker.color || '#f59e0b';
        c.beginPath();
        c.arc(markerX + markerSize / 2, markerY, 5, 0, Math.PI * 2);
        c.fill();
      }

      markerX += markerSize + markerSpacing;
    });
  }

  // Text - positioned after markers
  // Use theme fonts and colors
  const fontConfig = fonts.value;
  const themeColors = colors.value;

  // Helper to determine if a color is dark (for contrast calculation)
  function isColorDark(color: string): boolean {
    // Parse hex color
    let r = 0, g = 0, b = 0;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        r = parseInt((hex[0] || '0') + (hex[0] || '0'), 16);
        g = parseInt((hex[1] || '0') + (hex[1] || '0'), 16);
        b = parseInt((hex[2] || '0') + (hex[2] || '0'), 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    }
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  // Determine text color based on background for proper contrast
  // For underline/none shapes, use canvas background for contrast check since node has no fill
  const effectiveBgColor = (nodeShape === 'underline' || nodeShape === 'none')
    ? (themeColors.background || '#ffffff')
    : bgColor;

  let textColor: string;
  if (level === 0) {
    textColor = themeColors.rootNodeText || '#ffffff';
  } else if (level === 1) {
    // For branches, check if effective background is dark and auto-adjust if needed
    const branchBgIsDark = isColorDark(effectiveBgColor);
    textColor = branchBgIsDark ? '#ffffff' : (themeColors.branchText || '#1f2937');
  } else {
    // For sub-topics, check if effective background is dark and auto-adjust
    const subTopicBgIsDark = isColorDark(effectiveBgColor);
    textColor = subTopicBgIsDark ? '#ffffff' : (themeColors.subTopicText || '#1f2937');
  }

  c.fillStyle = textColor;

  // Determine font based on level
  const fontFamily = level === 0
    ? (fontConfig?.root || 'system-ui, sans-serif')
    : level === 1
      ? (fontConfig?.branch || 'system-ui, sans-serif')
      : (fontConfig?.subTopic || 'system-ui, sans-serif');

  const fontSize = level === 0
    ? (fontConfig?.rootSize || 18)
    : level === 1
      ? (fontConfig?.branchSize || 14)
      : (fontConfig?.subTopicSize || 13);

  const fontWeight = level === 0
    ? (fontConfig?.rootWeight || 700)
    : level === 1
      ? (fontConfig?.branchWeight || 600)
      : (fontConfig?.subTopicWeight || 400);

  c.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  c.textAlign = 'left';
  c.textBaseline = 'middle';

  let displayText = node.text;
  // Truncate text if too long
  while (c.measureText(displayText).width > textMaxWidth && displayText.length > 3) {
    displayText = displayText.slice(0, -4) + '...';
  }

  const textX = markersWidth > 0 ? contentStartX : x + width / 2;
  if (markersWidth > 0) {
    c.textAlign = 'left';
    c.fillText(displayText, textX, y + height / 2);
  } else {
    c.textAlign = 'center';
    c.fillText(displayText, x + width / 2, y + height / 2);
  }

  // Collapse indicator
  if (node.children.length > 0) {
    const indicatorSize = 16;
    const indicatorX = x + width - 5;
    const indicatorY = y + height / 2;

    c.fillStyle = 'rgba(255, 255, 255, 0.3)';
    c.beginPath();
    c.arc(indicatorX, indicatorY, indicatorSize / 2, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#ffffff';
    c.font = '12px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(
      node.collapsed ? '+' : '−',
      indicatorX,
      indicatorY + 1
    );
  }

  // Notes and Comments indicators - show small icons at bottom-right if node has notes/comments
  const hasNotes = node.notes && node.notes.trim().length > 0;
  const hasComments = node.comments && node.comments.length > 0;

  if (hasNotes || hasComments) {
    c.fillStyle = 'rgba(255, 255, 255, 0.8)';
    c.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    let iconOffset = 0;

    // Comments indicator (show first if has both)
    if (hasComments) {
      const commentsIconX = x + width - 14 - iconOffset;
      const commentsIconY = y + height - 10;
      c.fillText('💬', commentsIconX, commentsIconY);
      iconOffset += 16;
    }

    // Notes indicator
    if (hasNotes) {
      const notesIconX = x + width - 14 - iconOffset;
      const notesIconY = y + height - 10;
      c.fillText('📝', notesIconX, notesIconY);
    }
  }

  // Smart checkbox roll-up: Show aggregated progress bar if all children have tasks
  const childrenProgress = store.calculateChildrenProgress(node.id);
  if (childrenProgress !== null) {
    // Draw progress bar at the bottom of the node
    const barHeight = 4;
    const barY = y + height - barHeight - 2;
    const barX = x + 4;
    const barWidth = width - 8;

    // Background bar
    c.fillStyle = 'rgba(0, 0, 0, 0.2)';
    c.beginPath();
    c.roundRect(barX, barY, barWidth, barHeight, 2);
    c.fill();

    // Progress fill
    const progressWidth = (barWidth * childrenProgress) / 100;
    if (progressWidth > 0) {
      // Color based on progress
      const progressColor = childrenProgress >= 100
        ? '#22c55e'  // Green for complete
        : childrenProgress >= 50
          ? '#f59e0b' // Amber for in-progress
          : '#3b82f6'; // Blue for started
      c.fillStyle = progressColor;
      c.beginPath();
      c.roundRect(barX, barY, progressWidth, barHeight, 2);
      c.fill();
    }

    // Progress text (small percentage)
    c.fillStyle = 'rgba(255, 255, 255, 0.9)';
    c.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText(`${childrenProgress}%`, x + 6, y + height + 2);
  }

  // Reset text alignment and global alpha
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.globalAlpha = 1;
}


// ============================================
// Draw Floating Clipart
// ============================================

function drawFloatingClipart(c: CanvasRenderingContext2D, clipart: { id: string; icon: string; position: { x: number; y: number }; size?: number }) {
  const size = clipart.size || 48;
  const x = clipart.position.x;
  const y = clipart.position.y;

  // Draw the clipart emoji centered at position
  c.font = `${size}px -apple-system, BlinkMacSystemFont, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(clipart.icon, x, y);

  // Reset text alignment
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
}

// ============================================
// Hit Detection for Boundaries and Summaries
// ============================================

function findBoundaryAtPosition(pos: Position): string | null {
  for (const [boundaryId, bounds] of boundaryBounds.entries()) {
    if (pos.x >= bounds.minX && pos.x <= bounds.maxX &&
        pos.y >= bounds.minY && pos.y <= bounds.maxY) {
      return boundaryId;
    }
  }
  return null;
}

function findSummaryAtPosition(pos: Position): string | null {
  for (const [summaryId, bounds] of summaryBounds.entries()) {
    if (pos.x >= bounds.minX && pos.x <= bounds.maxX &&
        pos.y >= bounds.minY && pos.y <= bounds.maxY) {
      return summaryId;
    }
  }
  return null;
}

// ============================================
// Event Handlers
// ============================================

function handleMouseDown(e: MouseEvent) {
  // Close context menu on any click
  contextMenu.value.show = false;

  // Cancel editing if clicking elsewhere
  if (editingNode.value) {
    finishEditing();
  }

  const pos = getMousePosition(e);
  lastMousePos.value = pos;

  const clickedNode = findNodeAtPosition(pos);

  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    // Middle click or Alt+click: start panning
    isPanning.value = true;
    dragStart.value = pos;
    return;
  }

  // Handle link mode
  if (store.canvasState.linkMode.active && clickedNode && e.button === 0) {
    store.completeLinkMode(clickedNode.node.id);
    render();
    return;
  }

  if (e.button === 0) {
    // Left click

    // First, check if clicking on a control point handle (highest priority)
    const controlPoint = findControlPointAtPosition(pos);
    if (controlPoint) {
      draggingControlPoint.value = controlPoint;
      render();
      return;
    }

    // Check if clicking on a relationship label (to drag it)
    const clickedLabelRelId = findRelationshipLabelAtPosition(pos);
    if (clickedLabelRelId && selectedRelationshipId.value === clickedLabelRelId) {
      draggingRelationshipLabel.value = { relId: clickedLabelRelId, startPos: pos };
      render();
      return;
    }

    // Check if clicking on a relationship line
    const clickedRelId = findRelationshipAtPosition(pos);
    if (clickedRelId && !clickedNode) {
      store.selectRelationship(clickedRelId);
      render();
      return;
    }

    // Check if clicking on a summary (higher priority than boundary since summaries are smaller)
    const clickedSummaryId = findSummaryAtPosition(pos);
    if (clickedSummaryId && !clickedNode) {
      store.selectSummary(clickedSummaryId);
      render();
      return;
    }

    // Check if clicking on a boundary
    const clickedBoundaryId = findBoundaryAtPosition(pos);
    if (clickedBoundaryId && !clickedNode) {
      store.selectBoundary(clickedBoundaryId);
      render();
      return;
    }

    if (clickedNode) {
      // Deselect relationship when clicking a node
      store.selectRelationship(null);

      if (e.shiftKey) {
        store.selectNode(clickedNode.node.id, true);
      } else {
        store.selectNode(clickedNode.node.id);
      }

      // Check if clicked on collapse indicator
      const indicatorX = clickedNode.x + clickedNode.width - 5;
      const indicatorY = clickedNode.y + clickedNode.height / 2;
      const dist = Math.sqrt(
        Math.pow(pos.x - indicatorX, 2) + Math.pow(pos.y - indicatorY, 2)
      );

      if (dist < 10 && clickedNode.node.children.length > 0) {
        store.toggleCollapse(clickedNode.node.id);
        updateLayout();
        render();
        return;
      }

      // Start dragging the node
      isDragging.value = true;
      draggedNode.value = clickedNode;
      dragOffset.value = {
        x: pos.x - clickedNode.x,
        y: pos.y - clickedNode.y,
      };
      // Store original position to detect if drag actually occurred
      dragStartNodePos.value = { x: clickedNode.x, y: clickedNode.y };
      hasDraggedSignificantly.value = false;
    } else {
      // Click on empty space - clearSelection also clears selectedRelationshipId
      store.clearSelection();

      // Start selection box
      store.canvasState.selectionBox = { start: pos, end: pos };
    }
  }

  render();
}

function handleMouseMove(e: MouseEvent) {
  const pos = getMousePosition(e);

  if (isPanning.value && lastMousePos.value) {
    const dx = pos.x - lastMousePos.value.x;
    const dy = pos.y - lastMousePos.value.y;
    store.setPan(store.viewState.panX + dx, store.viewState.panY + dy);
    render();
  } else if (draggingControlPoint.value) {
    // Dragging a relationship control point
    const { relId, point } = draggingControlPoint.value;
    const updateKey = point === 1 ? 'controlPoint1' : 'controlPoint2';
    store.updateRelationship(relId, { [updateKey]: { x: pos.x, y: pos.y } }, false);
    render();
  } else if (draggingRelationshipLabel.value) {
    // Dragging a relationship label
    const { relId } = draggingRelationshipLabel.value;
    const labelPos = relationshipLabelPositions.get(relId);
    if (labelPos) {
      // Calculate new offset from base position
      const newOffsetX = pos.x - labelPos.baseX;
      const newOffsetY = pos.y - labelPos.baseY;
      store.updateRelationship(relId, { labelOffset: { x: newOffsetX, y: newOffsetY } }, false);
      render();
    }
  } else if (isDragging.value && draggedNode.value) {
    // Move the dragged node visually
    draggedNode.value.x = pos.x - dragOffset.value.x;
    draggedNode.value.y = pos.y - dragOffset.value.y;

    // Check if node has moved significantly from starting position
    if (dragStartNodePos.value && !hasDraggedSignificantly.value) {
      const dx = draggedNode.value.x - dragStartNodePos.value.x;
      const dy = draggedNode.value.y - dragStartNodePos.value.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasDraggedSignificantly.value = true;
      }
    }
    render();
  } else if (store.canvasState.selectionBox) {
    store.canvasState.selectionBox.end = pos;
    render();
  } else {
    // Hover detection - update cursor based on what's under mouse
    const controlPoint = findControlPointAtPosition(pos);
    const hoveredLabel = findRelationshipLabelAtPosition(pos);
    const hoveredNode = findNodeAtPosition(pos);
    const hoveredRel = !hoveredNode ? findRelationshipAtPosition(pos) : null;

    // Update cursor
    if (canvasRef.value) {
      if (controlPoint) {
        canvasRef.value.style.cursor = 'grab';
      } else if (hoveredLabel && selectedRelationshipId.value === hoveredLabel) {
        canvasRef.value.style.cursor = 'move';
      } else if (hoveredRel) {
        canvasRef.value.style.cursor = 'pointer';
      } else if (hoveredNode) {
        canvasRef.value.style.cursor = 'move';
      } else {
        canvasRef.value.style.cursor = 'default';
      }
    }

    const newHoveredId = hoveredNode?.node.id || null;
    if (newHoveredId !== store.canvasState.hoveredNodeId) {
      store.canvasState.hoveredNodeId = newHoveredId;
      render();
    }
  }

  lastMousePos.value = pos;
}

function handleMouseUp(e: MouseEvent) {
  const pos = getMousePosition(e);

  if (store.canvasState.selectionBox) {
    // Select nodes in box
    const box = store.canvasState.selectionBox;
    const minX = Math.min(box.start.x, box.end.x);
    const maxX = Math.max(box.start.x, box.end.x);
    const minY = Math.min(box.start.y, box.end.y);
    const maxY = Math.max(box.start.y, box.end.y);

    // Only select if the box has some size (not just a click)
    if (Math.abs(maxX - minX) > 5 || Math.abs(maxY - minY) > 5) {
      allNodes.value.forEach(node => {
        if (
          node.x >= minX && node.x + node.width <= maxX &&
          node.y >= minY && node.y + node.height <= maxY
        ) {
          store.selectNode(node.node.id, true);
        }
      });
    }

    store.canvasState.selectionBox = null;
  }

  // Handle control point drag end - save to history
  if (draggingControlPoint.value) {
    const { relId, point } = draggingControlPoint.value;
    const rel = store.relationships.find(r => r.id === relId);
    if (rel) {
      // Save the final position to history
      const updateKey = point === 1 ? 'controlPoint1' : 'controlPoint2';
      const controlPoint = point === 1 ? rel.controlPoint1 : rel.controlPoint2;
      if (controlPoint) {
        store.updateRelationship(relId, { [updateKey]: controlPoint }, true);
      }
    }
    draggingControlPoint.value = null;
  }

  // Handle relationship label drag end - save to history
  if (draggingRelationshipLabel.value) {
    const { relId } = draggingRelationshipLabel.value;
    const rel = store.relationships.find(r => r.id === relId);
    if (rel && rel.labelOffset) {
      // Save the final offset to history
      store.updateRelationship(relId, { labelOffset: rel.labelOffset }, true);
    }
    draggingRelationshipLabel.value = null;
  }

  // Handle node drop
  if (isDragging.value && draggedNode.value) {
    const dropTarget = findNodeAtPosition(pos);

    // Only process if node was actually dragged (not just clicked)
    if (hasDraggedSignificantly.value) {
      // Check if dropped on another node for reparenting
      if (dropTarget && dropTarget.node.id !== draggedNode.value.node.id) {
        // Reparent the node
        store.moveNode(draggedNode.value.node.id, dropTarget.node.id);
      } else {
        // Save the new position (center point, not top-left corner)
        // Layout expects position to be center of the node
        store.setNodePosition(draggedNode.value.node.id, {
          x: draggedNode.value.x + draggedNode.value.width / 2,
          y: draggedNode.value.y + draggedNode.value.height / 2,
        });
      }
    }
    // Re-layout after drag (or click to restore position)
    updateLayout();
  }

  isDragging.value = false;
  isPanning.value = false;
  dragStart.value = null;
  draggedNode.value = null;
  dragStartNodePos.value = null;
  hasDraggedSignificantly.value = false;
  render();
}

function handleDoubleClick(e: MouseEvent) {
  const pos = getMousePosition(e);
  const clickedNode = findNodeAtPosition(pos);

  // Check if double-clicking on a relationship label first
  const clickedLabelRelId = findRelationshipLabelAtPosition(pos);
  if (clickedLabelRelId) {
    startEditingRelationshipLabel(clickedLabelRelId);
    return;
  }

  // Check if double-clicking on a relationship line (to add label)
  const clickedRelId = findRelationshipAtPosition(pos);
  if (clickedRelId && !clickedNode) {
    store.selectRelationship(clickedRelId);
    startEditingRelationshipLabel(clickedRelId);
    return;
  }

  if (clickedNode) {
    // Show inline text editor
    const canvas = canvasRef.value;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Use CSS dimensions, not scaled canvas dimensions
    const cssWidth = canvasWidth.value;
    const cssHeight = canvasHeight.value;
    const screenX = (clickedNode.x - cssWidth / 2 + store.viewState.panX) * store.viewState.zoom + cssWidth / 2 + rect.left;
    const screenY = (clickedNode.y - cssHeight / 2 + store.viewState.panY) * store.viewState.zoom + cssHeight / 2 + rect.top;

    editingNode.value = {
      id: clickedNode.node.id,
      x: screenX,
      y: screenY,
      width: clickedNode.width * store.viewState.zoom,
      height: clickedNode.height * store.viewState.zoom,
      text: clickedNode.node.text,
    };

    nextTick(() => {
      textInputRef.value?.focus();
      textInputRef.value?.select();
    });
  } else {
    // Add floating topic
    store.addFloatingTopic(pos, 'New Topic');
    updateLayout();
    render();
  }
}

function startEditingRelationshipLabel(relId: string) {
  const rel = store.relationships.find(r => r.id === relId);
  if (!rel) return;

  const labelPos = relationshipLabelPositions.get(relId);
  if (!labelPos) return;

  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const cssWidth = canvasWidth.value;
  const cssHeight = canvasHeight.value;

  // Convert world coordinates to screen coordinates
  const screenX = (labelPos.x - cssWidth / 2 + store.viewState.panX) * store.viewState.zoom + cssWidth / 2 + rect.left;
  const screenY = (labelPos.y - cssHeight / 2 + store.viewState.panY) * store.viewState.zoom + cssHeight / 2 + rect.top;

  editingRelationshipLabel.value = {
    relId,
    x: screenX,
    y: screenY,
    text: rel.label || '',
  };

  nextTick(() => {
    relationshipLabelInputRef.value?.focus();
    relationshipLabelInputRef.value?.select();
  });
}

function finishEditingRelationshipLabel() {
  if (!editingRelationshipLabel.value) return;

  const { relId, text } = editingRelationshipLabel.value;
  store.updateRelationship(relId, { label: text.trim() || undefined });
  editingRelationshipLabel.value = null;
  render();
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault();
  const pos = getMousePosition(e);
  const clickedNode = findNodeAtPosition(pos);

  if (clickedNode) {
    store.selectNode(clickedNode.node.id);
  }

  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    nodeId: clickedNode?.node.id || null,
  };

  render();
}

function closeContextMenu() {
  contextMenu.value.show = false;
}

// Drag and drop handlers for clipart
function handleDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  if (!e.dataTransfer) return;

  try {
    const data = JSON.parse(e.dataTransfer.getData('application/json'));
    if (data.type === 'clipart') {
      // Get drop position in canvas coordinates
      const pos = getMousePosition(e);

      // Check if dropped on an existing node
      const targetNode = findNodeAtPosition(pos);

      if (targetNode) {
        // Add clipart as a marker/icon to the node
        store.addMarker(targetNode.node.id, {
          id: data.id,
          category: 'clipart',
          value: data.icon,
          color: '#3b82f6',
        });
      } else {
        // Add clipart as a standalone floating clipart (just the icon)
        store.addFloatingClipart(pos, data.icon, data.id);
      }

      updateLayout();
      render();
    }
  } catch {
    // Invalid drop data, ignore
  }
}

// Fit all nodes into view
function fitToView(padding = 50) {
  if (allNodes.value.length === 0) return;

  const bounds = getBoundingBox(allNodes.value);
  const contentWidth = bounds.maxX - bounds.minX + padding * 2;
  const contentHeight = bounds.maxY - bounds.minY + padding * 2;

  // Calculate zoom to fit content
  const zoomX = canvasWidth.value / contentWidth;
  const zoomY = canvasHeight.value / contentHeight;
  const newZoom = Math.min(zoomX, zoomY, 2); // Cap at 2x zoom

  // Calculate center of content
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  // Calculate pan to center content
  const newPanX = canvasWidth.value / 2 - centerX;
  const newPanY = canvasHeight.value / 2 - centerY;

  store.setZoom(newZoom);
  store.setPan(newPanX, newPanY);
  render();
}

// Get bounding box of all content
function getContentBounds(padding = 50) {
  if (allNodes.value.length === 0) {
    return { minX: 0, minY: 0, maxX: canvasWidth.value, maxY: canvasHeight.value, width: canvasWidth.value, height: canvasHeight.value };
  }

  const bounds = getBoundingBox(allNodes.value);
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
  };
}

// Render to an offscreen canvas for export (returns data URL)
function renderToImage(options: {
  mode: 'full' | 'visible';
  scale: number;
  format: 'png' | 'jpeg';
  quality?: number;
}): string | null {
  if (!renderedRoot.value) return null;

  const { mode, scale, format, quality = 0.92 } = options;

  // Create offscreen canvas
  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return null;

  let exportWidth: number;
  let exportHeight: number;
  let offsetX: number;
  let offsetY: number;
  let exportZoom: number;

  if (mode === 'full') {
    // Render entire mind map
    const bounds = getContentBounds(50);
    exportWidth = bounds.width * scale;
    exportHeight = bounds.height * scale;
    offsetX = -bounds.minX;
    offsetY = -bounds.minY;
    exportZoom = scale;
  } else {
    // Render visible area
    exportWidth = canvasWidth.value * scale;
    exportHeight = canvasHeight.value * scale;
    offsetX = store.viewState.panX;
    offsetY = store.viewState.panY;
    exportZoom = store.viewState.zoom * scale;
  }

  offscreen.width = exportWidth;
  offscreen.height = exportHeight;

  // Fill background with theme color
  offCtx.fillStyle = colors.value.background || canvasBackground.value;
  offCtx.fillRect(0, 0, exportWidth, exportHeight);

  // Apply transforms
  offCtx.save();
  if (mode === 'full') {
    offCtx.scale(exportZoom, exportZoom);
    offCtx.translate(offsetX, offsetY);
  } else {
    offCtx.translate(exportWidth / 2, exportHeight / 2);
    offCtx.scale(exportZoom, exportZoom);
    offCtx.translate(-canvasWidth.value / 2 + offsetX, -canvasHeight.value / 2 + offsetY);
  }

  // Draw all content
  drawConnections(offCtx, renderedRoot.value);
  drawRelationships(offCtx);
  drawBoundaries(offCtx);
  drawNodes(offCtx, renderedRoot.value);

  // Draw floating topics as mini mind maps (for minimap)
  store.floatingTopics.forEach(topic => {
    if (topic.position) {
      const floatingRendered = layoutNodes(topic, 'mindmap', {
        centerX: topic.position.x + 60,
        centerY: topic.position.y + 20,
        startLevel: 1,
      });
      drawConnections(offCtx, floatingRendered);
      drawNodes(offCtx, floatingRendered);
    }
  });

  // Draw floating cliparts
  store.floatingCliparts.forEach(clipart => {
    drawFloatingClipart(offCtx, clipart);
  });

  offCtx.restore();

  // Return as data URL
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return offscreen.toDataURL(mimeType, quality);
}

// Expose canvas dimensions, canvas element and render function for parent components
defineExpose({
  canvasWidth,
  canvasHeight,
  canvasRef,
  render,
  fitToView,
  getContentBounds,
  renderToImage,
});

function finishEditing() {
  if (editingNode.value) {
    store.updateNodeText(editingNode.value.id, editingNode.value.text);
    editingNode.value = null;
    updateLayout();
    render();
  }
}

function cancelEditing() {
  editingNode.value = null;
}

function handleEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    finishEditing();
  } else if (e.key === 'Escape') {
    cancelEditing();
  }
}

function handleWheel(e: WheelEvent) {
  e.preventDefault();

  if (e.ctrlKey) {
    // Zoom
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    store.setZoom(store.viewState.zoom * delta);
  } else {
    // Pan
    store.setPan(
      store.viewState.panX - e.deltaX,
      store.viewState.panY - e.deltaY
    );
  }

  render();
}

// Clipboard for copy/paste
const clipboard = ref<{ nodeId: string; mode: 'copy' | 'cut' } | null>(null);

function handleKeyDown(e: KeyboardEvent) {
  if (store.canvasState.editingNodeId) return;

  const selectedId = store.canvasState.selectedNodeIds[0];
  const selectedNode = selectedId ? store.findNodeById(selectedId) : null;

  switch (e.key) {
    case 'Tab':
      e.preventDefault();
      if (selectedId) {
        const newNode = store.addChild(selectedId);
        if (newNode) {
          store.selectNode(newNode.id);
          updateLayout();
          render();
        }
      }
      break;

    case 'Enter':
      e.preventDefault();
      if (selectedId) {
        const newNode = store.addSibling(selectedId);
        if (newNode) {
          store.selectNode(newNode.id);
          updateLayout();
          render();
        }
      }
      break;

    case 'Delete':
    case 'Backspace':
      if (selectedId && selectedId !== store.root.id) {
        store.deleteNode(selectedId);
        updateLayout();
        render();
      }
      break;

    case 'z':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        updateLayout();
        render();
      }
      break;

    case 'y':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        store.redo();
        updateLayout();
        render();
      }
      break;

    case 'c':
      if ((e.ctrlKey || e.metaKey) && selectedId) {
        e.preventDefault();
        clipboard.value = { nodeId: selectedId, mode: 'copy' };
      }
      break;

    case 'x':
      if ((e.ctrlKey || e.metaKey) && selectedId && selectedId !== store.root.id) {
        e.preventDefault();
        clipboard.value = { nodeId: selectedId, mode: 'cut' };
      }
      break;

    case 'v':
      if ((e.ctrlKey || e.metaKey) && clipboard.value && selectedId) {
        e.preventDefault();
        const sourceNode = store.findNodeById(clipboard.value.nodeId);
        if (sourceNode) {
          if (clipboard.value.mode === 'copy') {
            // Deep copy the node as a child of selected
            const newNode = store.addChild(selectedId, sourceNode.text);
            if (newNode) {
              store.selectNode(newNode.id);
            }
          } else if (clipboard.value.mode === 'cut' && clipboard.value.nodeId !== selectedId) {
            // Move the node (reparent)
            store.moveNode(clipboard.value.nodeId, selectedId);
            clipboard.value = null;
          }
          updateLayout();
          render();
        }
      }
      break;

    case 'a':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // Select all children of current parent
        if (selectedId && selectedNode) {
          const parent = store.findParentNode(selectedId);
          if (parent) {
            parent.children.forEach(child => {
              store.selectNode(child.id, true); // multi-select
            });
          }
        }
        render();
      }
      break;

    case 'g':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // Add boundary to selected nodes
        const selectedIds = store.canvasState.selectedNodeIds;
        if (selectedIds.length > 0) {
          store.addBoundary(selectedIds, '', 'rounded');
          render();
        }
      }
      break;

    case ' ':
      // Space to toggle collapse
      e.preventDefault();
      if (selectedId && selectedNode && selectedNode.children.length > 0) {
        store.toggleCollapse(selectedId);
        updateLayout();
        render();
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Move node up (swap with previous sibling)
        if (selectedId && selectedId !== store.root.id) {
          store.moveNodeUp(selectedId);
          updateLayout();
          render();
        }
      } else {
        // Navigate to previous sibling or parent
        if (selectedId && selectedNode) {
          const parent = store.findParentNode(selectedId);
          if (parent) {
            const siblings = parent.children;
            const currentIndex = siblings.findIndex(n => n.id === selectedId);
            if (currentIndex > 0) {
              const prevSibling = siblings[currentIndex - 1];
              if (prevSibling) store.selectNode(prevSibling.id);
            } else {
              // Go to parent
              store.selectNode(parent.id);
            }
            render();
          }
        }
      }
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Move node down (swap with next sibling)
        if (selectedId && selectedId !== store.root.id) {
          store.moveNodeDown(selectedId);
          updateLayout();
          render();
        }
      } else {
        // Navigate to next sibling
        if (selectedId && selectedNode) {
          const parent = store.findParentNode(selectedId);
          if (parent) {
            const siblings = parent.children;
            const currentIndex = siblings.findIndex(n => n.id === selectedId);
            if (currentIndex < siblings.length - 1) {
              const nextSibling = siblings[currentIndex + 1];
              if (nextSibling) store.selectNode(nextSibling.id);
              render();
            }
          }
        }
      }
      break;

    case 'ArrowLeft':
      e.preventDefault();
      if (selectedId && selectedNode) {
        if (selectedNode.children.length > 0 && !selectedNode.collapsed) {
          // Collapse if has children and expanded
          store.toggleCollapse(selectedId);
          updateLayout();
          render();
        } else {
          // Navigate to parent
          const parent = store.findParentNode(selectedId);
          if (parent) {
            store.selectNode(parent.id);
            render();
          }
        }
      }
      break;

    case 'ArrowRight':
      e.preventDefault();
      if (selectedId && selectedNode) {
        if (selectedNode.children.length > 0) {
          if (selectedNode.collapsed) {
            // Expand if collapsed
            store.toggleCollapse(selectedId);
            updateLayout();
            render();
          } else {
            // Navigate to first child
            const firstChild = selectedNode.children[0];
            if (firstChild) store.selectNode(firstChild.id);
            render();
          }
        }
      }
      break;

    case '=':
    case '+':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        store.setZoom(store.viewState.zoom * 1.1);
        render();
      }
      break;

    case '-':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        store.setZoom(store.viewState.zoom * 0.9);
        render();
      }
      break;

    case '0':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        store.resetView();
        render();
      }
      break;

    case 'Escape':
      if (store.canvasState.linkMode.active) {
        store.cancelLinkMode();
        render();
      }
      if (editingNode.value) {
        cancelEditing();
      }
      contextMenu.value.show = false;
      store.clearSelection();
      render();
      break;

    case 'F2':
      e.preventDefault();
      if (selectedId) {
        const node = renderedRoot.value ? findRenderedNodeById(renderedRoot.value, selectedId) : null;
        if (node) {
          const canvas = canvasRef.value;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            // Use CSS dimensions, not scaled canvas dimensions
            const cssWidth = canvasWidth.value;
            const cssHeight = canvasHeight.value;
            const screenX = (node.x - cssWidth / 2 + store.viewState.panX) * store.viewState.zoom + cssWidth / 2 + rect.left;
            const screenY = (node.y - cssHeight / 2 + store.viewState.panY) * store.viewState.zoom + cssHeight / 2 + rect.top;

            editingNode.value = {
              id: node.node.id,
              x: screenX,
              y: screenY,
              width: node.width * store.viewState.zoom,
              height: node.height * store.viewState.zoom,
              text: node.node.text,
            };

            nextTick(() => {
              textInputRef.value?.focus();
              textInputRef.value?.select();
            });
          }
        }
      }
      break;
  }
}

// ============================================
// Utility Functions
// ============================================

// Alias screenToWorld for backward compatibility
const getMousePosition = screenToWorld;

function resizeCanvas() {
  if (!containerRef.value || !canvasRef.value) return;

  const container = containerRef.value;
  const dpr = window.devicePixelRatio || 1;

  canvasWidth.value = container.clientWidth;
  canvasHeight.value = container.clientHeight;

  canvasRef.value.width = canvasWidth.value * dpr;
  canvasRef.value.height = canvasHeight.value * dpr;
  canvasRef.value.style.width = `${canvasWidth.value}px`;
  canvasRef.value.style.height = `${canvasHeight.value}px`;

  // DPR scaling is handled in render() to avoid accumulation issues

  updateLayout();
  render();
}

// ============================================
// Lifecycle
// ============================================

// ResizeObserver for container size changes
let resizeObserver: ResizeObserver | null = null;
let resizeTimeout: number | null = null;
let lastWidth = 0;
let lastHeight = 0;

onMounted(() => {
  if (canvasRef.value) {
    ctx.value = canvasRef.value.getContext('2d');
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', handleKeyDown);

  // Use ResizeObserver to detect container size changes (e.g., sidebar toggle)
  // Debounced to avoid rapid re-renders
  if (containerRef.value) {
    lastWidth = containerRef.value.clientWidth;
    lastHeight = containerRef.value.clientHeight;

    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const newWidth = entry.contentRect.width;
      const newHeight = entry.contentRect.height;

      // Only resize if dimensions actually changed significantly
      if (Math.abs(newWidth - lastWidth) > 1 || Math.abs(newHeight - lastHeight) > 1) {
        lastWidth = newWidth;
        lastHeight = newHeight;

        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = window.setTimeout(() => {
          resizeCanvas();
        }, 100);
      }
    });
    resizeObserver.observe(containerRef.value);
  }

  store.init();
  updateLayout();
  render();
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', handleKeyDown);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }
});

// Watch for store changes - watch currentMap for undo/redo support
watch(
  () => store.currentMap,
  () => {
    updateLayout();
    render();
  },
  { deep: true }
);

// Also watch structure specifically for immediate layout changes
watch(
  () => store.structure,
  () => {
    updateLayout();
    render();
  }
);

// Watch sheet format for background/wallpaper changes
watch(
  () => store.sheetFormat,
  () => {
    render();
  },
  { deep: true }
);

// Watch viewState for zoom/pan changes (triggered from footer controls)
watch(
  () => store.viewState.zoom,
  () => {
    render();
  }
);

watch(
  () => store.viewState.panX,
  () => {
    render();
  }
);

watch(
  () => store.viewState.panY,
  () => {
    render();
  }
);

// Watch focus mode changes
watch(
  () => props.focusMode,
  () => {
    render();
  }
);

// Watch tag filter changes
watch(
  () => props.tagFilters,
  () => {
    render();
  },
  { deep: true }
);

// Watch theme changes to re-render canvas with correct background
watch(
  isDark,
  () => {
    render();
  }
);
</script>

<template>
  <div
    ref="containerRef"
    class="w-full h-full overflow-hidden relative"
  >
    <canvas
      ref="canvasRef"
      :class="[
        isDragging ? 'cursor-grabbing' : isPanning ? 'cursor-move' : 'cursor-default'
      ]"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @dblclick="handleDoubleClick"
      @wheel="handleWheel"
      @contextmenu="handleContextMenu"
      @dragover="handleDragOver"
      @drop="handleDrop"
    />

    <!-- Inline Text Editor -->
    <input
      v-if="editingNode"
      ref="textInputRef"
      v-model="editingNode.text"
      type="text"
      class="fixed z-50 px-2 py-1 text-sm bg-white dark:bg-slate-800 border-2 border-blue-500 rounded outline-none shadow-lg"
      :style="{
        left: `${editingNode.x}px`,
        top: `${editingNode.y}px`,
        width: `${Math.max(editingNode.width, 150)}px`,
        height: `${editingNode.height}px`,
      }"
      @keydown="handleEditKeydown"
      @blur="finishEditing"
    />

    <!-- Relationship Label Editor -->
    <input
      v-if="editingRelationshipLabel"
      ref="relationshipLabelInputRef"
      v-model="editingRelationshipLabel.text"
      type="text"
      placeholder="Enter label"
      class="fixed z-50 px-3 py-1 text-sm bg-slate-800 text-white border-2 border-blue-500 rounded outline-none shadow-lg text-center"
      :style="{
        left: `${editingRelationshipLabel.x}px`,
        top: `${editingRelationshipLabel.y}px`,
        transform: 'translate(-50%, -50%)',
        minWidth: '120px',
      }"
      @keydown.enter.prevent="finishEditingRelationshipLabel"
      @keydown.escape.prevent="editingRelationshipLabel = null"
      @blur="finishEditingRelationshipLabel"
    />

    <!-- Context Menu -->
    <ContextMenu
      v-if="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :node-id="contextMenu.nodeId"
      @close="closeContextMenu"
    />

    <!-- Link Mode Indicator -->
    <div
      v-if="store.canvasState.linkMode.active"
      class="fixed top-20 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 flex items-center gap-2"
    >
      <span>Click on another node to create a relationship</span>
      <button
        class="text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
        @click="store.cancelLinkMode()"
      >
        Cancel (Esc)
      </button>
    </div>
  </div>
</template>
