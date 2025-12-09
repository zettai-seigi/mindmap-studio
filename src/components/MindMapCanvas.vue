<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { layoutNodes, getAllRenderedNodes, findRenderedNodeById } from '../layouts';
import type { RenderedNode, Position } from '../types';
import ContextMenu from './ContextMenu.vue';
import { getMarkerDisplay } from '../composables/useMarkerDisplay';
import { useCanvasCoordinates } from '../composables/useCanvasCoordinates';
import { useCanvasHitDetection } from '../composables/useCanvasHitDetection';

const props = defineProps<{
  focusMode?: boolean;
  tagFilters?: string[];
}>();

const store = useMindMapStore();

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

// Hit detection utilities
const {
  findNodeAtPosition,
  findRelationshipAtPosition,
  findControlPointAtPosition,
  findRelationshipLabelAtPosition,
} = useCanvasHitDetection({
  renderedRoot,
  allNodes,
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
  const sf = store.sheetFormat;
  c.fillStyle = sf.backgroundColor;
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

  // Draw floating topics
  store.floatingTopics.forEach(topic => {
    if (topic.position) {
      drawNode(c, {
        node: topic,
        x: topic.position.x,
        y: topic.position.y,
        width: 120,
        height: 40,
        collapsed: false,
        level: 0,
        children: [],
      });
    }
  });

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

function drawConnections(c: CanvasRenderingContext2D, rendered: RenderedNode) {
  rendered.children.forEach((child, index) => {
    const color = colors.value.branches[index % colors.value.branches.length] || '#3b82f6';
    drawConnection(c, rendered, child, color, index);
    drawConnections(c, child);
  });
}

function drawConnection(
  c: CanvasRenderingContext2D,
  parent: RenderedNode,
  child: RenderedNode,
  color: string,
  _index: number
) {
  c.strokeStyle = color;
  c.lineWidth = Math.max(1.5, 3 - child.level * 0.5);
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const structure = store.structure;

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

  // Fishbone: diagonal lines to the spine
  if (structure === 'fishbone') {
    const startX = parent.x + parent.width / 2;
    const startY = parent.y + parent.height / 2;
    const endX = child.x + child.width / 2;
    const endY = child.y + child.height / 2;

    // For main branches (level 1), draw diagonal to spine then along spine
    if (child.level === 1) {
      // Connect to spine (horizontal line at parent's Y level)
      c.beginPath();
      c.moveTo(endX, endY);
      c.lineTo(endX, startY);  // Diagonal down to spine level
      c.lineTo(startX, startY); // Along the spine
      c.stroke();
    } else {
      // Sub-branches: simple diagonal
      c.beginPath();
      c.moveTo(startX, startY);
      c.lineTo(endX, endY);
      c.stroke();
    }
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

function drawRelationships(c: CanvasRenderingContext2D) {
  store.relationships.forEach(rel => {
    const sourceNode = renderedRoot.value
      ? findRenderedNodeById(renderedRoot.value, rel.sourceId)
      : null;
    const targetNode = renderedRoot.value
      ? findRenderedNodeById(renderedRoot.value, rel.targetId)
      : null;

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
  store.boundaries.forEach(boundary => {
    const nodes = boundary.nodeIds
      .map(id => renderedRoot.value ? findRenderedNodeById(renderedRoot.value, id) : null)
      .filter(Boolean) as RenderedNode[];

    if (nodes.length === 0) return;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      minX = Math.min(minX, node.x - 20);
      minY = Math.min(minY, node.y - 20);
      maxX = Math.max(maxX, node.x + node.width + 20);
      maxY = Math.max(maxY, node.y + node.height + 20);
    });

    c.fillStyle = boundary.backgroundColor;
    c.strokeStyle = boundary.color;
    c.lineWidth = 2;

    if (boundary.shape === 'rounded') {
      roundRect(c, minX, minY, maxX - minX, maxY - minY, 15);
    } else {
      c.fillRect(minX, minY, maxX - minX, maxY - minY);
      c.strokeRect(minX, minY, maxX - minX, maxY - minY);
    }

    if (boundary.label) {
      c.fillStyle = boundary.color;
      c.font = 'bold 12px sans-serif';
      c.fillText(boundary.label, minX + 10, minY - 5);
    }
  });
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
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

  // Get node shape from style, default to 'rounded'
  const nodeShape: NodeShapeType = (node.style?.shape as NodeShapeType) || 'rounded';

  // Background color
  const bgColor = node.style?.backgroundColor || (level === 0
    ? colors.value.rootNode
    : (colors.value.branches[level % colors.value.branches.length] || '#3b82f6'));

  c.fillStyle = bgColor;
  c.strokeStyle = 'transparent';
  c.lineWidth = 1;

  // Shadow (not for underline/none shapes)
  if (nodeShape !== 'underline' && nodeShape !== 'none') {
    c.shadowColor = 'rgba(0, 0, 0, 0.1)';
    c.shadowBlur = 10;
    c.shadowOffsetX = 2;
    c.shadowOffsetY = 2;
  }

  // Draw shape
  drawShape(c, nodeShape, x, y, width, height);

  c.shadowColor = 'transparent';

  // Selection highlight
  if (isSelected) {
    c.fillStyle = 'transparent';
    c.strokeStyle = '#3b82f6';
    c.lineWidth = 3;
    drawShape(c, nodeShape, x - 3, y - 3, width + 6, height + 6);
  }

  // Hover highlight
  if (isHovered && !isSelected) {
    c.fillStyle = 'transparent';
    c.strokeStyle = '#93c5fd';
    c.lineWidth = 2;
    drawShape(c, nodeShape, x - 2, y - 2, width + 4, height + 4);
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
  c.fillStyle = '#ffffff';
  c.font = level === 0 ? 'bold 16px sans-serif' : '14px sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'middle';

  let displayText = node.text;
  // Truncate text if too long
  c.font = level === 0 ? 'bold 16px sans-serif' : '14px sans-serif';
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

// Expose canvas dimensions, canvas element and render function for parent components
defineExpose({
  canvasWidth,
  canvasHeight,
  canvasRef,
  render,
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
