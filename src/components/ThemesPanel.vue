<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { getThemesByCategory, getCategories } from '../themes';
import type { MapTheme } from '../types';
import { ChevronDown, ChevronRight, Check } from 'lucide-vue-next';

const store = useMindMapStore();

// Get current theme
const currentThemeId = computed(() => store.currentMap.theme.id);

// Collapsed categories
const collapsedCategories = ref<Set<string>>(new Set());

function toggleCategory(categoryId: string) {
  const newSet = new Set(collapsedCategories.value);
  if (newSet.has(categoryId)) {
    newSet.delete(categoryId);
  } else {
    newSet.add(categoryId);
  }
  collapsedCategories.value = newSet;
}

function isCategoryCollapsed(categoryId: string): boolean {
  return collapsedCategories.value.has(categoryId);
}

// Get categories with themes
const categories = computed(() => {
  return getCategories().map(cat => ({
    ...cat,
    themes: getThemesByCategory(cat.id),
  }));
});

// Apply theme
function applyTheme(theme: MapTheme) {
  store.setTheme(theme);
}

// Generate mini preview for a theme
function getPreviewStyle(theme: MapTheme) {
  return {
    background: theme.colors.background,
  };
}

function getRootStyle(theme: MapTheme) {
  return {
    backgroundColor: theme.colors.rootNode,
    color: theme.colors.rootNodeText,
    borderRadius: theme.rootShape === 'ellipse' ? '50%' :
                  theme.rootShape === 'rectangle' ? '2px' : '6px',
  };
}

function getBranchStyle(theme: MapTheme, index: number) {
  const color = theme.colors.branches[index % theme.colors.branches.length];
  const bgColor = theme.branchShape === 'underline'
    ? 'transparent'
    : (theme.rainbowBranches ? color : theme.colors.branches[0]);
  return {
    backgroundColor: bgColor,
    color: theme.colors.branchText,
    borderRadius: theme.branchShape === 'ellipse' ? '50%' :
                  theme.branchShape === 'rectangle' ? '2px' :
                  theme.branchShape === 'none' ? '0' : '4px',
    borderBottom: theme.branchShape === 'underline' ? `2px solid ${color}` : 'none',
  };
}

function getLineStyle(theme: MapTheme) {
  return {
    backgroundColor: theme.colors.lines,
  };
}
</script>

<template>
  <div class="themes-panel">
    <!-- Categories -->
    <div
      v-for="category in categories"
      :key="category.id"
      class="theme-category"
    >
      <!-- Category Header -->
      <button
        class="category-header"
        @click="toggleCategory(category.id)"
      >
        <ChevronRight
          v-if="isCategoryCollapsed(category.id)"
          :size="14"
          class="category-chevron"
        />
        <ChevronDown
          v-else
          :size="14"
          class="category-chevron"
        />
        <span class="category-name">{{ category.name }}</span>
        <span class="category-count">{{ category.themes.length }}</span>
      </button>

      <!-- Theme Grid -->
      <div
        v-show="!isCategoryCollapsed(category.id)"
        class="themes-grid"
      >
        <button
          v-for="theme in category.themes"
          :key="theme.id"
          class="theme-item"
          :class="{ active: currentThemeId === theme.id }"
          :title="theme.name"
          @click="applyTheme(theme)"
        >
          <!-- Theme Preview -->
          <div class="theme-preview" :style="getPreviewStyle(theme)">
            <!-- Mini mindmap visualization -->
            <div class="preview-content">
              <!-- Root node -->
              <div class="preview-root" :style="getRootStyle(theme)"></div>

              <!-- Branches -->
              <div class="preview-branches">
                <div class="preview-branch-group top">
                  <div class="preview-line" :style="getLineStyle(theme)"></div>
                  <div class="preview-branch" :style="getBranchStyle(theme, 0)"></div>
                </div>
                <div class="preview-branch-group right">
                  <div class="preview-line horizontal" :style="getLineStyle(theme)"></div>
                  <div class="preview-branch" :style="getBranchStyle(theme, 1)"></div>
                </div>
                <div class="preview-branch-group bottom">
                  <div class="preview-line" :style="getLineStyle(theme)"></div>
                  <div class="preview-branch" :style="getBranchStyle(theme, 2)"></div>
                </div>
              </div>
            </div>

            <!-- Selected indicator -->
            <div v-if="currentThemeId === theme.id" class="theme-selected">
              <Check :size="14" />
            </div>
          </div>

          <!-- Theme Name -->
          <span class="theme-name">{{ theme.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.themes-panel {
  padding: 0;
}

.theme-category {
  margin-bottom: 2px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  transition: background-color 0.1s;
  border-bottom: 1px solid var(--border-secondary);
}

.category-header:hover {
  background: var(--border-secondary);
}

.category-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
}

.category-name {
  font-size: 13px;
  font-weight: 500;
  color: #60a5fa;
  flex: 1;
}

.category-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--border-secondary);
  padding: 2px 6px;
  border-radius: 10px;
}

.themes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px;
  background: var(--border-secondary);
}

.theme-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.theme-item:hover {
  transform: scale(1.02);
}

.theme-item:hover .theme-preview {
  border-color: var(--text-muted);
}

.theme-item.active .theme-preview {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.theme-preview {
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: 8px;
  border: 2px solid var(--border-primary);
  overflow: hidden;
  position: relative;
  transition: all 0.15s ease;
}

.preview-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.preview-root {
  width: 24px;
  height: 14px;
  z-index: 2;
}

.preview-branches {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-branch-group {
  position: absolute;
  display: flex;
  align-items: center;
}

.preview-branch-group.top {
  flex-direction: column;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
}

.preview-branch-group.right {
  flex-direction: row;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
}

.preview-branch-group.bottom {
  flex-direction: column-reverse;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
}

.preview-line {
  width: 2px;
  height: 8px;
}

.preview-line.horizontal {
  width: 8px;
  height: 2px;
}

.preview-branch {
  width: 18px;
  height: 8px;
}

.theme-selected {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.theme-name {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.theme-item.active .theme-name {
  color: #60a5fa;
  font-weight: 500;
}
</style>
