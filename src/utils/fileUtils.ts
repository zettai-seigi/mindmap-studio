import type { MindMap, MindMapNode } from '../types';
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
      return {
        id: m.markerId,
        category: (parts[0] as any) || 'custom',
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

  // Debug: list all files in the zip
  const fileList = Object.keys(zip.files);
  console.log('XMind file contents:', fileList);

  // Try to read content.json (XMind 8+ format)
  let contentFile = zip.file('content.json');

  if (contentFile) {
    const contentText = await contentFile.async('text');
    console.log('content.json raw:', contentText.substring(0, 500));

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
      console.error('Parsed content:', JSON.stringify(contentRaw, null, 2).substring(0, 1000));
      throw new Error('Invalid XMind file: missing root topic. Check console for details.');
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
