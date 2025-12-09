import type { MindMap, MindMapNode, Marker } from '../types';
import JSZip from 'jszip';

// ============================================
// JSON Export/Import
// ============================================

export function exportToJSON(map: MindMap): string {
  return JSON.stringify(map, null, 2);
}

export function importFromJSON(jsonString: string): MindMap {
  const map = JSON.parse(jsonString) as MindMap;
  // Validate basic structure
  if (!map.id || !map.root || !map.name) {
    throw new Error('Invalid MindMap JSON format');
  }
  return map;
}

// ============================================
// XMind Export/Import
// ============================================

interface XMindTopic {
  id: string;
  class?: string;
  title: string;
  children?: {
    attached?: XMindTopic[];
  };
  markers?: Array<{
    markerId: string;
  }>;
  notes?: {
    plain?: {
      content: string;
    };
  };
  labels?: string[];
  href?: string;
}

interface XMindSheet {
  id: string;
  class?: string;
  title: string;
  rootTopic: XMindTopic;
  relationships?: Array<{
    id: string;
    end1Id: string;
    end2Id: string;
    title?: string;
  }>;
}

interface XMindContent {
  sheets?: XMindSheet[];
}

// Convert MindMapNode to XMind topic format
function nodeToXMindTopic(node: MindMapNode): XMindTopic {
  const topic: XMindTopic = {
    id: node.id,
    title: node.text,
  };

  if (node.children && node.children.length > 0) {
    topic.children = {
      attached: node.children.map(child => nodeToXMindTopic(child)),
    };
  }

  if (node.markers && node.markers.length > 0) {
    topic.markers = node.markers.map(m => ({
      markerId: `${m.category}-${m.id}`,
    }));
  }

  if (node.notes) {
    topic.notes = {
      plain: {
        content: node.notes,
      },
    };
  }

  if (node.labels && node.labels.length > 0) {
    topic.labels = node.labels.map(l => l.text);
  }

  if (node.hyperlink) {
    topic.href = node.hyperlink.url;
  }

  return topic;
}

// Convert XMind topic to MindMapNode format
function xmindTopicToNode(topic: XMindTopic): MindMapNode {
  const node: MindMapNode = {
    id: topic.id || crypto.randomUUID(),
    text: topic.title || 'Untitled',
    children: [],
    markers: [],
    labels: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (topic.children?.attached) {
    node.children = topic.children.attached.map(child => xmindTopicToNode(child));
  }

  if (topic.markers) {
    node.markers = topic.markers.map(m => {
      const parts = m.markerId.split('-');
      const categoryMap: Record<string, Marker['category']> = {
        priority: 'priority',
        progress: 'progress',
        flag: 'flag',
        star: 'star',
        face: 'face',
        arrow: 'arrow',
        symbol: 'symbol',
        month: 'month',
        week: 'week',
        people: 'people',
        clipart: 'clipart',
      };
      const category = categoryMap[parts[0] || ''] || 'custom';
      return {
        id: m.markerId,
        category,
        value: parts.slice(1).join('-'),
        color: '#3b82f6',
      };
    });
  }

  if (topic.notes?.plain?.content) {
    node.notes = topic.notes.plain.content;
  }

  if (topic.labels) {
    node.labels = topic.labels.map((text, i) => ({
      id: `label-${i}`,
      text,
      color: '#3b82f6',
    }));
  }

  if (topic.href) {
    node.hyperlink = {
      type: topic.href.startsWith('http') ? 'web' : 'file',
      url: topic.href,
    };
  }

  return node;
}

export async function exportToXMind(map: MindMap): Promise<Blob> {
  const zip = new JSZip();

  // Create content.json (main XMind format)
  const content: XMindContent[] = [{
    sheets: [{
      id: map.id,
      class: 'sheet',
      title: map.name,
      rootTopic: nodeToXMindTopic(map.root),
      relationships: map.relationships?.map(r => ({
        id: r.id,
        end1Id: r.sourceId,
        end2Id: r.targetId,
        title: r.label,
      })),
    }],
  }];

  zip.file('content.json', JSON.stringify(content));

  // Create metadata.json
  const metadata = {
    creator: {
      name: 'MindMap Studio',
      version: '1.0.0',
    },
    created: new Date().toISOString(),
  };
  zip.file('metadata.json', JSON.stringify(metadata));

  // Create manifest.json
  const manifest = {
    'file-entries': {
      'content.json': {},
      'metadata.json': {},
    },
  };
  zip.file('manifest.json', JSON.stringify(manifest));

  // Generate the zip file
  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.xmind.workbook' });
}

export async function importFromXMind(file: File): Promise<MindMap> {
  const zip = await JSZip.loadAsync(file);

  const fileList = Object.keys(zip.files);

  // Try to read content.json (XMind 8+ format)
  let contentFile = zip.file('content.json');

  if (contentFile) {
    const contentText = await contentFile.async('text');
    const contentRaw = JSON.parse(contentText);

    // Handle various XMind format variations
    let sheet: XMindSheet | undefined;

    if (Array.isArray(contentRaw)) {
      // Check if it's an array of sheets directly: [{ id, class: "sheet", rootTopic: {...} }]
      if (contentRaw[0]?.rootTopic) {
        sheet = contentRaw[0] as XMindSheet;
      }
      // Or format: [{ sheets: [...] }]
      else if (contentRaw[0]?.sheets?.[0]) {
        const firstItem = (contentRaw as XMindContent[])[0];
        if (firstItem && firstItem.sheets && firstItem.sheets[0]) {
          sheet = firstItem.sheets[0];
        }
      }
    } else if (contentRaw.sheets) {
      // Format: { sheets: [...] }
      sheet = (contentRaw as XMindContent).sheets?.[0];
    } else if (contentRaw.rootTopic) {
      // Format: Direct sheet object
      sheet = contentRaw as XMindSheet;
    }

    // Also check if it's a flat structure with root topic at top level
    if (!sheet && contentRaw.id && contentRaw.title) {
      // Some XMind exports have topics directly
      const rootTopic: XMindTopic = {
        id: contentRaw.id,
        title: contentRaw.title || 'Imported Map',
        children: contentRaw.children,
      };
      sheet = {
        id: contentRaw.id,
        title: contentRaw.title,
        rootTopic: rootTopic,
      };
    }

    if (!sheet?.rootTopic) {
      throw new Error('Invalid XMind file: missing root topic.');
    }

    const rootNode = xmindTopicToNode(sheet.rootTopic);

    const map: MindMap = {
      id: sheet.id || crypto.randomUUID(),
      name: sheet.title || 'Imported Map',
      root: rootNode,
      floatingTopics: [],
      floatingCliparts: [],
      relationships: sheet.relationships?.map(r => ({
        id: r.id,
        sourceId: r.end1Id,
        targetId: r.end2Id,
        label: r.title,
        style: 'solid' as const,
        color: '#3b82f6',
        curvature: 0.3,
        startArrow: false,
        endArrow: true,
      })) || [],
      boundaries: [],
      summaries: [],
      theme: {
        id: 'default',
        name: 'Default',
        colors: {
          background: '#ffffff',
          rootNode: '#1e40af',
          branches: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
          text: '#1f2937',
          lines: '#94a3b8',
        },
        handDrawn: false,
        rainbowBranches: true,
      },
      structure: 'mindmap',
      zoom: 1,
      panX: 0,
      panY: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
    };

    return map;
  }

  // Try legacy format (content.xml for XMind 3-7)
  const xmlFile = zip.file('content.xml');
  if (xmlFile) {
    throw new Error('Legacy XMind format (XML) is not yet supported. Please use XMind 8+ format.');
  }

  throw new Error('Invalid XMind file: could not find content. Files found: ' + fileList.join(', '));
}

// ============================================
// File Download/Upload Helpers
// ============================================

export function downloadFile(content: Blob | string, filename: string, mimeType: string = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function openFilePicker(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] || null;
      resolve(file);
    };
    input.click();
  });
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ============================================
// PNG/SVG/PDF Export Functions
// ============================================

/**
 * Export the canvas to PNG format
 */
export function exportToPNG(canvas: HTMLCanvasElement, filename: string = 'mindmap.png'): void {
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export the canvas to SVG format
 * This creates an SVG by rendering the canvas content as an embedded image
 */
export function exportToSVG(canvas: HTMLCanvasElement, filename: string = 'mindmap.svg'): void {
  const width = canvas.width;
  const height = canvas.height;
  const dataUrl = canvas.toDataURL('image/png');

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image width="${width}" height="${height}" xlink:href="${dataUrl}"/>
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  downloadFile(blob, filename, 'image/svg+xml');
}

/**
 * Export the canvas to PDF format
 * This opens a print dialog with the canvas as a printable page
 */
export async function exportToPDF(canvas: HTMLCanvasElement, _filename: string = 'mindmap.pdf'): Promise<void> {
  // Get canvas as data URL
  const imgData = canvas.toDataURL('image/png', 1.0);

  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF');
    return;
  }

  // Get canvas dimensions
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  // Write HTML content for print
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>MindMap Export</title>
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          img { max-width: 100%; max-height: 100vh; }
        }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: white;
        }
        img {
          max-width: 100%;
          height: auto;
        }
      </style>
    </head>
    <body>
      <img src="${imgData}" width="${width}" height="${height}" />
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 100);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Export to Markdown format
 */
export function exportToMarkdown(map: MindMap): string {
  let markdown = `# ${map.name}\n\n`;

  function nodeToMarkdown(node: MindMapNode, level: number = 0): string {
    const prefix = level === 0 ? '' : '  '.repeat(level - 1) + '- ';
    let md = level === 0 ? `## ${node.text}\n\n` : `${prefix}${node.text}\n`;

    if (node.notes) {
      const indent = '  '.repeat(level);
      md += `${indent}> ${node.notes.replace(/\n/g, `\n${indent}> `)}\n`;
    }

    node.children.forEach(child => {
      md += nodeToMarkdown(child, level + 1);
    });

    return md;
  }

  markdown += nodeToMarkdown(map.root);

  return markdown;
}
