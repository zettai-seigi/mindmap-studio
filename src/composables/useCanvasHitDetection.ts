/**
 * Canvas hit detection utilities
 * Handles finding elements at mouse positions (nodes, relationships, control points, labels)
 */

import type { Ref, ComputedRef } from 'vue';
import type { Position, RenderedNode, Relationship } from '../types';
import { findRenderedNodeById } from '../layouts';

export interface HitDetectionConfig {
  renderedRoot: Ref<RenderedNode | null>;
  allNodes: ComputedRef<RenderedNode[]>;
  relationships: ComputedRef<Relationship[]>;
  selectedRelationshipId: ComputedRef<string | null>;
  relationshipLabelPositions: Map<string, { x: number; y: number; baseX: number; baseY: number }>;
  controlPointRadius: number;
  getRelationshipControlPoints: (
    rel: Relationship,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) => { cp1: Position; cp2: Position; midX: number; midY: number };
}

export function useCanvasHitDetection(config: HitDetectionConfig) {
  const {
    renderedRoot,
    allNodes,
    relationships,
    selectedRelationshipId,
    relationshipLabelPositions,
    controlPointRadius,
    getRelationshipControlPoints
  } = config;

  /**
   * Find a node at the given position
   */
  function findNodeAtPosition(pos: Position): RenderedNode | null {
    // Check in reverse order (top-most first)
    const nodes = [...allNodes.value].reverse();

    for (const node of nodes) {
      if (
        pos.x >= node.x && pos.x <= node.x + node.width &&
        pos.y >= node.y && pos.y <= node.y + node.height
      ) {
        return node;
      }
    }

    return null;
  }

  /**
   * Check if a point is near a cubic Bezier curve
   */
  function isPointNearBezier(
    point: Position,
    p0: Position,
    p1: Position,
    p2: Position,
    p3: Position,
    threshold: number
  ): boolean {
    // Sample the curve and check distance to each segment
    const samples = 20;
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const x = Math.pow(1-t, 3) * p0.x + 3 * Math.pow(1-t, 2) * t * p1.x + 3 * (1-t) * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
      const y = Math.pow(1-t, 3) * p0.y + 3 * Math.pow(1-t, 2) * t * p1.y + 3 * (1-t) * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;

      const dist = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
      if (dist < threshold) return true;
    }
    return false;
  }

  /**
   * Find a relationship line at the given position
   */
  function findRelationshipAtPosition(pos: Position): string | null {
    for (const rel of relationships.value) {
      const sourceNode = renderedRoot.value
        ? findRenderedNodeById(renderedRoot.value, rel.sourceId)
        : null;
      const targetNode = renderedRoot.value
        ? findRenderedNodeById(renderedRoot.value, rel.targetId)
        : null;

      if (!sourceNode || !targetNode) continue;

      const startX = sourceNode.x + sourceNode.width / 2;
      const startY = sourceNode.y + sourceNode.height / 2;
      const endX = targetNode.x + targetNode.width / 2;
      const endY = targetNode.y + targetNode.height / 2;

      const { cp1, cp2 } = getRelationshipControlPoints(rel, startX, startY, endX, endY);

      // Check if point is near the Bezier curve
      if (isPointNearBezier(pos, { x: startX, y: startY }, cp1, cp2, { x: endX, y: endY }, 10)) {
        return rel.id;
      }
    }
    return null;
  }

  /**
   * Find a control point handle at the given position
   */
  function findControlPointAtPosition(pos: Position): { relId: string; point: 1 | 2 } | null {
    // Only check the selected relationship
    if (!selectedRelationshipId.value) return null;

    const rel = relationships.value.find(r => r.id === selectedRelationshipId.value);
    if (!rel) return null;

    const sourceNode = renderedRoot.value
      ? findRenderedNodeById(renderedRoot.value, rel.sourceId)
      : null;
    const targetNode = renderedRoot.value
      ? findRenderedNodeById(renderedRoot.value, rel.targetId)
      : null;

    if (!sourceNode || !targetNode) return null;

    const startX = sourceNode.x + sourceNode.width / 2;
    const startY = sourceNode.y + sourceNode.height / 2;
    const endX = targetNode.x + targetNode.width / 2;
    const endY = targetNode.y + targetNode.height / 2;

    const { cp1, cp2 } = getRelationshipControlPoints(rel, startX, startY, endX, endY);

    // Check control point 1
    const dist1 = Math.sqrt(Math.pow(pos.x - cp1.x, 2) + Math.pow(pos.y - cp1.y, 2));
    if (dist1 <= controlPointRadius + 4) {
      return { relId: rel.id, point: 1 };
    }

    // Check control point 2
    const dist2 = Math.sqrt(Math.pow(pos.x - cp2.x, 2) + Math.pow(pos.y - cp2.y, 2));
    if (dist2 <= controlPointRadius + 4) {
      return { relId: rel.id, point: 2 };
    }

    return null;
  }

  /**
   * Find a relationship label at the given position
   */
  function findRelationshipLabelAtPosition(pos: Position): string | null {
    for (const [relId, labelPos] of relationshipLabelPositions) {
      const rel = relationships.value.find(r => r.id === relId);
      if (!rel) continue;

      // Get label dimensions
      const labelText = rel.label || (selectedRelationshipId.value === relId ? 'Double-click to add label' : '');
      if (!labelText) continue;

      const padding = 6;
      const estimatedWidth = labelText.length * 7 + padding * 2; // Rough estimate
      const labelHeight = 20;

      // Check if click is within label bounds
      if (
        pos.x >= labelPos.x - estimatedWidth / 2 &&
        pos.x <= labelPos.x + estimatedWidth / 2 &&
        pos.y >= labelPos.y - labelHeight / 2 - 2 &&
        pos.y <= labelPos.y + labelHeight / 2 - 2
      ) {
        return relId;
      }
    }
    return null;
  }

  return {
    findNodeAtPosition,
    findRelationshipAtPosition,
    findControlPointAtPosition,
    findRelationshipLabelAtPosition,
    isPointNearBezier
  };
}
