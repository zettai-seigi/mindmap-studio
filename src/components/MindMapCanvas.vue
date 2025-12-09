<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { layoutNodes, getAllRenderedNodes, findRenderedNodeById } from '../layouts';
import type { RenderedNode, Position } from '../types';
import ContextMenu from './ContextMenu.vue';

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
  c.lineWidth = Math.max(1.5, 3 - child.level * 0.5);
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // Determine connection points based on child position relative to parent
  const parentCenterX = parent.x + parent.width / 2;
  const parentCenterY = parent.y + parent.height / 2;
  const childCenterX = child.x + child.width / 2;
  const childCenterY = child.y + child.height / 2;

  // Child is to the right of parent
  const isRight = childCenterX > parentCenterX;
  // Child is below parent
  const isBelow = childCenterY > parentCenterY;

  let startX: number, startY: number, endX: number, endY: number;

  // For mind map (horizontal) layout
  if (Math.abs(childCenterX - parentCenterX) > Math.abs(childCenterY - parentCenterY)) {
    // Horizontal connection
    startX = isRight ? parent.x + parent.width : parent.x;
    startY = parentCenterY;
    endX = isRight ? child.x : child.x + child.width;
    endY = childCenterY;

    // Draw smooth S-curve with consistent curvature
    const horizontalDist = Math.abs(endX - startX);
    const controlOffset = horizontalDist * 0.4; // Fixed 40% control point

    c.beginPath();
    c.moveTo(startX, startY);
    c.bezierCurveTo(
      startX + (isRight ? controlOffset : -controlOffset), startY,
      endX + (isRight ? -controlOffset : controlOffset), endY,
      endX, endY
    );
    c.stroke();
  } else {
    // Vertical connection (for org chart style)
    startX = parentCenterX;
    startY = isBelow ? parent.y + parent.height : parent.y;
    endX = childCenterX;
    endY = isBelow ? child.y : child.y + child.height;

    // Draw smooth curve
    const verticalDist = Math.abs(endY - startY);
    const controlOffset = verticalDist * 0.4;

    c.beginPath();
    c.moveTo(startX, startY);
    c.bezierCurveTo(
      startX, startY + (isBelow ? controlOffset : -controlOffset),
      endX, endY + (isBelow ? -controlOffset : controlOffset),
      endX, endY
    );
    c.stroke();
  }
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
    const screenX = (clickedNode.x - canvas.width / 2 + store.viewState.panX) * store.viewState.zoom + canvas.width / 2 + rect.left;
    const screenY = (clickedNode.y - canvas.height / 2 + store.viewState.panY) * store.viewState.zoom + canvas.height / 2 + rect.top;

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
            const screenX = (node.x - canvas.width / 2 + store.viewState.panX) * store.viewState.zoom + canvas.width / 2 + rect.left;
            const screenY = (node.y - canvas.height / 2 + store.viewState.panY) * store.viewState.zoom + canvas.height / 2 + rect.top;

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
    class="w-full h-full overflow-hidden bg-white dark:bg-slate-900 relative"
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
  </div>
</template>
