import type { MindMap, MindMapNode, Marker, Summary, StructureType } from '../types';
import JSZip from 'jszip';
import { getDefaultTheme } from '../themes';

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
  structureClass?: string;  // Node-level structure override (e.g., 'org.xmind.ui.tree.right')
  position?: {
    x: number;
    y: number;
  };
  children?: {
    attached?: XMindTopic[];
    detached?: XMindTopic[];  // Floating topics in XMind
    floating?: XMindTopic[];  // Alternative name for floating topics
    summary?: XMindTopic[];   // Summary topics (summarize a range of children)
  };
  // Summary metadata - defines which children are summarized
  summaries?: Array<{
    id: string;
    range: string;       // e.g., "(0,2)" means children 0 to 2
    topicId: string;     // ID of the summary topic in children.summary
  }>;
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
// isRoot: true means this is the root topic - detached children should NOT be added as regular children
//         (they will be collected separately as floating topics)
function xmindTopicToNode(topic: XMindTopic, isFloating: boolean = false, isRoot: boolean = false): MindMapNode {
  const node: MindMapNode = {
    id: topic.id || crypto.randomUUID(),
    text: topic.title || 'Untitled',
    children: [],
    markers: [],
    labels: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isFloating: isFloating,
  };

  // Set position for floating topics
  if (isFloating && topic.position) {
    node.position = {
      x: topic.position.x,
      y: topic.position.y,
    };
  }

  // Map XMind structureClass to our structure type and direction
  if (topic.structureClass) {
    const structureMap: Record<string, StructureType> = {
      'org.xmind.ui.tree.right': 'tree',
      'org.xmind.ui.tree.left': 'tree',
      'org.xmind.ui.logic.right': 'logic',
      'org.xmind.ui.logic.left': 'logic',
      'org.xmind.ui.org-chart.down': 'orgchart',
      'org.xmind.ui.org-chart.up': 'orgchart',
      'org.xmind.ui.map.clockwise': 'mindmap',
      'org.xmind.ui.map.anticlockwise': 'mindmap',
      'org.xmind.ui.map.unbalanced': 'mindmap',
    };
    const mappedStructure = structureMap[topic.structureClass];
    if (mappedStructure) {
      node.structure = mappedStructure;
    }

    // Extract direction from structureClass for structures that have it
    if (topic.structureClass.includes('.right')) {
      node.direction = 'right';
    } else if (topic.structureClass.includes('.left')) {
      node.direction = 'left';
    }
  }

  if (topic.children?.attached) {
    node.children = topic.children.attached.map(child => xmindTopicToNode(child, false, false));
  }

  // For non-root topics, include detached/floating as regular children
  // For root topic, detached topics are handled separately as floating topics
  if (!isRoot) {
    if (topic.children?.detached) {
      const detachedChildren = topic.children.detached.map(child => xmindTopicToNode(child, false, false));
      node.children = [...node.children, ...detachedChildren];
    }

    if (topic.children?.floating) {
      const floatingChildren = topic.children.floating.map(child => xmindTopicToNode(child, false, false));
      node.children = [...node.children, ...floatingChildren];
    }
  }

  // Always include summary topics as children (they summarize ranges of other children)
  if (topic.children?.summary) {
    const summaryChildren = topic.children.summary.map(child => xmindTopicToNode(child, false, false));
    node.children = [...node.children, ...summaryChildren];
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

// Collect all floating topics from XMind structure
function collectFloatingTopics(rootTopic: XMindTopic): MindMapNode[] {
  const floatingTopics: MindMapNode[] = [];

  // Collect detached topics from root level as floating topics
  if (rootTopic.children?.detached) {
    for (const detached of rootTopic.children.detached) {
      const floatingNode = xmindTopicToNode(detached, true);
      // XMind uses relative positions, we'll use absolute positioning
      if (detached.position) {
        floatingNode.position = {
          x: detached.position.x + 400, // Offset from center
          y: detached.position.y,
        };
      } else {
        // Default position for floating topics without position
        floatingNode.position = {
          x: 400 + floatingTopics.length * 150,
          y: -200 + floatingTopics.length * 80,
        };
      }
      floatingTopics.push(floatingNode);
    }
  }

  // Also handle 'floating' type
  if (rootTopic.children?.floating) {
    for (const floating of rootTopic.children.floating) {
      const floatingNode = xmindTopicToNode(floating, true);
      if (floating.position) {
        floatingNode.position = {
          x: floating.position.x + 400,
          y: floating.position.y,
        };
      } else {
        floatingNode.position = {
          x: 400 + floatingTopics.length * 150,
          y: -200 + floatingTopics.length * 80,
        };
      }
      floatingTopics.push(floatingNode);
    }
  }

  return floatingTopics;
}

// Build a lookup map of all node IDs to node text for relationships
function buildNodeIdMap(rootNode: MindMapNode, floatingTopics: MindMapNode[]): Map<string, string> {
  const idMap = new Map<string, string>();

  function traverse(node: MindMapNode) {
    idMap.set(node.id, node.text);
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(rootNode);
  for (const floating of floatingTopics) {
    traverse(floating);
  }

  return idMap;
}

// Collect all summaries from XMind topic tree
function collectSummaries(rootTopic: XMindTopic): Summary[] {
  const summaries: Summary[] = [];

  function traverse(topic: XMindTopic) {
    // Check if this topic has summaries
    if (topic.summaries && topic.summaries.length > 0 && topic.children?.summary) {
      for (const summaryMeta of topic.summaries) {
        // Parse range like "(0,2)" to get start and end indices
        const rangeMatch = summaryMeta.range.match(/\((\d+),(\d+)\)/);
        if (rangeMatch && rangeMatch[1] !== undefined && rangeMatch[2] !== undefined) {
          const rangeStart = parseInt(rangeMatch[1], 10);
          const rangeEnd = parseInt(rangeMatch[2], 10);

          // Find the summary topic
          const summaryTopic = topic.children.summary.find(s => s.id === summaryMeta.topicId);
          if (summaryTopic) {
            summaries.push({
              id: summaryMeta.id,
              parentNodeId: topic.id,
              rangeStart,
              rangeEnd,
              topicId: summaryMeta.topicId,
              topicText: summaryTopic.title || 'Summary',
            });
          }
        }
      }
    }

    // Recurse into children
    for (const child of topic.children?.attached || []) {
      traverse(child);
    }
    for (const child of topic.children?.detached || []) {
      traverse(child);
    }
    for (const child of topic.children?.floating || []) {
      traverse(child);
    }
  }

  traverse(rootTopic);
  return summaries;
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

    // Convert root topic (only attached children for main tree)
    // Pass isRoot=true so detached children are NOT added as regular children
    const rootNode = xmindTopicToNode(sheet.rootTopic, false, true);

    // Collect floating topics (detached at root level)
    const floatingTopics = collectFloatingTopics(sheet.rootTopic);

    // Build node ID map for relationship validation
    const nodeIdMap = buildNodeIdMap(rootNode, floatingTopics);

    // Find orphaned node IDs from relationships and create placeholder nodes
    const orphanedNodeIds = new Set<string>();
    for (const rel of (sheet.relationships || [])) {
      if (!nodeIdMap.has(rel.end1Id)) {
        orphanedNodeIds.add(rel.end1Id);
      }
      if (!nodeIdMap.has(rel.end2Id)) {
        orphanedNodeIds.add(rel.end2Id);
      }
    }

    // Create placeholder floating topics for orphaned nodes
    // Position them in a grid to the right of the main map
    let orphanIndex = 0;
    const orphanedNodes: MindMapNode[] = [];
    for (const orphanId of orphanedNodeIds) {
      const row = Math.floor(orphanIndex / 3);
      const col = orphanIndex % 3;
      const placeholderNode: MindMapNode = {
        id: orphanId,
        text: `Orphaned Node ${orphanIndex + 1}`,
        children: [],
        markers: [{
          id: 'symbol-question',
          category: 'symbol',
          value: 'question',
          color: '#f59e0b',
        }],
        labels: [{
          id: 'orphan-label',
          text: 'Orphaned',
          color: '#ef4444',
        }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isFloating: true,
        position: {
          x: 600 + col * 180,
          y: -300 + row * 100,
        },
      };
      orphanedNodes.push(placeholderNode);
      nodeIdMap.set(orphanId, placeholderNode.text);
      orphanIndex++;
    }

    // Combine all floating topics
    const allFloatingTopics = [...floatingTopics, ...orphanedNodes];

    // Now all relationships should be valid
    const allRelationships = (sheet.relationships || []).map(r => ({
      id: r.id,
      sourceId: r.end1Id,
      targetId: r.end2Id,
      label: r.title,
      style: 'solid' as const,
      color: '#3b82f6',
      curvature: 0.3,
      startArrow: false,
      endArrow: true,
    }));

    // Collect summaries from XMind structure
    const allSummaries = collectSummaries(sheet.rootTopic);

    const map: MindMap = {
      id: sheet.id || crypto.randomUUID(),
      name: sheet.title || sheet.rootTopic.title || 'Imported Map',
      root: rootNode,
      floatingTopics: allFloatingTopics,
      floatingCliparts: [],
      relationships: allRelationships,
      boundaries: [],
      summaries: allSummaries,
      theme: getDefaultTheme(),
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
