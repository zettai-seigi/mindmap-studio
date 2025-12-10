<script setup lang="ts">
import { computed } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { Box, Plus, Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-vue-next';

const store = useMindMapStore();

// Get all boundaries
const boundaries = computed(() => store.boundaries);

// Selected nodes
const selectedNodes = computed(() => store.canvasState.selectedNodeIds);

// Create a boundary from selected nodes
function createBoundary() {
  if (selectedNodes.value.length < 1) return;
  store.addBoundary(selectedNodes.value, 'Group');
}

// Update boundary label
function updateLabel(boundaryId: string, label: string) {
  store.updateBoundary(boundaryId, { label });
}

// Update boundary label alignment
function updateLabelAlign(boundaryId: string, align: 'left' | 'center' | 'right') {
  store.updateBoundary(boundaryId, { labelAlign: align });
}

// Update boundary shape
function updateShape(boundaryId: string, shape: 'rectangle' | 'rounded' | 'cloud' | 'wave') {
  store.updateBoundary(boundaryId, { shape });
}

// Update boundary color
function updateColor(boundaryId: string, color: string) {
  store.updateBoundary(boundaryId, { color, backgroundColor: color + '20' });
}

// Delete boundary
function deleteBoundary(boundaryId: string) {
  store.removeBoundary(boundaryId);
}

// Get node text for display
function getNodeText(nodeId: string): string {
  const node = store.findNodeById(nodeId);
  return node?.text || 'Unknown';
}

// Shape options
const shapeOptions = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'wave', label: 'Wave' },
];

// Color options
const colorOptions = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Gray
];
</script>

<template>
  <div class="boundaries-panel">
    <div class="panel-header">
      <div class="header-left">
        <Box :size="14" />
        <span class="header-title">Boundaries</span>
      </div>
      <button
        v-if="selectedNodes.length >= 1"
        class="add-btn"
        title="Create boundary from selected nodes"
        @click="createBoundary"
      >
        <Plus :size="14" />
      </button>
    </div>

    <div class="panel-content">
      <!-- No boundaries -->
      <div v-if="boundaries.length === 0" class="empty-state">
        <Box :size="32" class="empty-icon" />
        <span>No boundaries</span>
        <span class="empty-hint">Select nodes and click + to create</span>
      </div>

      <!-- Boundaries list -->
      <div v-else class="boundaries-list">
        <div
          v-for="boundary in boundaries"
          :key="boundary.id"
          class="boundary-item"
          :style="{ borderLeftColor: boundary.color }"
        >
          <!-- Label input -->
          <div class="boundary-label">
            <input
              type="text"
              :value="boundary.label || ''"
              placeholder="Label..."
              @input="updateLabel(boundary.id, ($event.target as HTMLInputElement).value)"
            />
          </div>

          <!-- Label alignment -->
          <div class="alignment-row">
            <span class="row-label">Align:</span>
            <div class="alignment-buttons">
              <button
                :class="{ active: boundary.labelAlign === 'left' || (!boundary.labelAlign && false) }"
                title="Align Left"
                @click="updateLabelAlign(boundary.id, 'left')"
              >
                <AlignLeft :size="14" />
              </button>
              <button
                :class="{ active: boundary.labelAlign === 'center' || !boundary.labelAlign }"
                title="Align Center"
                @click="updateLabelAlign(boundary.id, 'center')"
              >
                <AlignCenter :size="14" />
              </button>
              <button
                :class="{ active: boundary.labelAlign === 'right' }"
                title="Align Right"
                @click="updateLabelAlign(boundary.id, 'right')"
              >
                <AlignRight :size="14" />
              </button>
            </div>
          </div>

          <!-- Shape selector -->
          <div class="shape-row">
            <span class="row-label">Shape:</span>
            <select
              :value="boundary.shape"
              @change="updateShape(boundary.id, ($event.target as HTMLSelectElement).value as any)"
            >
              <option v-for="opt in shapeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Color selector -->
          <div class="color-row">
            <span class="row-label">Color:</span>
            <div class="color-options">
              <button
                v-for="color in colorOptions"
                :key="color"
                class="color-btn"
                :class="{ active: boundary.color === color }"
                :style="{ backgroundColor: color }"
                @click="updateColor(boundary.id, color)"
              />
            </div>
          </div>

          <!-- Nodes in boundary -->
          <div class="nodes-list">
            <span class="row-label">Nodes ({{ boundary.nodeIds.length }}):</span>
            <div class="node-tags">
              <span v-for="nodeId in boundary.nodeIds.slice(0, 3)" :key="nodeId" class="node-tag">
                {{ getNodeText(nodeId) }}
              </span>
              <span v-if="boundary.nodeIds.length > 3" class="node-tag more">
                +{{ boundary.nodeIds.length - 3 }} more
              </span>
            </div>
          </div>

          <!-- Delete button -->
          <button class="delete-btn" title="Delete boundary" @click="deleteBoundary(boundary.id)">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.boundaries-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(30, 30, 30, 0.98);
  color: white;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
}

.header-title {
  font-size: 14px;
  font-weight: 500;
  color: white;
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s ease;
}

.add-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  color: rgba(255, 255, 255, 0.2);
  margin-bottom: 12px;
}

.empty-state span {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.empty-hint {
  font-size: 11px !important;
  color: rgba(255, 255, 255, 0.3) !important;
  margin-top: 4px;
}

/* Boundaries list */
.boundaries-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.boundary-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border-left: 3px solid;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}

.boundary-label input {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 10px;
  color: white;
  font-size: 13px;
}

.boundary-label input:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

.boundary-label input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.row-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.alignment-row,
.shape-row,
.color-row,
.nodes-list {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alignment-buttons {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 2px;
}

.alignment-buttons button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s;
}

.alignment-buttons button:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.alignment-buttons button.active {
  color: white;
  background: rgba(59, 130, 246, 0.5);
}

.shape-row select {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px 8px;
  color: white;
  font-size: 12px;
}

.shape-row select:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.5);
}

.color-options {
  display: flex;
  gap: 4px;
}

.color-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid transparent;
  transition: all 0.15s;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: white;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
}

.nodes-list {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.node-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.node-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.7);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-tag.more {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.3);
  transition: all 0.15s;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Scrollbar */
.panel-content::-webkit-scrollbar {
  width: 8px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
