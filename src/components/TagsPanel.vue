<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import type { MindMapNode, Label } from '../types';
import { Tag, Plus, X, Check, Filter, FilterX } from 'lucide-vue-next';
import { v4 as uuidv4 } from 'uuid';

const store = useMindMapStore();

const emit = defineEmits<{
  filterChange: [tags: string[]];
}>();

// Predefined tag colors
const tagColors = [
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
];

// New tag creation
const showNewTag = ref(false);
const newTagText = ref('');
const newTagColor = ref<string>('#3b82f6');

// Active filter tags
const activeFilters = ref<string[]>([]);

// Collect all unique tags from the entire mind map
const allTags = computed(() => {
  const tags = new Map<string, { text: string; color: string; count: number }>();

  function collectTags(node: MindMapNode) {
    for (const label of node.labels) {
      const existing = tags.get(label.text);
      if (existing) {
        existing.count++;
      } else {
        tags.set(label.text, {
          text: label.text,
          color: label.color,
          count: 1,
        });
      }
    }
    node.children.forEach(collectTags);
  }

  collectTags(store.root);
  store.floatingTopics.forEach(collectTags);

  return Array.from(tags.values()).sort((a, b) => b.count - a.count);
});

// Tags on selected nodes
const selectedNodeTags = computed(() => {
  const tags = new Set<string>();
  for (const node of store.selectedNodes) {
    for (const label of node.labels) {
      tags.add(label.text);
    }
  }
  return tags;
});

// Check if a tag is on all selected nodes
function isTagOnAllSelected(tagText: string): boolean {
  if (store.selectedNodes.length === 0) return false;
  return store.selectedNodes.every(node =>
    node.labels.some(l => l.text === tagText)
  );
}

// Toggle tag on selected nodes
function toggleTagOnSelected(tagText: string, color: string) {
  if (store.selectedNodes.length === 0) return;

  const isOnAll = isTagOnAllSelected(tagText);

  for (const node of store.selectedNodes) {
    if (isOnAll) {
      // Remove from all
      const label = node.labels.find(l => l.text === tagText);
      if (label) {
        store.removeLabel(node.id, label.id);
      }
    } else {
      // Add to nodes that don't have it
      if (!node.labels.some(l => l.text === tagText)) {
        const newLabel: Label = {
          id: uuidv4(),
          text: tagText,
          color,
        };
        store.addLabel(node.id, newLabel);
      }
    }
  }
}

// Create new tag and add to selected nodes
function createTag() {
  if (!newTagText.value.trim()) return;

  const tagText = newTagText.value.trim();

  // Add to all selected nodes
  for (const node of store.selectedNodes) {
    if (!node.labels.some(l => l.text === tagText)) {
      const newLabel: Label = {
        id: uuidv4(),
        text: tagText,
        color: newTagColor.value,
      };
      store.addLabel(node.id, newLabel);
    }
  }

  // Reset
  newTagText.value = '';
  showNewTag.value = false;
}

// Toggle filter
function toggleFilter(tagText: string) {
  const index = activeFilters.value.indexOf(tagText);
  if (index === -1) {
    activeFilters.value.push(tagText);
  } else {
    activeFilters.value.splice(index, 1);
  }
  emit('filterChange', [...activeFilters.value]);
}

// Clear all filters
function clearFilters() {
  activeFilters.value = [];
  emit('filterChange', []);
}

// Check if tag is active filter
function isFilterActive(tagText: string): boolean {
  return activeFilters.value.includes(tagText);
}
</script>

<template>
  <div class="tags-panel">
    <div class="tags-header">
      <div class="header-left">
        <Tag :size="14" />
        <span class="header-title">Tags</span>
      </div>
      <div class="header-actions">
        <button
          v-if="activeFilters.length > 0"
          class="clear-filter-btn"
          title="Clear filters"
          @click="clearFilters"
        >
          <FilterX :size="14" />
        </button>
        <button
          class="add-tag-btn"
          title="Create new tag"
          @click="showNewTag = !showNewTag"
        >
          <Plus :size="14" />
        </button>
      </div>
    </div>

    <!-- New tag form -->
    <div v-if="showNewTag" class="new-tag-form">
      <input
        v-model="newTagText"
        class="tag-input"
        placeholder="Tag name..."
        @keydown.enter="createTag"
        @keydown.escape="showNewTag = false"
      />
      <div class="color-picker">
        <button
          v-for="color in tagColors"
          :key="color"
          class="color-option"
          :class="{ selected: newTagColor === color }"
          :style="{ backgroundColor: color }"
          @click="newTagColor = color"
        />
      </div>
      <div class="form-actions">
        <button class="cancel-btn" @click="showNewTag = false">Cancel</button>
        <button class="create-btn" :disabled="!newTagText.trim()" @click="createTag">
          Create
        </button>
      </div>
    </div>

    <!-- Tags list -->
    <div class="tags-content">
      <div v-if="allTags.length === 0" class="empty-state">
        <Tag :size="24" class="empty-icon" />
        <span>No tags yet</span>
        <span class="empty-hint">Select nodes and create tags</span>
      </div>

      <div v-else class="tags-list">
        <div
          v-for="tag in allTags"
          :key="tag.text"
          class="tag-item"
          :class="{
            'on-selected': selectedNodeTags.has(tag.text),
            'filter-active': isFilterActive(tag.text)
          }"
        >
          <div
            class="tag-color"
            :style="{ backgroundColor: tag.color }"
          />
          <span class="tag-text">{{ tag.text }}</span>
          <span class="tag-count">{{ tag.count }}</span>

          <div class="tag-actions">
            <!-- Filter button -->
            <button
              class="tag-action-btn"
              :class="{ active: isFilterActive(tag.text) }"
              title="Filter by tag"
              @click="toggleFilter(tag.text)"
            >
              <Filter :size="12" />
            </button>

            <!-- Toggle on selected nodes -->
            <button
              v-if="store.selectedNodes.length > 0"
              class="tag-action-btn toggle-btn"
              :class="{ active: isTagOnAllSelected(tag.text) }"
              :title="isTagOnAllSelected(tag.text) ? 'Remove from selected' : 'Add to selected'"
              @click="toggleTagOnSelected(tag.text, tag.color)"
            >
              <Check v-if="isTagOnAllSelected(tag.text)" :size="12" />
              <Plus v-else :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Active filters -->
    <div v-if="activeFilters.length > 0" class="active-filters">
      <div class="filters-header">
        <Filter :size="12" />
        <span>Filtering by:</span>
      </div>
      <div class="filter-tags">
        <div
          v-for="filter in activeFilters"
          :key="filter"
          class="filter-tag"
        >
          <span>{{ filter }}</span>
          <button class="remove-filter" @click="toggleFilter(filter)">
            <X :size="10" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tags-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(30, 30, 30, 0.98);
  color: white;
}

.tags-header {
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

.header-actions {
  display: flex;
  gap: 4px;
}

.add-tag-btn,
.clear-filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s ease;
}

.add-tag-btn:hover,
.clear-filter-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.clear-filter-btn {
  color: #f59e0b;
}

/* New tag form */
.new-tag-form {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

.tag-input {
  width: 100%;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: white;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.tag-input:focus {
  border-color: #3b82f6;
}

.tag-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.color-picker {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.color-option {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: white;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: flex-end;
}

.cancel-btn,
.create-btn {
  padding: 6px 14px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.create-btn {
  background: #3b82f6;
  color: white;
}

.create-btn:hover:not(:disabled) {
  background: #2563eb;
}

.create-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Tags content */
.tags-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

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

/* Tags list */
.tags-list {
  display: flex;
  flex-direction: column;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: default;
  transition: background 0.15s ease;
}

.tag-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tag-item.on-selected {
  background: rgba(59, 130, 246, 0.1);
}

.tag-item.filter-active {
  background: rgba(245, 158, 11, 0.1);
}

.tag-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.tag-text {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

.tag-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tag-item:hover .tag-actions {
  opacity: 1;
}

.tag-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s ease;
}

.tag-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.tag-action-btn.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.toggle-btn.active {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

/* Active filters */
.active-filters {
  padding: 10px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(245, 158, 11, 0.05);
}

.filters-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #f59e0b;
  margin-bottom: 8px;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(245, 158, 11, 0.2);
  border-radius: 4px;
  font-size: 11px;
  color: #fbbf24;
}

.remove-filter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s ease;
}

.remove-filter:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Scrollbar */
.tags-content::-webkit-scrollbar {
  width: 8px;
}

.tags-content::-webkit-scrollbar-track {
  background: transparent;
}

.tags-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.tags-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
