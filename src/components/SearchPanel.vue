<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { Search, X, ChevronRight, ChevronLeft } from 'lucide-vue-next';
import type { MindMapNode } from '../types';

const store = useMindMapStore();

const emit = defineEmits<{
  close: [];
}>();

// Search state
const searchQuery = ref('');
const caseSensitive = ref(false);
const currentResultIndex = ref(0);

// Flatten all nodes for searching
function flattenNodes(node: MindMapNode): MindMapNode[] {
  const result: MindMapNode[] = [node];
  node.children.forEach(child => {
    result.push(...flattenNodes(child));
  });
  return result;
}

const allNodes = computed(() => {
  const nodes = flattenNodes(store.root);
  // Add floating topics
  store.floatingTopics.forEach(topic => {
    nodes.push(...flattenNodes(topic));
  });
  return nodes;
});

// Search results
const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return [];

  const query = caseSensitive.value
    ? searchQuery.value
    : searchQuery.value.toLowerCase();

  return allNodes.value.filter(node => {
    const text = caseSensitive.value
      ? node.text
      : node.text.toLowerCase();
    return text.includes(query);
  });
});

// Navigate through results
function nextResult() {
  if (searchResults.value.length === 0) return;
  currentResultIndex.value = (currentResultIndex.value + 1) % searchResults.value.length;
  selectCurrentResult();
}

function prevResult() {
  if (searchResults.value.length === 0) return;
  currentResultIndex.value = (currentResultIndex.value - 1 + searchResults.value.length) % searchResults.value.length;
  selectCurrentResult();
}

function selectCurrentResult() {
  const result = searchResults.value[currentResultIndex.value];
  if (result) {
    store.selectNode(result.id);
    // Expand parents to show the node
    store.expandParentsOf(result.id);
  }
}

function selectResult(index: number) {
  currentResultIndex.value = index;
  selectCurrentResult();
}

// Clear search
function clearSearch() {
  searchQuery.value = '';
  currentResultIndex.value = 0;
}

// Handle keyboard navigation
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      prevResult();
    } else {
      nextResult();
    }
  } else if (e.key === 'Escape') {
    emit('close');
  }
}

// Reset index when results change
watch(searchResults, () => {
  currentResultIndex.value = 0;
  if (searchResults.value.length > 0) {
    selectCurrentResult();
  }
});

// Get path to node
function getNodePath(nodeId: string): string[] {
  const path: string[] = [];
  let current = store.findNodeById(nodeId);

  while (current) {
    path.unshift(current.text);
    const parent = store.findParentNode(current.id);
    if (!parent || parent.id === current.id) break;
    current = parent;
  }

  return path;
}

// Highlight matched text
function highlightMatch(text: string): string {
  if (!searchQuery.value.trim()) return text;

  const query = caseSensitive.value ? searchQuery.value : searchQuery.value.toLowerCase();
  const searchText = caseSensitive.value ? text : text.toLowerCase();
  const index = searchText.indexOf(query);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + searchQuery.value.length);
  const after = text.slice(index + searchQuery.value.length);

  return before + '<mark>' + match + '</mark>' + after;
}
</script>

<template>
  <div class="search-panel">
    <!-- Search input -->
    <div class="search-input-wrapper">
      <Search :size="16" class="search-icon" />
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search nodes..."
        autofocus
        @keydown="handleKeyDown"
      />
      <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
        <X :size="14" />
      </button>
    </div>

    <!-- Options -->
    <div class="search-options">
      <label class="option">
        <input type="checkbox" v-model="caseSensitive" />
        <span>Case sensitive</span>
      </label>
      <span class="results-count" v-if="searchQuery">
        {{ searchResults.length }} result{{ searchResults.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Navigation -->
    <div v-if="searchResults.length > 0" class="search-nav">
      <button class="nav-btn" @click="prevResult" title="Previous (Shift+Enter)">
        <ChevronLeft :size="16" />
      </button>
      <span class="nav-position">{{ currentResultIndex + 1 }} / {{ searchResults.length }}</span>
      <button class="nav-btn" @click="nextResult" title="Next (Enter)">
        <ChevronRight :size="16" />
      </button>
    </div>

    <!-- Results list -->
    <div class="results-list">
      <div v-if="!searchQuery.trim()" class="empty-state">
        <Search :size="24" class="empty-icon" />
        <span>Type to search nodes</span>
      </div>

      <div v-else-if="searchResults.length === 0" class="empty-state">
        <span>No results found</span>
      </div>

      <div
        v-else
        v-for="(result, index) in searchResults"
        :key="result.id"
        class="result-item"
        :class="{ active: index === currentResultIndex }"
        @click="selectResult(index)"
      >
        <div class="result-text" v-html="highlightMatch(result.text)" />
        <div class="result-path">
          <span
            v-for="(segment, i) in getNodePath(result.id).slice(0, -1)"
            :key="i"
            class="path-segment"
          >
            {{ segment }}
            <span v-if="i < getNodePath(result.id).length - 2" class="path-separator">/</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  width: 300px;
  max-height: 400px;
  background: rgba(30, 30, 30, 0.98);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

/* Search input */
.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.search-icon {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: white;
  font-size: 14px;
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.15s;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Options */
.search-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}

.option input {
  accent-color: #3b82f6;
}

.results-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* Navigation */
.search-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav-position {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 60px;
  text-align: center;
}

/* Results list */
.results-list {
  flex: 1;
  overflow-y: auto;
  max-height: 250px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 8px;
  text-align: center;
}

.empty-icon {
  color: rgba(255, 255, 255, 0.2);
}

.empty-state span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
}

.result-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.result-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.result-item.active {
  background: rgba(59, 130, 246, 0.15);
}

.result-text {
  font-size: 13px;
  color: white;
  margin-bottom: 4px;
}

.result-text :deep(mark) {
  background: #f59e0b;
  color: black;
  padding: 0 2px;
  border-radius: 2px;
}

.result-path {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-segment {
  color: rgba(255, 255, 255, 0.4);
}

.path-separator {
  color: rgba(255, 255, 255, 0.2);
  margin: 0 4px;
}

/* Scrollbar */
.results-list::-webkit-scrollbar {
  width: 8px;
}

.results-list::-webkit-scrollbar-track {
  background: transparent;
}

.results-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.results-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
