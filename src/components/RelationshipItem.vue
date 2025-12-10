<script setup lang="ts">
import { ref } from 'vue';
import { ArrowRight, ArrowLeft, ArrowLeftRight, Edit3, Check, X, Trash2 } from 'lucide-vue-next';
import type { Relationship } from '../types';

const props = defineProps<{
  relationship: Relationship;
  sourceText: string;
  targetText: string;
  highlightSource?: boolean;
  highlightTarget?: boolean;
  isSelected?: boolean;
}>();

const emit = defineEmits<{
  updateStyle: [style: 'solid' | 'dashed' | 'dotted'];
  updateColor: [color: string];
  updateLabel: [label: string];
  toggleStartArrow: [];
  toggleEndArrow: [];
  setBidirectional: [];
  delete: [];
}>();

// Relationship style options
const lineStyles = ['solid', 'dashed', 'dotted'] as const;
const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

// Editing state
const isEditing = ref(false);
const editLabel = ref('');

function startEditLabel() {
  editLabel.value = props.relationship.label || '';
  isEditing.value = true;
}

function saveLabel() {
  emit('updateLabel', editLabel.value);
  isEditing.value = false;
  editLabel.value = '';
}

function cancelEdit() {
  isEditing.value = false;
  editLabel.value = '';
}
</script>

<template>
  <div class="relationship-item" :class="{ selected: isSelected }">
    <!-- Relationship nodes -->
    <div class="rel-nodes">
      <span class="rel-node" :class="{ highlight: highlightSource }">
        {{ sourceText }}
      </span>
      <ArrowRight :size="12" class="rel-arrow" />
      <span class="rel-node" :class="{ highlight: highlightTarget }">
        {{ targetText }}
      </span>
    </div>

    <!-- Label editing -->
    <div v-if="isEditing" class="edit-label">
      <input
        v-model="editLabel"
        class="label-input"
        placeholder="Label..."
        @keydown.enter="saveLabel"
        @keydown.escape="cancelEdit"
      />
      <button class="edit-btn save" @click="saveLabel">
        <Check :size="12" />
      </button>
      <button class="edit-btn cancel" @click="cancelEdit">
        <X :size="12" />
      </button>
    </div>

    <!-- Label display -->
    <div v-else class="rel-label-row">
      <span class="rel-label" @click="startEditLabel">
        {{ relationship.label || 'Add label...' }}
      </span>
      <button class="edit-icon-btn" @click="startEditLabel">
        <Edit3 :size="10" />
      </button>
    </div>

    <!-- Style controls -->
    <div class="rel-style-controls">
      <!-- Line style -->
      <div class="style-buttons" title="Line style">
        <button
          v-for="style in lineStyles"
          :key="style"
          class="style-btn"
          :class="{ active: relationship.style === style }"
          :title="style"
          @click="emit('updateStyle', style)"
        >
          <span :class="['line-preview', style]"></span>
        </button>
      </div>

      <!-- Color options -->
      <div class="color-options">
        <button
          v-for="color in colors"
          :key="color"
          class="color-btn"
          :class="{ active: relationship.color === color }"
          :style="{ backgroundColor: color }"
          @click="emit('updateColor', color)"
        />
      </div>
    </div>

    <!-- Arrow controls -->
    <div class="arrow-controls">
      <span class="arrow-label">Arrows:</span>
      <div class="arrow-buttons">
        <!-- Start arrow (left) -->
        <button
          class="arrow-toggle"
          :class="{ active: relationship.startArrow }"
          title="Start arrow"
          @click="emit('toggleStartArrow')"
        >
          <ArrowLeft :size="12" />
        </button>

        <!-- Bidirectional -->
        <button
          class="arrow-toggle bidir"
          :class="{ active: relationship.startArrow && relationship.endArrow }"
          title="Bidirectional"
          @click="emit('setBidirectional')"
        >
          <ArrowLeftRight :size="12" />
        </button>

        <!-- End arrow (right) -->
        <button
          class="arrow-toggle"
          :class="{ active: relationship.endArrow }"
          title="End arrow"
          @click="emit('toggleEndArrow')"
        >
          <ArrowRight :size="12" />
        </button>
      </div>

      <!-- Delete -->
      <button
        class="delete-btn"
        title="Delete relationship"
        @click="emit('delete')"
      >
        <Trash2 :size="12" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.relationship-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.relationship-item.selected {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}

.rel-nodes {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.rel-node {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rel-node.highlight {
  color: #60a5fa;
  font-weight: 500;
}

.rel-arrow {
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.rel-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.rel-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.15s;
}

.rel-label:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
}

.edit-icon-btn {
  color: rgba(255, 255, 255, 0.3);
  padding: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.rel-label-row:hover .edit-icon-btn {
  opacity: 1;
}

/* Edit label */
.edit-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.label-input {
  flex: 1;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: white;
  font-size: 12px;
  outline: none;
}

.label-input:focus {
  border-color: #3b82f6;
}

.edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  transition: all 0.15s;
}

.edit-btn.save {
  color: #22c55e;
}

.edit-btn.save:hover {
  background: rgba(34, 197, 94, 0.2);
}

.edit-btn.cancel {
  color: #ef4444;
}

.edit-btn.cancel:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Style controls */
.rel-style-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.style-buttons {
  display: flex;
  gap: 2px;
}

.style-btn {
  width: 24px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.15s;
}

.style-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.style-btn.active {
  background: rgba(59, 130, 246, 0.2);
}

.line-preview {
  width: 14px;
  height: 2px;
  background: rgba(255, 255, 255, 0.6);
}

.line-preview.dashed {
  background: transparent;
  border-top: 2px dashed rgba(255, 255, 255, 0.6);
}

.line-preview.dotted {
  background: transparent;
  border-top: 2px dotted rgba(255, 255, 255, 0.6);
}

.color-options {
  display: flex;
  gap: 3px;
}

.color-btn {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: white;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
}

/* Arrow controls */
.arrow-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.arrow-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.arrow-buttons {
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 2px;
}

.arrow-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 22px;
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.15s;
}

.arrow-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.arrow-toggle.active {
  background: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.arrow-toggle.bidir {
  width: 28px;
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: auto;
  transition: all 0.15s;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}
</style>
