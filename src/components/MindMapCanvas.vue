<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { layoutNodes, getAllRenderedNodes, findRenderedNodeById } from '../layouts';
import type { RenderedNode, Position } from '../types';
import ContextMenu from './ContextMenu.vue';
import Minimap from './Minimap.vue';

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

function drawRelationships(c: CanvasRenderingContext2D) {
  store.relationships.forEach(rel => {
    const sourceNode = renderedRoot.value
      ? findRenderedNodeById(renderedRoot.value, rel.sourceId)
      : null;
    const targetNode = renderedRoot.value
      ? findRenderedNodeById(renderedRoot.value, rel.targetId)
      : null;

    if (!sourceNode || !targetNode) return;

    c.strokeStyle = rel.color;
    c.lineWidth = 2;
    c.setLineDash(rel.style === 'dashed' ? [8, 4] : rel.style === 'dotted' ? [2, 2] : []);

    const startX = sourceNode.x + sourceNode.width / 2;
    const startY = sourceNode.y + sourceNode.height / 2;
    const endX = targetNode.x + targetNode.width / 2;
    const endY = targetNode.y + targetNode.height / 2;

    // Curved line
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2 - 50 * rel.curvature;

    c.beginPath();
    c.moveTo(startX, startY);
    c.quadraticCurveTo(midX, midY, endX, endY);
    c.stroke();

    // Draw arrow
    if (rel.endArrow) {
      const angle = Math.atan2(endY - midY, endX - midX);
      drawArrow(c, endX, endY, angle, rel.color);
    }

    // Draw label
    if (rel.label) {
      c.fillStyle = rel.color;
      c.font = '12px sans-serif';
      c.textAlign = 'center';
      c.fillText(rel.label, midX, midY - 5);
    }

    c.setLineDash([]);
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

function drawNodes(c: CanvasRenderingContext2D, rendered: RenderedNode) {
  drawNode(c, rendered);
  rendered.children.forEach(child => drawNodes(c, child));
}

function drawNode(c: CanvasRenderingContext2D, rendered: RenderedNode) {
  const { node, x, y, width, height, level } = rendered;
  const isSelected = store.canvasState.selectedNodeIds.includes(node.id);
  const isHovered = store.canvasState.hoveredNodeId === node.id;

  // Background
  const bgColor = level === 0
    ? colors.value.rootNode
    : (colors.value.branches[level % colors.value.branches.length] || '#3b82f6');

  c.fillStyle = bgColor;

  // Shadow
  c.shadowColor = 'rgba(0, 0, 0, 0.1)';
  c.shadowBlur = 10;
  c.shadowOffsetX = 2;
  c.shadowOffsetY = 2;

  // Draw shape
  roundRect(c, x, y, width, height, level === 0 ? 10 : 6);

  c.shadowColor = 'transparent';

  // Selection highlight
  if (isSelected) {
    c.strokeStyle = '#3b82f6';
    c.lineWidth = 3;
    roundRect(c, x - 3, y - 3, width + 6, height + 6, level === 0 ? 12 : 8);
  }

  // Hover highlight
  if (isHovered && !isSelected) {
    c.strokeStyle = '#93c5fd';
    c.lineWidth = 2;
    roundRect(c, x - 2, y - 2, width + 4, height + 4, level === 0 ? 11 : 7);
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

  // Reset text alignment
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
}

// Helper function to get marker display info
function getMarkerDisplay(markerId: string, defaultColor?: string): {
  type: 'badge' | 'emoji' | 'icon' | 'circle';
  label?: string;
  emoji?: string;
  icon?: string;
  bg?: string;
  color?: string;
  textColor?: string;
} {
  // Priority markers (p1-p9)
  const priorityMatch = markerId.match(/^p(\d)$/);
  if (priorityMatch && priorityMatch[1]) {
    const colors: Record<string, string> = {
      '1': '#ef4444', '2': '#f97316', '3': '#eab308', '4': '#22c55e',
      '5': '#3b82f6', '6': '#8b5cf6', '7': '#64748b', '8': '#374151', '9': '#78716c'
    };
    const num = priorityMatch[1];
    return { type: 'badge', label: num, bg: colors[num] || '#3b82f6', textColor: 'white' };
  }

  // Month markers
  const monthMatch = markerId.match(/^month-(\d+)$/);
  if (monthMatch && monthMatch[1]) {
    return { type: 'badge', label: monthMatch[1], bg: '#e5e7eb', textColor: '#374151' };
  }

  // Face emojis
  const faceEmojis: Record<string, string> = {
    'face-happy': '😊', 'face-sad': '😢', 'face-angry': '😠', 'face-surprised': '😮',
    'face-laugh': '😄', 'face-love': '😍', 'face-think': '🤔', 'face-cool': '😎'
  };
  if (faceEmojis[markerId]) {
    return { type: 'emoji', emoji: faceEmojis[markerId] };
  }

  // Progress markers
  const progressIcons: Record<string, { icon: string; color: string }> = {
    'prog-0': { icon: '○', color: '#94a3b8' },
    'prog-25': { icon: '◔', color: '#f59e0b' },
    'prog-50': { icon: '◑', color: '#f59e0b' },
    'prog-75': { icon: '◕', color: '#22c55e' },
    'prog-100': { icon: '●', color: '#22c55e' },
    'prog-start': { icon: '▶', color: '#3b82f6' },
    'prog-pause': { icon: '⏸', color: '#f97316' },
    'prog-cancel': { icon: '✕', color: '#ef4444' }
  };
  if (progressIcons[markerId]) {
    return { type: 'icon', ...progressIcons[markerId] };
  }

  // Flag markers
  if (markerId.startsWith('flag-')) {
    const flagColors: Record<string, string> = {
      'flag-red': '#ef4444', 'flag-orange': '#f97316', 'flag-yellow': '#eab308',
      'flag-green': '#22c55e', 'flag-blue': '#3b82f6', 'flag-purple': '#8b5cf6', 'flag-gray': '#64748b'
    };
    return { type: 'icon', icon: '⚑', color: flagColors[markerId] || defaultColor };
  }

  // Star markers
  if (markerId.startsWith('star-')) {
    const starColors: Record<string, string> = {
      'star-red': '#ef4444', 'star-orange': '#f97316', 'star-yellow': '#eab308',
      'star-green': '#22c55e', 'star-blue': '#3b82f6', 'star-purple': '#8b5cf6'
    };
    return { type: 'icon', icon: '★', color: starColors[markerId] || defaultColor };
  }

  // Person markers
  if (markerId.startsWith('person-')) {
    const personColors: Record<string, string> = {
      'person-red': '#ef4444', 'person-orange': '#f97316', 'person-yellow': '#eab308',
      'person-green': '#22c55e', 'person-blue': '#3b82f6', 'person-purple': '#8b5cf6'
    };
    return { type: 'icon', icon: '👤', color: personColors[markerId] || defaultColor };
  }

  // Arrow markers
  const arrowIcons: Record<string, { icon: string; color: string }> = {
    'arrow-up': { icon: '↑', color: '#22c55e' },
    'arrow-up-right': { icon: '↗', color: '#22c55e' },
    'arrow-right': { icon: '→', color: '#3b82f6' },
    'arrow-down-right': { icon: '↘', color: '#f97316' },
    'arrow-down': { icon: '↓', color: '#ef4444' },
    'arrow-down-left': { icon: '↙', color: '#ef4444' },
    'arrow-left': { icon: '←', color: '#64748b' },
    'arrow-up-left': { icon: '↖', color: '#22c55e' },
    'arrow-refresh': { icon: '↻', color: '#3b82f6' }
  };
  if (arrowIcons[markerId]) {
    return { type: 'icon', ...arrowIcons[markerId] };
  }

  // Symbol markers
  const symbolIcons: Record<string, { icon: string; bg: string }> = {
    'sym-plus': { icon: '+', bg: '#22c55e' },
    'sym-minus': { icon: '−', bg: '#ef4444' },
    'sym-question': { icon: '?', bg: '#3b82f6' },
    'sym-info': { icon: 'i', bg: '#3b82f6' },
    'sym-warning': { icon: '!', bg: '#f59e0b' },
    'sym-error': { icon: '✕', bg: '#ef4444' },
    'sym-check': { icon: '✓', bg: '#22c55e' },
    'sym-stop': { icon: '⏹', bg: '#ef4444' }
  };
  if (symbolIcons[markerId]) {
    return { type: 'icon', ...symbolIcons[markerId] };
  }

  // Default fallback
  return { type: 'circle', color: defaultColor };
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
    if (clickedNode) {
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
    } else {
      // Click on empty space
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
  } else if (isDragging.value && draggedNode.value) {
    // Move the dragged node visually
    draggedNode.value.x = pos.x - dragOffset.value.x;
    draggedNode.value.y = pos.y - dragOffset.value.y;
    render();
  } else if (store.canvasState.selectionBox) {
    store.canvasState.selectionBox.end = pos;
    render();
  } else {
    // Hover detection
    const hoveredNode = findNodeAtPosition(pos);
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

  // Handle node drop
  if (isDragging.value && draggedNode.value) {
    const dropTarget = findNodeAtPosition(pos);

    // Check if dropped on another node for reparenting
    if (dropTarget && dropTarget.node.id !== draggedNode.value.node.id) {
      // Reparent the node
      store.moveNode(draggedNode.value.node.id, dropTarget.node.id);
    } else {
      // Save the new position so it sticks
      store.setNodePosition(draggedNode.value.node.id, {
        x: draggedNode.value.x,
        y: draggedNode.value.y,
      });
    }
    // Re-layout after drag
    updateLayout();
  }

  isDragging.value = false;
  isPanning.value = false;
  dragStart.value = null;
  draggedNode.value = null;
  render();
}

function handleDoubleClick(e: MouseEvent) {
  const pos = getMousePosition(e);
  const clickedNode = findNodeAtPosition(pos);

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

function handleMinimapNavigate(panX: number, panY: number) {
  store.setPan(panX, panY);
  render();
}

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

function handleKeyDown(e: KeyboardEvent) {
  if (store.canvasState.editingNodeId) return;

  const selectedId = store.canvasState.selectedNodeIds[0];

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
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        updateLayout();
        render();
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

function getMousePosition(e: MouseEvent): Position {
  const canvas = canvasRef.value;
  if (!canvas) return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();

  // Use CSS dimensions (canvasWidth/canvasHeight), not the scaled canvas.width/height
  const cssWidth = canvasWidth.value;
  const cssHeight = canvasHeight.value;

  const x = (e.clientX - rect.left - cssWidth / 2) / store.viewState.zoom
    + cssWidth / 2 - store.viewState.panX;
  const y = (e.clientY - rect.top - cssHeight / 2) / store.viewState.zoom
    + cssHeight / 2 - store.viewState.panY;

  return { x, y };
}

function findNodeAtPosition(pos: Position): RenderedNode | null {
  // Check in reverse order (top-most first)
  const nodes = [...allNodes.value].reverse();

  for (const node of nodes) {
    if (
      pos.x >= node.x && pos.x <= node.x + node.width &&
      pos.y >= node.y && pos.y <= node.y + node.height
    ) {
      return node;
    }
  }

  return null;
}

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

onMounted(() => {
  if (canvasRef.value) {
    ctx.value = canvasRef.value.getContext('2d');
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', handleKeyDown);

  store.init();
  updateLayout();
  render();
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', handleKeyDown);
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

    <!-- Minimap -->
    <Minimap
      :canvas-width="canvasWidth"
      :canvas-height="canvasHeight"
      @navigate="handleMinimapNavigate"
    />
  </div>
</template>
