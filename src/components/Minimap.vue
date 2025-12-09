<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { layoutNodes, getAllRenderedNodes, getBoundingBox } from '../layouts';
import type { RenderedNode } from '../types';

const props = defineProps<{
  canvasWidth: number;
  canvasHeight: number;
}>();

const emit = defineEmits<{
  navigate: [x: number, y: number];
}>();

const store = useMindMapStore();
const minimapRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;

// Calculate scale to fit all nodes
const minimapData = computed(() => {
  if (!store.root) return null;

  const config = {
    centerX: props.canvasWidth / 2,
    centerY: props.canvasHeight / 2,
  };

  const rendered = layoutNodes(store.root, store.structure, config);
  const allNodes = getAllRenderedNodes(rendered);
  const bounds = getBoundingBox(allNodes);

  // Add padding
  const padding = 50;
  bounds.minX -= padding;
  bounds.minY -= padding;
  bounds.maxX += padding;
  bounds.maxY += padding;

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  const scaleX = MINIMAP_WIDTH / contentWidth;
  const scaleY = MINIMAP_HEIGHT / contentHeight;
  const scale = Math.min(scaleX, scaleY, 0.15); // Cap scale

  return {
    rendered,
    allNodes,
    bounds,
    scale,
    offsetX: -bounds.minX,
    offsetY: -bounds.minY,
  };
});

// Viewport rectangle in minimap coordinates
const viewport = computed(() => {
  if (!minimapData.value) return null;

  const { scale, offsetX, offsetY } = minimapData.value;
  const { zoom, panX, panY } = store.viewState;

  // Calculate visible area in world coordinates
  const visibleWidth = props.canvasWidth / zoom;
  const visibleHeight = props.canvasHeight / zoom;
  const visibleX = props.canvasWidth / 2 - panX - visibleWidth / 2;
  const visibleY = props.canvasHeight / 2 - panY - visibleHeight / 2;

  return {
    x: (visibleX + offsetX) * scale,
    y: (visibleY + offsetY) * scale,
    width: visibleWidth * scale,
    height: visibleHeight * scale,
  };
});

function render() {
  if (!ctx.value || !minimapRef.value || !minimapData.value) return;

  const canvas = minimapRef.value;
  const c = ctx.value;
  const { rendered, scale, offsetX, offsetY } = minimapData.value;

  // Clear
  c.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background
  c.fillStyle = 'rgba(255, 255, 255, 0.9)';
  c.fillRect(0, 0, canvas.width, canvas.height);

  // Draw nodes
  c.save();
  c.scale(scale, scale);
  c.translate(offsetX, offsetY);

  drawMinimapNodes(c, rendered);

  c.restore();

  // Draw viewport rectangle
  if (viewport.value) {
    const vp = viewport.value;
    c.strokeStyle = '#3b82f6';
    c.lineWidth = 2;
    c.strokeRect(vp.x, vp.y, vp.width, vp.height);
    c.fillStyle = 'rgba(59, 130, 246, 0.1)';
    c.fillRect(vp.x, vp.y, vp.width, vp.height);
  }
}

function drawMinimapNodes(c: CanvasRenderingContext2D, node: RenderedNode) {
  // Draw node as simple rectangle
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
  const colorIndex = node.level % colors.length;
  c.fillStyle = node.level === 0 ? '#1e40af' : (colors[colorIndex] || '#3b82f6');

  c.beginPath();
  c.roundRect(node.x, node.y, node.width, node.height, 4);
  c.fill();

  // Draw children
  node.children.forEach(child => {
    // Draw connection line
    c.strokeStyle = '#94a3b8';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(node.x + node.width / 2, node.y + node.height / 2);
    c.lineTo(child.x + child.width / 2, child.y + child.height / 2);
    c.stroke();

    drawMinimapNodes(c, child);
  });
}

function handleClick(e: MouseEvent) {
  if (!minimapData.value || !containerRef.value) return;

  const rect = containerRef.value.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const { scale, offsetX, offsetY } = minimapData.value;

  // Convert minimap coords to world coords
  const worldX = clickX / scale - offsetX;
  const worldY = clickY / scale - offsetY;

  // Calculate pan to center on clicked point
  const newPanX = props.canvasWidth / 2 - worldX;
  const newPanY = props.canvasHeight / 2 - worldY;

  emit('navigate', newPanX, newPanY);
}

let isDragging = false;

function handleMouseDown(e: MouseEvent) {
  isDragging = true;
  handleClick(e);
}

function handleMouseMove(e: MouseEvent) {
  if (isDragging) {
    handleClick(e);
  }
}

function handleMouseUp() {
  isDragging = false;
}

onMounted(() => {
  if (minimapRef.value) {
    const dpr = window.devicePixelRatio || 1;
    minimapRef.value.width = MINIMAP_WIDTH * dpr;
    minimapRef.value.height = MINIMAP_HEIGHT * dpr;
    ctx.value = minimapRef.value.getContext('2d');
    if (ctx.value) {
      ctx.value.scale(dpr, dpr);
    }
  }

  window.addEventListener('mouseup', handleMouseUp);
  render();
});

onUnmounted(() => {
  window.removeEventListener('mouseup', handleMouseUp);
});

// Watch for changes
watch(
  [() => store.currentMap, () => store.structure, () => store.viewState],
  () => render(),
  { deep: true }
);

watch(
  [() => props.canvasWidth, () => props.canvasHeight],
  () => render()
);
</script>

<template>
  <div
    ref="containerRef"
    class="minimap-container absolute bottom-4 left-4 rounded-lg overflow-hidden cursor-crosshair select-none"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
  >
    <canvas
      ref="minimapRef"
      :style="{ width: `${MINIMAP_WIDTH}px`, height: `${MINIMAP_HEIGHT}px` }"
    />
    <div class="absolute top-1.5 left-2 text-[10px] font-medium text-slate-500 pointer-events-none">
      Overview
    </div>
  </div>
</template>

<style scoped>
.minimap-container {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.05);
}

.dark .minimap-container {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
}
</style>
