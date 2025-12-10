<script setup lang="ts">
import { computed } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { Brackets, Trash2 } from 'lucide-vue-next';

const store = useMindMapStore();

// Get all summaries
const summaries = computed(() => store.summaries);

// Selected summary
const selectedSummaryId = computed(() => store.canvasState.selectedSummaryId);

// Update summary label
function updateLabel(summaryId: string, topicText: string) {
  store.updateSummary(summaryId, { topicText });
}

// Update summary color
function updateColor(summaryId: string, color: string) {
  store.updateSummary(summaryId, { color });
}

// Update summary background color
function updateBackgroundColor(summaryId: string, backgroundColor: string) {
  store.updateSummary(summaryId, { backgroundColor });
}

// Delete summary
function deleteSummary(summaryId: string) {
  store.removeSummary(summaryId);
}

// Select a summary
function selectSummary(summaryId: string) {
  store.selectSummary(summaryId);
}

// Get parent node text for display
function getParentNodeText(parentNodeId: string): string {
  const node = store.findNodeById(parentNodeId);
  return node?.text || 'Unknown';
}

// Color options
const colorOptions = [
  '#64748b', // Gray (default)
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
];

// Background color options
const bgColorOptions = [
  '#f1f5f9', // Light gray (default)
  '#dbeafe', // Light blue
  '#dcfce7', // Light green
  '#fef3c7', // Light amber
  '#fee2e2', // Light red
  '#ede9fe', // Light purple
  '#fce7f3', // Light pink
  '#cffafe', // Light cyan
];
</script>

<template>
  <div class="summaries-panel">
    <div class="panel-header">
      <div class="header-left">
        <Brackets :size="14" />
        <span class="header-title">Summaries</span>
      </div>
    </div>

    <div class="panel-content">
      <!-- No summaries -->
      <div v-if="summaries.length === 0" class="empty-state">
        <Brackets :size="32" class="empty-icon" />
        <span>No summaries</span>
        <span class="empty-hint">Import XMind files with summaries</span>
      </div>

      <!-- Summaries list -->
      <div v-else class="summaries-list">
        <div
          v-for="summary in summaries"
          :key="summary.id"
          class="summary-item"
          :class="{ selected: selectedSummaryId === summary.id }"
          :style="{ borderLeftColor: summary.color || '#64748b' }"
          @click="selectSummary(summary.id)"
        >
          <!-- Label input -->
          <div class="summary-label">
            <input
              type="text"
              :value="summary.topicText || ''"
              placeholder="Summary label..."
              @input="updateLabel(summary.id, ($event.target as HTMLInputElement).value)"
              @click.stop
            />
          </div>

          <!-- Parent info -->
          <div class="parent-info">
            <span class="row-label">Parent:</span>
            <span class="parent-name">{{ getParentNodeText(summary.parentNodeId) }}</span>
          </div>

          <!-- Range info -->
          <div class="range-info">
            <span class="row-label">Range:</span>
            <span class="range-value">Children {{ summary.rangeStart }} - {{ summary.rangeEnd }}</span>
          </div>

          <!-- Color selector -->
          <div class="color-row">
            <span class="row-label">Bracket:</span>
            <div class="color-options">
              <button
                v-for="color in colorOptions"
                :key="color"
                class="color-btn"
                :class="{ active: (summary.color || '#64748b') === color }"
                :style="{ backgroundColor: color }"
                @click.stop="updateColor(summary.id, color)"
              />
            </div>
          </div>

          <!-- Background color selector -->
          <div class="color-row">
            <span class="row-label">Background:</span>
            <div class="color-options">
              <button
                v-for="color in bgColorOptions"
                :key="color"
                class="color-btn bg-color"
                :class="{ active: (summary.backgroundColor || '#f1f5f9') === color }"
                :style="{ backgroundColor: color }"
                @click.stop="updateBackgroundColor(summary.id, color)"
              />
            </div>
          </div>

          <!-- Delete button -->
          <button class="delete-btn" title="Delete summary" @click.stop="deleteSummary(summary.id)">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.summaries-panel {
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

/* Summaries list */
.summaries-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border-left: 3px solid;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  cursor: pointer;
  transition: background 0.15s ease;
}

.summary-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.summary-item.selected {
  background: rgba(59, 130, 246, 0.1);
  border-left-color: #3b82f6 !important;
}

.summary-label input {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 10px;
  color: white;
  font-size: 13px;
}

.summary-label input:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

.summary-label input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.row-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.parent-info,
.range-info,
.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.parent-name,
.range-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.parent-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-options {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
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

.color-btn.bg-color {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.color-btn.bg-color.active {
  border-color: white;
  border-width: 2px;
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
