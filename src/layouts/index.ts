// ============================================
// Layout Algorithms for Mind Map Structures
// ============================================

import type { MindMapNode, RenderedNode, StructureType } from '../types';

export interface LayoutConfig {
  horizontalSpacing: number;
  verticalSpacing: number;
  levelSpacing: number;
  nodeWidth: number;
  nodeHeight: number;
  centerX: number;
  centerY: number;
}

const defaultConfig: LayoutConfig = {
  horizontalSpacing: 60,
  verticalSpacing: 30,
  levelSpacing: 100,
  nodeWidth: 120,
  nodeHeight: 40,
  centerX: 0,
  centerY: 0,
};

// ============================================
// Mind Map Layout (Radial)
// ============================================

export function layoutMindMap(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };

  // Use manual position for root if set
  const rootX = root.position?.x ?? cfg.centerX;
  const rootY = root.position?.y ?? cfg.centerY;

  const rootRendered: RenderedNode = {
    node: root,
    x: rootX,
    y: rootY,
    width: cfg.nodeWidth * 1.5,
    height: cfg.nodeHeight * 1.2,
    collapsed: root.collapsed || false,
    level: 0,
    children: [],
  };

  if (root.collapsed || root.children.length === 0) {
    return rootRendered;
  }

  // Split children into left and right
  const half = Math.ceil(root.children.length / 2);
  const rightChildren = root.children.slice(0, half);
  const leftChildren = root.children.slice(half);

  // Layout right side
  let rightY = cfg.centerY - (rightChildren.length - 1) * cfg.verticalSpacing / 2;
  rightChildren.forEach((child, index) => {
    const childRendered = layoutBranch(
      child,
      cfg.centerX + cfg.levelSpacing,
      rightY + index * getSubtreeHeight(child, cfg),
      'right',
      1,
      cfg,
      rootRendered
    );
    rootRendered.children.push(childRendered);
  });

  // Layout left side
  let leftY = cfg.centerY - (leftChildren.length - 1) * cfg.verticalSpacing / 2;
  leftChildren.forEach((child, index) => {
    const childRendered = layoutBranch(
      child,
      cfg.centerX - cfg.levelSpacing - cfg.nodeWidth,
      leftY + index * getSubtreeHeight(child, cfg),
      'left',
      1,
      cfg,
      rootRendered
    );
    rootRendered.children.push(childRendered);
  });

  return rootRendered;
}

function layoutBranch(
  node: MindMapNode,
  x: number,
  y: number,
  direction: 'left' | 'right',
  level: number,
  cfg: LayoutConfig,
  parent: RenderedNode
): RenderedNode {
  // Use manual position if set
  const finalX = node.position?.x ?? x;
  const finalY = node.position?.y ?? y;

  const rendered: RenderedNode = {
    node,
    x: finalX,
    y: finalY,
    width: cfg.nodeWidth,
    height: cfg.nodeHeight,
    collapsed: node.collapsed || false,
    level,
    parent,
    children: [],
  };

  if (node.collapsed || node.children.length === 0) {
    return rendered;
  }

  const totalHeight = node.children.reduce(
    (sum, child) => sum + getSubtreeHeight(child, cfg),
    0
  );
  let childY = y - totalHeight / 2 + cfg.verticalSpacing / 2;

  node.children.forEach((child) => {
    const childX = direction === 'right'
      ? x + cfg.levelSpacing
      : x - cfg.levelSpacing;

    const childRendered = layoutBranch(
      child,
      childX,
      childY,
      direction,
      level + 1,
      cfg,
      rendered
    );
    rendered.children.push(childRendered);
    childY += getSubtreeHeight(child, cfg);
  });

  return rendered;
}

function getSubtreeHeight(node: MindMapNode, cfg: LayoutConfig): number {
  if (node.collapsed || node.children.length === 0) {
    return cfg.nodeHeight + cfg.verticalSpacing;
  }
  return node.children.reduce(
    (sum, child) => sum + getSubtreeHeight(child, cfg),
    0
  );
}

// ============================================
// Org Chart Layout (Top-Down)
// ============================================

export function layoutOrgChart(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };

  // First pass: calculate subtree widths
  const widths = new Map<string, number>();
  calculateSubtreeWidths(root, widths, cfg);

  // Second pass: position nodes
  const rootRendered = positionOrgChartNode(
    root,
    cfg.centerX,
    cfg.centerY,
    0,
    widths,
    cfg,
    undefined
  );

  return rootRendered;
}

function calculateSubtreeWidths(
  node: MindMapNode,
  widths: Map<string, number>,
  cfg: LayoutConfig
): number {
  if (node.collapsed || node.children.length === 0) {
    const width = cfg.nodeWidth + cfg.horizontalSpacing;
    widths.set(node.id, width);
    return width;
  }

  const childrenWidth = node.children.reduce(
    (sum, child) => sum + calculateSubtreeWidths(child, widths, cfg),
    0
  );
  const width = Math.max(cfg.nodeWidth + cfg.horizontalSpacing, childrenWidth);
  widths.set(node.id, width);
  return width;
}

function positionOrgChartNode(
  node: MindMapNode,
  x: number,
  y: number,
  level: number,
  widths: Map<string, number>,
  cfg: LayoutConfig,
  parent?: RenderedNode
): RenderedNode {
  // Use manual position if set
  const finalX = node.position?.x ?? x;
  const finalY = node.position?.y ?? y;

  const rendered: RenderedNode = {
    node,
    x: finalX,
    y: finalY,
    width: cfg.nodeWidth,
    height: cfg.nodeHeight,
    collapsed: node.collapsed || false,
    level,
    parent,
    children: [],
  };

  if (node.collapsed || node.children.length === 0) {
    return rendered;
  }

  const totalWidth = node.children.reduce(
    (sum, child) => sum + (widths.get(child.id) || 0),
    0
  );
  let childX = x - totalWidth / 2;

  node.children.forEach((child) => {
    const childWidth = widths.get(child.id) || cfg.nodeWidth;
    const childRendered = positionOrgChartNode(
      child,
      childX + childWidth / 2,
      y + cfg.levelSpacing,
      level + 1,
      widths,
      cfg,
      rendered
    );
    rendered.children.push(childRendered);
    childX += childWidth;
  });

  return rendered;
}

// ============================================
// Tree Chart Layout (Spreading branches)
// ============================================

export function layoutTreeChart(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };
  return layoutOrgChart(root, cfg); // Similar to org chart
}

// ============================================
// Logic Chart Layout (Left to Right)
// ============================================

export function layoutLogicChart(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };

  const rootRendered: RenderedNode = {
    node: root,
    x: cfg.centerX - 200,
    y: cfg.centerY,
    width: cfg.nodeWidth * 1.2,
    height: cfg.nodeHeight,
    collapsed: root.collapsed || false,
    level: 0,
    children: [],
  };

  if (root.collapsed || root.children.length === 0) {
    return rootRendered;
  }

  layoutLogicBranch(root, rootRendered, 1, cfg);

  return rootRendered;
}

function layoutLogicBranch(
  node: MindMapNode,
  rendered: RenderedNode,
  level: number,
  cfg: LayoutConfig
) {
  if (node.collapsed || node.children.length === 0) return;

  const totalHeight = node.children.reduce(
    (sum, child) => sum + getSubtreeHeight(child, cfg),
    0
  );
  let childY = rendered.y - totalHeight / 2 + cfg.verticalSpacing / 2;

  node.children.forEach((child) => {
    const childRendered: RenderedNode = {
      node: child,
      x: rendered.x + cfg.levelSpacing,
      y: childY,
      width: cfg.nodeWidth,
      height: cfg.nodeHeight,
      collapsed: child.collapsed || false,
      level,
      parent: rendered,
      children: [],
    };
    rendered.children.push(childRendered);
    layoutLogicBranch(child, childRendered, level + 1, cfg);
    childY += getSubtreeHeight(child, cfg);
  });
}

// ============================================
// Fishbone Layout (Ishikawa Diagram)
// ============================================

export function layoutFishbone(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };

  const rootRendered: RenderedNode = {
    node: root,
    x: cfg.centerX + 200,
    y: cfg.centerY,
    width: cfg.nodeWidth * 1.5,
    height: cfg.nodeHeight * 1.2,
    collapsed: root.collapsed || false,
    level: 0,
    children: [],
  };

  if (root.collapsed || root.children.length === 0) {
    return rootRendered;
  }

  // Distribute children alternating above and below the spine
  const spacing = cfg.levelSpacing * 1.5;
  root.children.forEach((child, index) => {
    const isAbove = index % 2 === 0;
    const xPos = cfg.centerX - (root.children.length - index - 1) * spacing;
    const yOffset = isAbove ? -80 : 80;

    const childRendered: RenderedNode = {
      node: child,
      x: xPos,
      y: cfg.centerY + yOffset,
      width: cfg.nodeWidth,
      height: cfg.nodeHeight,
      collapsed: child.collapsed || false,
      level: 1,
      parent: rootRendered,
      children: [],
    };

    // Layout sub-branches
    layoutFishboneBranch(child, childRendered, 2, isAbove, cfg);
    rootRendered.children.push(childRendered);
  });

  return rootRendered;
}

function layoutFishboneBranch(
  node: MindMapNode,
  rendered: RenderedNode,
  level: number,
  isAbove: boolean,
  cfg: LayoutConfig
) {
  if (node.collapsed || node.children.length === 0) return;

  const direction = isAbove ? -1 : 1;
  node.children.forEach((child, index) => {
    const childRendered: RenderedNode = {
      node: child,
      x: rendered.x - (index + 1) * 40,
      y: rendered.y + direction * (index + 1) * 35,
      width: cfg.nodeWidth * 0.8,
      height: cfg.nodeHeight * 0.8,
      collapsed: child.collapsed || false,
      level,
      parent: rendered,
      children: [],
    };
    rendered.children.push(childRendered);
  });
}

// ============================================
// Timeline Layout
// ============================================

export function layoutTimeline(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {},
  horizontal: boolean = true
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };

  const rootRendered: RenderedNode = {
    node: root,
    x: horizontal ? cfg.centerX - 300 : cfg.centerX,
    y: horizontal ? cfg.centerY : cfg.centerY - 200,
    width: cfg.nodeWidth,
    height: cfg.nodeHeight,
    collapsed: root.collapsed || false,
    level: 0,
    children: [],
  };

  if (root.collapsed || root.children.length === 0) {
    return rootRendered;
  }

  root.children.forEach((child, index) => {
    const childRendered: RenderedNode = {
      node: child,
      x: horizontal
        ? rootRendered.x + (index + 1) * cfg.levelSpacing
        : cfg.centerX,
      y: horizontal
        ? cfg.centerY + (index % 2 === 0 ? -60 : 60)
        : rootRendered.y + (index + 1) * cfg.levelSpacing,
      width: cfg.nodeWidth,
      height: cfg.nodeHeight,
      collapsed: child.collapsed || false,
      level: 1,
      parent: rootRendered,
      children: [],
    };

    // Layout sub-items
    if (!child.collapsed && child.children.length > 0) {
      const subDirection = horizontal ? (index % 2 === 0 ? -1 : 1) : 1;
      child.children.forEach((subChild, subIndex) => {
        const subRendered: RenderedNode = {
          node: subChild,
          x: horizontal
            ? childRendered.x
            : childRendered.x + (subIndex + 1) * 60,
          y: horizontal
            ? childRendered.y + subDirection * (subIndex + 1) * 35
            : childRendered.y,
          width: cfg.nodeWidth * 0.8,
          height: cfg.nodeHeight * 0.8,
          collapsed: subChild.collapsed || false,
          level: 2,
          parent: childRendered,
          children: [],
        };
        childRendered.children.push(subRendered);
      });
    }

    rootRendered.children.push(childRendered);
  });

  return rootRendered;
}

// ============================================
// Main Layout Function
// ============================================

export function layoutNodes(
  root: MindMapNode,
  structure: StructureType,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  switch (structure) {
    case 'mindmap':
      return layoutMindMap(root, config);
    case 'orgchart':
      return layoutOrgChart(root, config);
    case 'tree':
      return layoutTreeChart(root, config);
    case 'logic':
      return layoutLogicChart(root, config);
    case 'fishbone':
      return layoutFishbone(root, config);
    case 'timeline':
      return layoutTimeline(root, config);
    default:
      return layoutMindMap(root, config);
  }
}

// ============================================
// Utility Functions
// ============================================

export function getAllRenderedNodes(root: RenderedNode): RenderedNode[] {
  const nodes: RenderedNode[] = [root];
  root.children.forEach(child => {
    nodes.push(...getAllRenderedNodes(child));
  });
  return nodes;
}

export function findRenderedNodeById(
  root: RenderedNode,
  id: string
): RenderedNode | null {
  if (root.node.id === id) return root;
  for (const child of root.children) {
    const found = findRenderedNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function getBoundingBox(
  nodes: RenderedNode[]
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  nodes.forEach(node => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  });

  return { minX, minY, maxX, maxY };
}
