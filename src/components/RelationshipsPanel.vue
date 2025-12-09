<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { Link2, Plus, Trash2, ArrowRight, ArrowLeft, Edit3, Check, X, ArrowLeftRight } from 'lucide-vue-next';

const store = useMindMapStore();

// Currently selected node
const selectedNode = computed(() => {
  const id = store.canvasState.selectedNodeIds[0];
  return id ? store.findNodeById(id) : null;
});

// Currently selected relationship (from canvas)
const selectedRelationship = computed(() => {
  const id = store.canvasState.selectedRelationshipId;
  return id ? store.relationships.find(r => r.id === id) : null;
});

// Get all relationships
const relationships = computed(() => store.relationships);

// Relationship style options
const lineStyles = ['solid', 'dashed', 'dotted'] as const;
const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

// Editing state
const editingId = ref<string | null>(null);
const editLabel = ref('');

// Create relationship mode
const isCreatingRelationship = ref(false);
const newRelSource = ref<string | null>(null);

// Get node text by ID
function getNodeText(nodeId: string): string {
  const node = store.findNodeById(nodeId);
  return node?.text || 'Unknown';
}

// Start creating a relationship
function startCreateRelationship() {
  if (!selectedNode.value) return;
  newRelSource.value = selectedNode.value.id;
  isCreatingRelationship.value = true;
  store.startLinkMode(selectedNode.value.id);
}

// Cancel creating a relationship
function cancelCreateRelationship() {
  isCreatingRelationship.value = false;
  newRelSource.value = null;
  store.cancelLinkMode();
}

// Delete a relationship
function deleteRelationship(relId: string) {
  store.removeRelationship(relId);
}

// Start editing a relationship label
function startEditLabel(rel: typeof relationships.value[0]) {
  editingId.value = rel.id;
  editLabel.value = rel.label || '';
}

// Save label edit
function saveLabel(relId: string) {
  store.updateRelationship(relId, { label: editLabel.value });
  editingId.value = null;
  editLabel.value = '';
}

// Cancel label edit
function cancelEdit() {
  editingId.value = null;
  editLabel.value = '';
}

// Update relationship style
function updateRelStyle(relId: string, style: 'solid' | 'dashed' | 'dotted') {
  store.updateRelationship(relId, { style });
}

// Update relationship color
function updateRelColor(relId: string, color: string) {
  store.updateRelationship(relId, { color });
}

// Toggle start arrow
function toggleStartArrow(relId: string) {
  const rel = relationships.value.find(r => r.id === relId);
  if (rel) {
    store.updateRelationship(relId, { startArrow: !rel.startArrow });
  }
}

// Toggle end arrow
function toggleEndArrow(relId: string) {
  const rel = relationships.value.find(r => r.id === relId);
  if (rel) {
    store.updateRelationship(relId, { endArrow: !rel.endArrow });
  }
}

// Set bidirectional (both arrows)
function setBidirectional(relId: string) {
  const rel = relationships.value.find(r => r.id === relId);
  if (rel) {
    const bothActive = rel.startArrow && rel.endArrow;
    store.updateRelationship(relId, {
      startArrow: !bothActive,
      endArrow: !bothActive
    });
  }
}

// Get relationships for selected node
const nodeRelationships = computed(() => {
  if (!selectedNode.value) return [];
  return relationships.value.filter(
    r => r.sourceId === selectedNode.value!.id || r.targetId === selectedNode.value!.id
  );
});
</script>

<template>
  <div class="relationships-panel">
    <div class="panel-header">
      <div class="header-left">
        <Link2 :size="14" />
        <span class="header-title">Relationships</span>
      </div>
      <button
        v-if="selectedNode && !isCreatingRelationship"
        class="add-btn"
        title="Create relationship from selected node"
        @click="startCreateRelationship"
      >
        <Plus :size="14" />
      </button>
    </div>

    <div class="panel-content">
      <!-- Create relationship mode -->
      <div v-if="isCreatingRelationship" class="create-mode">
        <div class="create-info">
          <span class="create-label">From:</span>
          <span class="create-node">{{ getNodeText(newRelSource!) }}</span>
        </div>
        <div class="create-hint">
          <ArrowRight :size="14" />
          <span>Click on another node to create a relationship</span>
        </div>
        <button class="cancel-btn" @click="cancelCreateRelationship">
          Cancel
        </button>
      </div>

      <!-- Selected relationship (from canvas click) -->
      <div v-else-if="selectedRelationship" class="relationships-list">
        <div class="section-label">Selected Relationship</div>
        <div class="relationship-item selected">
          <!-- Relationship nodes -->
          <div class="rel-nodes">
            <span class="rel-node">{{ getNodeText(selectedRelationship.sourceId) }}</span>
            <ArrowRight :size="12" class="rel-arrow" />
            <span class="rel-node">{{ getNodeText(selectedRelationship.targetId) }}</span>
          </div>

          <!-- Label editing -->
          <div v-if="editingId === selectedRelationship.id" class="edit-label">
            <input
              v-model="editLabel"
              class="label-input"
              placeholder="Label..."
              @keydown.enter="saveLabel(selectedRelationship.id)"
              @keydown.escape="cancelEdit"
            />
            <button class="edit-btn save" @click="saveLabel(selectedRelationship.id)">
              <Check :size="12" />
            </button>
            <button class="edit-btn cancel" @click="cancelEdit">
              <X :size="12" />
            </button>
          </div>

          <!-- Label display -->
          <div v-else class="rel-label-row">
            <span class="rel-label" @click="startEditLabel(selectedRelationship)">
              {{ selectedRelationship.label || 'Add label...' }}
            </span>
            <button class="edit-icon-btn" @click="startEditLabel(selectedRelationship)">
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
                :class="{ active: selectedRelationship.style === style }"
                :title="style"
                @click="updateRelStyle(selectedRelationship.id, style)"
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
                :class="{ active: selectedRelationship.color === color }"
                :style="{ backgroundColor: color }"
                @click="updateRelColor(selectedRelationship.id, color)"
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
                :class="{ active: selectedRelationship.startArrow }"
                title="Start arrow"
                @click="toggleStartArrow(selectedRelationship.id)"
              >
                <ArrowLeft :size="12" />
              </button>

              <!-- Bidirectional -->
              <button
                class="arrow-toggle bidir"
                :class="{ active: selectedRelationship.startArrow && selectedRelationship.endArrow }"
                title="Bidirectional"
                @click="setBidirectional(selectedRelationship.id)"
              >
                <ArrowLeftRight :size="12" />
              </button>

              <!-- End arrow (right) -->
              <button
                class="arrow-toggle"
                :class="{ active: selectedRelationship.endArrow }"
                title="End arrow"
                @click="toggleEndArrow(selectedRelationship.id)"
              >
                <ArrowRight :size="12" />
              </button>
            </div>

            <!-- Delete -->
            <button
              class="delete-btn"
              title="Delete relationship"
              @click="deleteRelationship(selectedRelationship.id)"
            >
              <Trash2 :size="12" />
            </button>
          </div>
        </div>
        <div class="hint-text">Drag the blue handles to adjust the curve</div>
      </div>

      <!-- No node selected -->
      <div v-else-if="!selectedNode" class="empty-state">
        <Link2 :size="32" class="empty-icon" />
        <span>Select a node or click a relationship line</span>
      </div>

      <!-- Node relationships -->
      <div v-else-if="nodeRelationships.length === 0" class="empty-state">
        <Link2 :size="32" class="empty-icon" />
        <span>No relationships</span>
        <span class="empty-hint">Click + to create one</span>
      </div>

      <!-- Relationship list -->
      <div v-else class="relationships-list">
        <div
          v-for="rel in nodeRelationships"
          :key="rel.id"
          class="relationship-item"
        >
          <!-- Relationship nodes -->
          <div class="rel-nodes">
            <span
              class="rel-node"
              :class="{ highlight: rel.sourceId === selectedNode?.id }"
            >
              {{ getNodeText(rel.sourceId) }}
            </span>
            <ArrowRight :size="12" class="rel-arrow" />
            <span
              class="rel-node"
              :class="{ highlight: rel.targetId === selectedNode?.id }"
            >
              {{ getNodeText(rel.targetId) }}
            </span>
          </div>

          <!-- Label editing -->
          <div v-if="editingId === rel.id" class="edit-label">
            <input
              v-model="editLabel"
              class="label-input"
              placeholder="Label..."
              @keydown.enter="saveLabel(rel.id)"
              @keydown.escape="cancelEdit"
            />
            <button class="edit-btn save" @click="saveLabel(rel.id)">
              <Check :size="12" />
            </button>
            <button class="edit-btn cancel" @click="cancelEdit">
              <X :size="12" />
            </button>
          </div>

          <!-- Label display -->
          <div v-else class="rel-label-row">
            <span class="rel-label" @click="startEditLabel(rel)">
              {{ rel.label || 'Add label...' }}
            </span>
            <button class="edit-icon-btn" @click="startEditLabel(rel)">
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
                :class="{ active: rel.style === style }"
                :title="style"
                @click="updateRelStyle(rel.id, style)"
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
                :class="{ active: rel.color === color }"
                :style="{ backgroundColor: color }"
                @click="updateRelColor(rel.id, color)"
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
                :class="{ active: rel.startArrow }"
                title="Start arrow"
                @click="toggleStartArrow(rel.id)"
              >
                <ArrowLeft :size="12" />
              </button>

              <!-- Bidirectional -->
              <button
                class="arrow-toggle bidir"
                :class="{ active: rel.startArrow && rel.endArrow }"
                title="Bidirectional"
                @click="setBidirectional(rel.id)"
              >
                <ArrowLeftRight :size="12" />
              </button>

              <!-- End arrow (right) -->
              <button
                class="arrow-toggle"
                :class="{ active: rel.endArrow }"
                title="End arrow"
                @click="toggleEndArrow(rel.id)"
              >
                <ArrowRight :size="12" />
              </button>
            </div>

            <!-- Delete -->
            <button
              class="delete-btn"
              title="Delete relationship"
              @click="deleteRelationship(rel.id)"
            >
              <Trash2 :size="12" />
            </button>
          </div>
        </div>
      </div>

      <!-- All relationships section -->
      <div v-if="relationships.length > 0 && !isCreatingRelationship" class="all-relationships">
        <div class="section-header">
          <span>All Relationships ({{ relationships.length }})</span>
        </div>
        <div class="mini-list">
          <div
            v-for="rel in relationships"
            :key="rel.id"
            class="mini-rel-item"
            :style="{ borderLeftColor: rel.color }"
          >
            <span class="mini-source">{{ getNodeText(rel.sourceId) }}</span>
            <ArrowRight :size="10" class="mini-arrow" />
            <span class="mini-target">{{ getNodeText(rel.targetId) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.relationships-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(30, 30, 30, 0.98);
  color: white;
}

.section-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 8px;
}

.relationship-item.selected {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}

.hint-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  margin-top: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
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

/* Create mode */
.create-mode {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  padding: 12px;
}

.create-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.create-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.create-node {
  font-size: 13px;
  color: #60a5fa;
  font-weight: 500;
}

.create-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
}

.cancel-btn {
  padding: 6px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  transition: all 0.15s;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
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

/* Relationships list */
.relationships-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.relationship-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
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

/* All relationships section */
.all-relationships {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.section-header {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.mini-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mini-rel-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border-left: 2px solid;
  font-size: 11px;
}

.mini-source,
.mini-target {
  color: rgba(255, 255, 255, 0.6);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-arrow {
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
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
