<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import type { MindMapNode } from '../types';
import { ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-vue-next';

const store = useMindMapStore();

// Track which nodes are expanded in outline view
const expandedNodes = ref<Set<string>>(new Set());

// Editing state
const editingNodeId = ref<string | null>(null);
const editingText = ref('');

// Input refs map
const inputRefs = ref<Map<string, HTMLInputElement>>(new Map());

function setInputRef(el: HTMLInputElement | null, nodeId: string) {
  if (el) {
    inputRefs.value.set(nodeId, el);
  } else {
    inputRefs.value.delete(nodeId);
  }
}

// Initialize with all nodes expanded
function initExpandedNodes(node: MindMapNode) {
  if (node.children.length > 0) {
    expandedNodes.value.add(node.id);
    node.children.forEach(initExpandedNodes);
  }
}

// Watch for root changes and initialize
watch(() => store.root, (root) => {
  if (root) {
    expandedNodes.value.clear();
    initExpandedNodes(root);
  }
}, { immediate: true });

function toggleExpand(nodeId: string) {
  if (expandedNodes.value.has(nodeId)) {
    expandedNodes.value.delete(nodeId);
  } else {
    expandedNodes.value.add(nodeId);
  }
}

function isExpanded(nodeId: string): boolean {
  return expandedNodes.value.has(nodeId);
}

function startEditing(node: MindMapNode) {
  editingNodeId.value = node.id;
  editingText.value = node.text;
  nextTick(() => {
    const inputEl = inputRefs.value.get(node.id);
    inputEl?.focus();
    inputEl?.select();
  });
}

function finishEditing() {
  if (editingNodeId.value && editingText.value.trim()) {
    store.updateNodeText(editingNodeId.value, editingText.value.trim());
  }
  editingNodeId.value = null;
  editingText.value = '';
}

function cancelEditing() {
  editingNodeId.value = null;
  editingText.value = '';
}

function handleKeydown(e: KeyboardEvent, node: MindMapNode) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    finishEditing();
  } else if (e.key === 'Escape') {
    cancelEditing();
  } else if (e.key === 'Tab' && editingNodeId.value) {
    e.preventDefault();
    finishEditing();
    // Add child to the current node
    const newNode = store.addChild(node.id, 'New Topic');
    if (newNode) {
      expandedNodes.value.add(node.id);
      nextTick(() => {
        editingNodeId.value = newNode.id;
        editingText.value = newNode.text;
      });
    }
  }
}

function addChildToNode(nodeId: string) {
  const newNode = store.addChild(nodeId, 'New Topic');
  if (newNode) {
    expandedNodes.value.add(nodeId);
    nextTick(() => {
      editingNodeId.value = newNode.id;
      editingText.value = newNode.text;
    });
  }
}

function deleteNodeFromOutline(nodeId: string) {
  if (nodeId !== store.root.id) {
    store.deleteNode(nodeId);
  }
}

function selectNode(nodeId: string, e: MouseEvent) {
  store.selectNode(nodeId, e.metaKey || e.ctrlKey);
}

const selectedNodeIds = computed(() => store.canvasState.selectedNodeIds);

// Get node level color
function getNodeColor(level: number): string {
  const colorOptions = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  return colorOptions[level % colorOptions.length] || '#3b82f6';
}

// Flatten tree for rendering
interface FlatNode {
  node: MindMapNode;
  level: number;
}

function flattenTree(node: MindMapNode, level: number = 0): FlatNode[] {
  const result: FlatNode[] = [{ node, level }];

  if (node.children.length > 0 && isExpanded(node.id)) {
    for (const child of node.children) {
      result.push(...flattenTree(child, level + 1));
    }
  }

  return result;
}

const flatNodes = computed(() => flattenTree(store.root));
</script>

<template>
  <div class="outline-view">
    <div class="outline-header">
      <h2 class="outline-title">Outline</h2>
      <span class="outline-hint">Tab to add child, Enter to edit</span>
    </div>

    <div class="outline-content">
      <div
        v-for="{ node, level } in flatNodes"
        :key="node.id"
        class="outline-node"
        :class="{
          selected: selectedNodeIds.includes(node.id),
          editing: editingNodeId === node.id
        }"
        :style="{ paddingLeft: (level * 24 + 12) + 'px' }"
        @click="selectNode(node.id, $event)"
        @dblclick="startEditing(node)"
      >
        <!-- Expand/Collapse button -->
        <button
          v-if="node.children.length > 0"
          class="expand-btn"
          @click.stop="toggleExpand(node.id)"
        >
          <ChevronDown v-if="isExpanded(node.id)" :size="14" />
          <ChevronRight v-else :size="14" />
        </button>
        <div v-else class="expand-placeholder" />

        <!-- Level indicator -->
        <div
          class="level-indicator"
          :style="{ backgroundColor: getNodeColor(level) }"
        />

        <!-- Node content -->
        <div class="node-content">
          <input
            v-if="editingNodeId === node.id"
            :ref="(el) => setInputRef(el as HTMLInputElement, node.id)"
            v-model="editingText"
            class="edit-input"
            @blur="finishEditing"
            @keydown="handleKeydown($event, node)"
            @click.stop
          />
          <span v-else class="node-text">{{ node.text }}</span>
        </div>

        <!-- Markers preview -->
        <div v-if="node.markers.length > 0" class="markers-preview">
          <span
            v-for="marker in node.markers.slice(0, 2)"
            :key="marker.id"
            class="marker-badge"
            :style="{ backgroundColor: marker.color || '#3b82f6' }"
          >
            {{ marker.value }}
          </span>
        </div>

        <!-- Node actions -->
        <div class="node-actions">
          <button
            class="action-btn"
            title="Add child (Tab)"
            @click.stop="addChildToNode(node.id)"
          >
            <Plus :size="14" />
          </button>
          <button
            v-if="level > 0"
            class="action-btn delete"
            title="Delete"
            @click.stop="deleteNodeFromOutline(node.id)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.outline-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(30, 30, 30, 0.98);
  color: white;
}

.outline-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.outline-title {
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.outline-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.outline-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.outline-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  padding-right: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
  min-height: 36px;
  user-select: none;
}

.outline-node:hover {
  background: rgba(255, 255, 255, 0.05);
}

.outline-node.selected {
  background: rgba(59, 130, 246, 0.2);
}

.outline-node.editing {
  background: rgba(59, 130, 246, 0.15);
}

.expand-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.expand-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.expand-placeholder {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.level-indicator {
  width: 4px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.node-content {
  flex: 1;
  min-width: 0;
}

.node-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.edit-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 14px;
  color: white;
  outline: none;
}

.edit-input:focus {
  border-color: #3b82f6;
}

.markers-preview {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.marker-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  color: white;
  font-weight: 500;
}

.node-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.outline-node:hover .node-actions {
  opacity: 1;
}

.action-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Scrollbar styling */
.outline-content::-webkit-scrollbar {
  width: 8px;
}

.outline-content::-webkit-scrollbar-track {
  background: transparent;
}

.outline-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.outline-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
