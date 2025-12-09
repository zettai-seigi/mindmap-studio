<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { Link2, Plus, ArrowRight } from 'lucide-vue-next';
import RelationshipItem from './RelationshipItem.vue';

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

// Update relationship handlers
function updateRelStyle(relId: string, style: 'solid' | 'dashed' | 'dotted') {
  store.updateRelationship(relId, { style });
}

function updateRelColor(relId: string, color: string) {
  store.updateRelationship(relId, { color });
}

function updateRelLabel(relId: string, label: string) {
  store.updateRelationship(relId, { label });
}

function toggleStartArrow(relId: string) {
  const rel = relationships.value.find(r => r.id === relId);
  if (rel) {
    store.updateRelationship(relId, { startArrow: !rel.startArrow });
  }
}

function toggleEndArrow(relId: string) {
  const rel = relationships.value.find(r => r.id === relId);
  if (rel) {
    store.updateRelationship(relId, { endArrow: !rel.endArrow });
  }
}

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

function deleteRelationship(relId: string) {
  store.removeRelationship(relId);
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
        <RelationshipItem
          :relationship="selectedRelationship"
          :source-text="getNodeText(selectedRelationship.sourceId)"
          :target-text="getNodeText(selectedRelationship.targetId)"
          :is-selected="true"
          @update-style="updateRelStyle(selectedRelationship.id, $event)"
          @update-color="updateRelColor(selectedRelationship.id, $event)"
          @update-label="updateRelLabel(selectedRelationship.id, $event)"
          @toggle-start-arrow="toggleStartArrow(selectedRelationship.id)"
          @toggle-end-arrow="toggleEndArrow(selectedRelationship.id)"
          @set-bidirectional="setBidirectional(selectedRelationship.id)"
          @delete="deleteRelationship(selectedRelationship.id)"
        />
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
        <RelationshipItem
          v-for="rel in nodeRelationships"
          :key="rel.id"
          :relationship="rel"
          :source-text="getNodeText(rel.sourceId)"
          :target-text="getNodeText(rel.targetId)"
          :highlight-source="rel.sourceId === selectedNode?.id"
          :highlight-target="rel.targetId === selectedNode?.id"
          @update-style="updateRelStyle(rel.id, $event)"
          @update-color="updateRelColor(rel.id, $event)"
          @update-label="updateRelLabel(rel.id, $event)"
          @toggle-start-arrow="toggleStartArrow(rel.id)"
          @toggle-end-arrow="toggleEndArrow(rel.id)"
          @set-bidirectional="setBidirectional(rel.id)"
          @delete="deleteRelationship(rel.id)"
        />
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
