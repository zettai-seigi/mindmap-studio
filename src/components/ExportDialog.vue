<script setup lang="ts">
import { ref, computed } from 'vue';
import { X, Download, Image, FileImage } from 'lucide-vue-next';

const props = defineProps<{
  visible: boolean;
  canvasRef: {
    getContentBounds: (padding?: number) => { width: number; height: number };
    renderToImage: (options: {
      mode: 'full' | 'visible';
      scale: number;
      format: 'png' | 'jpeg';
      quality?: number;
    }) => string | null;
  } | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Export options
const exportMode = ref<'full' | 'visible'>('full');
const exportFormat = ref<'png' | 'jpeg'>('png');
const exportScale = ref(2); // 2x by default for good quality

const scaleOptions = [
  { value: 1, label: '1x (Standard)', description: 'Smaller file size' },
  { value: 2, label: '2x (High)', description: 'Good for printing' },
  { value: 3, label: '3x (Very High)', description: 'Large posters' },
  { value: 4, label: '4x (Ultra)', description: 'Maximum quality' },
];

// Estimated dimensions
const estimatedSize = computed(() => {
  if (!props.canvasRef) return { width: 0, height: 0 };

  if (exportMode.value === 'full') {
    const bounds = props.canvasRef.getContentBounds(50);
    return {
      width: Math.round(bounds.width * exportScale.value),
      height: Math.round(bounds.height * exportScale.value),
    };
  } else {
    return {
      width: Math.round(window.innerWidth * exportScale.value),
      height: Math.round(window.innerHeight * exportScale.value),
    };
  }
});

function handleExport() {
  if (!props.canvasRef) return;

  const dataUrl = props.canvasRef.renderToImage({
    mode: exportMode.value,
    scale: exportScale.value,
    format: exportFormat.value,
    quality: exportFormat.value === 'jpeg' ? 0.92 : undefined,
  });

  if (!dataUrl) return;

  // Create download link
  const link = document.createElement('a');
  link.download = `mindmap-${Date.now()}.${exportFormat.value}`;
  link.href = dataUrl;
  link.click();

  emit('close');
}

function handlePrint() {
  if (!props.canvasRef) return;

  // Always use full map for printing
  const dataUrl = props.canvasRef.renderToImage({
    mode: 'full',
    scale: 2, // Good print quality
    format: 'png',
  });

  if (!dataUrl) return;

  // Open print dialog with image
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Mind Map</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img { max-width: 100%; max-height: 100vh; object-fit: contain; }
            @media print {
              body { display: block; }
              img { max-width: 100%; max-height: none; width: 100%; }
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="export-overlay" @click.self="emit('close')">
        <div class="export-dialog">
          <!-- Header -->
          <div class="dialog-header">
            <h2>Export Image</h2>
            <button class="close-btn" @click="emit('close')">
              <X :size="18" />
            </button>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <!-- Export Mode -->
            <div class="option-group">
              <label class="option-label">What to export</label>
              <div class="option-buttons">
                <button
                  class="mode-btn"
                  :class="{ active: exportMode === 'full' }"
                  @click="exportMode = 'full'"
                >
                  <Image :size="20" />
                  <span class="mode-title">Entire Mind Map</span>
                  <span class="mode-desc">All nodes, perfect for printing</span>
                </button>
                <button
                  class="mode-btn"
                  :class="{ active: exportMode === 'visible' }"
                  @click="exportMode = 'visible'"
                >
                  <FileImage :size="20" />
                  <span class="mode-title">Visible Area</span>
                  <span class="mode-desc">Current view on screen</span>
                </button>
              </div>
            </div>

            <!-- Resolution -->
            <div class="option-group">
              <label class="option-label">Resolution</label>
              <div class="scale-options">
                <button
                  v-for="opt in scaleOptions"
                  :key="opt.value"
                  class="scale-btn"
                  :class="{ active: exportScale === opt.value }"
                  @click="exportScale = opt.value"
                >
                  <span class="scale-label">{{ opt.label }}</span>
                  <span class="scale-desc">{{ opt.description }}</span>
                </button>
              </div>
            </div>

            <!-- Format -->
            <div class="option-group">
              <label class="option-label">Format</label>
              <div class="format-options">
                <button
                  class="format-btn"
                  :class="{ active: exportFormat === 'png' }"
                  @click="exportFormat = 'png'"
                >
                  PNG
                  <span class="format-hint">Transparent, lossless</span>
                </button>
                <button
                  class="format-btn"
                  :class="{ active: exportFormat === 'jpeg' }"
                  @click="exportFormat = 'jpeg'"
                >
                  JPEG
                  <span class="format-hint">Smaller file size</span>
                </button>
              </div>
            </div>

            <!-- Preview info -->
            <div class="preview-info">
              <span class="info-label">Output size:</span>
              <span class="info-value">{{ estimatedSize.width }} x {{ estimatedSize.height }} px</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <button class="action-btn secondary" @click="handlePrint">
              Print
            </button>
            <button class="action-btn primary" @click="handleExport">
              <Download :size="16" />
              Download
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.export-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.export-dialog {
  background: var(--bg-panel);
  border-radius: 12px;
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-lg);
  width: 420px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-primary);
}

.dialog-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-muted);
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--border-primary);
  color: var(--text-primary);
}

.dialog-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.option-buttons {
  display: flex;
  gap: 8px;
}

.mode-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-primary);
  border-radius: 8px;
  transition: all 0.15s;
  text-align: left;
  color: var(--text-secondary);
}

.mode-btn:hover {
  border-color: var(--text-muted);
}

.mode-btn.active {
  border-color: var(--accent-primary);
  background: rgba(59, 130, 246, 0.1);
}

.mode-btn.active .mode-title {
  color: var(--accent-primary);
}

.mode-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.mode-desc {
  font-size: 11px;
  color: var(--text-muted);
}

.scale-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.scale-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-primary);
  border-radius: 6px;
  transition: all 0.15s;
  text-align: left;
}

.scale-btn:hover {
  border-color: var(--text-muted);
}

.scale-btn.active {
  border-color: var(--accent-primary);
  background: rgba(59, 130, 246, 0.1);
}

.scale-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.scale-btn.active .scale-label {
  color: var(--accent-primary);
}

.scale-desc {
  font-size: 11px;
  color: var(--text-muted);
}

.format-options {
  display: flex;
  gap: 8px;
}

.format-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-primary);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  transition: all 0.15s;
}

.format-btn:hover {
  border-color: var(--text-muted);
}

.format-btn.active {
  border-color: var(--accent-primary);
  background: rgba(59, 130, 246, 0.1);
  color: var(--accent-primary);
}

.format-hint {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-muted);
}

.preview-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.info-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.info-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  font-family: monospace;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-secondary);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}

.action-btn.secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
}

.action-btn.secondary:hover {
  background: var(--border-primary);
  color: var(--text-primary);
}

.action-btn.primary {
  background: var(--accent-primary);
  color: white;
}

.action-btn.primary:hover {
  background: var(--accent-hover);
}

/* Modal transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .export-dialog,
.modal-fade-leave-active .export-dialog {
  transition: transform 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .export-dialog,
.modal-fade-leave-to .export-dialog {
  transform: scale(0.95);
}
</style>
