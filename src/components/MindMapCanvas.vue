<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { layoutNodes, getAllRenderedNodes, findRenderedNodeById } from '../layouts';
import type { RenderedNode, Position } from '../types';

const store = useMindMapStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

// Canvas dimensions
const canvasWidth = ref(0);
const canvasHeight = ref(0);

// Interaction state
const isDragging = ref(false);
const isPanning = ref(false);
const dragStart = ref<Position | null>(null);
const lastMousePos = ref<Position | null>(null);

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

  // Clear canvas
  c.clearRect(0, 0, canvas.width, canvas.height);

  // Apply zoom and pan
  c.save();
  c.translate(canvas.width / 2, canvas.height / 2);
  c.scale(store.viewState.zoom, store.viewState.zoom);
  c.translate(
    -canvas.width / 2 + store.viewState.panX,
    -canvas.height / 2 + store.viewState.panY
  );

  // Draw background grid (optional)
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
  const gridSize = 50;
  c.strokeStyle = '#e5e7eb';
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
}

function drawConnections(c: CanvasRenderingContext2D, rendered: RenderedNode) {
  rendered.children.forEach((child, index) => {
    const color = colors.value.branches[index % colors.value.branches.length] || '#3b82f6';
    drawConnection(c, rendered, child, color);
    drawConnections(c, child);
  });
}

function drawConnection(
  c: CanvasRenderingContext2D,
  parent: RenderedNode,
  child: RenderedNode,
  color: string
) {
  c.strokeStyle = color;
  c.lineWidth = Math.max(1, 3 - child.level * 0.5);
  c.lineCap = 'round';

  // Bezier curve
  c.beginPath();
  c.moveTo(parent.x + parent.width, parent.y + parent.height / 2);

  const cp1x = parent.x + parent.width + (child.x - parent.x - parent.width) / 3;
  const cp1y = parent.y + parent.height / 2;
  const cp2x = child.x - (child.x - parent.x - parent.width) / 3;
  const cp2y = child.y + child.height / 2;

  c.bezierCurveTo(
    cp1x, cp1y,
    cp2x, cp2y,
    child.x, child.y + child.height / 2
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

  // Text
  c.fillStyle = '#ffffff';
  c.font = level === 0 ? 'bold 16px sans-serif' : '14px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  const text = node.text.length > 20 ? node.text.slice(0, 18) + '...' : node.text;
  c.fillText(text, x + width / 2, y + height / 2);

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
    c.fillText(
      node.collapsed ? '+' : '−',
      indicatorX,
      indicatorY + 1
    );
  }

  // Markers
  if (node.markers.length > 0) {
    let markerX = x + 5;
    node.markers.slice(0, 3).forEach(marker => {
      c.fillStyle = marker.color || '#f59e0b';
      c.beginPath();
      c.arc(markerX + 6, y - 6, 6, 0, Math.PI * 2);
      c.fill();
      markerX += 16;
    });
  }
}

// ============================================
// Event Handlers
// ============================================

function handleMouseDown(e: MouseEvent) {
  const pos = getMousePosition(e);
  lastMousePos.value = pos;

  const clickedNode = findNodeAtPosition(pos);

  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    // Middle click or Alt+click: start panning
    isPanning.value = true;
    dragStart.value = pos;
    return;
  }

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

    // Start dragging
    isDragging.value = true;
    dragStart.value = {
      x: pos.x - clickedNode.x,
      y: pos.y - clickedNode.y,
    };
  } else {
    // Click on empty space
    store.clearSelection();

    // Double click: add floating topic
    // Start selection box
    store.canvasState.selectionBox = { start: pos, end: pos };
  }

  render();
}

function handleMouseMove(e: MouseEvent) {
  const pos = getMousePosition(e);

  if (isPanning.value && dragStart.value) {
    const dx = pos.x - lastMousePos.value!.x;
    const dy = pos.y - lastMousePos.value!.y;
    store.setPan(store.viewState.panX + dx, store.viewState.panY + dy);
    render();
  } else if (isDragging.value && store.canvasState.selectedNodeIds.length > 0) {
    // TODO: Implement node dragging
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

function handleMouseUp(_e: MouseEvent) {
  if (store.canvasState.selectionBox) {
    // Select nodes in box
    const box = store.canvasState.selectionBox;
    const minX = Math.min(box.start.x, box.end.x);
    const maxX = Math.max(box.start.x, box.end.x);
    const minY = Math.min(box.start.y, box.end.y);
    const maxY = Math.max(box.start.y, box.end.y);

    allNodes.value.forEach(node => {
      if (
        node.x >= minX && node.x + node.width <= maxX &&
        node.y >= minY && node.y + node.height <= maxY
      ) {
        store.selectNode(node.node.id, true);
      }
    });

    store.canvasState.selectionBox = null;
  }

  isDragging.value = false;
  isPanning.value = false;
  dragStart.value = null;
  render();
}

function handleDoubleClick(e: MouseEvent) {
  const pos = getMousePosition(e);
  const clickedNode = findNodeAtPosition(pos);

  if (clickedNode) {
    store.startEditing(clickedNode.node.id);
    // TODO: Show text input
  } else {
    // Add floating topic
    store.addFloatingTopic(pos, 'New Topic');
    updateLayout();
    render();
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
  }
}

// ============================================
// Utility Functions
// ============================================

function getMousePosition(e: MouseEvent): Position {
  const canvas = canvasRef.value;
  if (!canvas) return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - canvas.width / 2) / store.viewState.zoom
    + canvas.width / 2 - store.viewState.panX;
  const y = (e.clientY - rect.top - canvas.height / 2) / store.viewState.zoom
    + canvas.height / 2 - store.viewState.panY;

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

  if (ctx.value) {
    ctx.value.scale(dpr, dpr);
  }

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

// Watch for store changes
watch(
  () => [store.root, store.structure, store.floatingTopics],
  () => {
    updateLayout();
    render();
  },
  { deep: true }
);
</script>

<template>
  <div
    ref="containerRef"
    class="w-full h-full overflow-hidden bg-white dark:bg-slate-900"
  >
    <canvas
      ref="canvasRef"
      class="cursor-crosshair"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @dblclick="handleDoubleClick"
      @wheel="handleWheel"
      @contextmenu.prevent
    />
  </div>
</template>
