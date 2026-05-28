'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Node, Edge } from '@xyflow/react';
import { getHeatmapColor } from '../utils/heatmap';
import { Bloom, EffectComposer, Vignette, Noise } from '@react-three/postprocessing';

interface SpatialBrowser3DProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (evt: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick?: (evt: React.MouseEvent, node: Node) => void;
}

// Subcomponent to animate camera movement smoothly to the active node
function CameraController({ targetPosition }: { targetPosition: THREE.Vector3 | null }) {
  const { camera } = useThree();
  const currentTarget = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (targetPosition) {
      // Lerp look-at target
      currentTarget.current.lerp(targetPosition, 0.05);
      camera.lookAt(currentTarget.current);

      // Smoothly fly camera to a comfortable viewing distance (offset) from the target
      const offsetTarget = new THREE.Vector3(
        targetPosition.x,
        targetPosition.y,
        targetPosition.z + 40
      );
      camera.position.lerp(offsetTarget, 0.05);
    }
  });

  return null;
}

// Instanced Mesh Component for nodes rendering
function NodesRenderer({
  nodes,
  onHover,
  onClickNode,
  onDoubleClickNode,
}: {
  nodes: Node[];
  onHover: (node: Node | null, clientX: number, clientY: number) => void;
  onClickNode: (node: Node) => void;
  onDoubleClickNode: (node: Node) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compute depth for a node dynamically from path or default data
  const getNodeDepth = (node: Node) => {
    const path = (node.data as any)?.path || '';
    if (!path) return 0;
    return path.split('/').length;
  };

  useEffect(() => {
    if (!meshRef.current) return;

    nodes.forEach((node, i) => {
      // Convert 2D flow coordinates to 3D. Scale down for viewing comfort.
      const x = node.position.x * 0.06;
      const y = -node.position.y * 0.06;
      const depth = getNodeDepth(node);
      const z = -depth * 6;

      dummy.position.set(x, y, z);

      // Base geometry scaling (logarithmic sizing for files)
      let scaleFactor = 1.0;
      const type = node.type || (node.data as any)?.nodeType;
      
      if (type === 'file' || type === 'dependency') {
        const size = (node.data as any)?.size || 1024;
        scaleFactor = 0.5 + Math.log(size / 1024 + 1) * 0.45;
      } else if (type === 'folder' || type === 'dir') {
        scaleFactor = 1.25;
      } else if (type === 'root') {
        scaleFactor = 1.8;
      }

      // Check heatmap scaling override
      if ((node.data as any)?.isHeatmapMode && (node.data as any)?.heatmapScale) {
        scaleFactor *= (node.data as any).heatmapScale;
      }

      // Highlighted scale pop
      if ((node.data as any)?.isHighlighted) {
        scaleFactor *= 1.25;
      }

      dummy.scale.set(scaleFactor, scaleFactor, scaleFactor);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Node Coloring Logic (Heatmap vs Normal & Dimmed State)
      let colorStr = '#3b82f6'; // file default
      if (type === 'folder' || type === 'dir') {
        colorStr = '#fbbf24'; // yellow/amber folder
      } else if (type === 'root') {
        colorStr = '#ec4899'; // pink root
      } else if (type === 'dependency') {
        colorStr = '#8b5cf6'; // violet dependency
      }

      // Heatmap override
      if ((node.data as any)?.isHeatmapMode) {
        if (type === 'file' || type === 'dependency') {
          colorStr = (node.data as any).heatmapColor || getHeatmapColor((node.data as any).sizeFactor ?? 0);
        } else {
          colorStr = '#475569'; // neutral gray folder in heatmap
        }
      }

      // Dimming for non-filtered nodes
      if ((node.data as any)?.isDimmed) {
        colorStr = '#1e293b'; // dark slate
      }

      const color = new THREE.Color(colorStr);
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [nodes, dummy]);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const node = nodes[e.instanceId];

    if (clickTimeoutRef.current) {
      // Double Click detected
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onDoubleClickNode(node);
    } else {
      // Single Click buffer
      clickTimeoutRef.current = setTimeout(() => {
        onClickNode(node);
        clickTimeoutRef.current = null;
      }, 250);
    }
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[null as any, null as any, nodes.length]}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          document.body.style.cursor = 'pointer';
          onHover(nodes[e.instanceId], e.clientX, e.clientY);
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
        onHover(null, 0, 0);
      }}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshPhysicalMaterial
        roughness={0.1}
        metalness={0.2}
        clearcoat={1}
        clearcoatRoughness={0.1}
        transmission={0.5} // Glassmorphism effect
        transparent
      />
    </instancedMesh>
  );
}

function EdgesRenderer({ edges, nodes }: { edges: Edge[]; nodes: Node[] }) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const getNodeDepth = (node: Node) => {
    const path = (node.data as any)?.path || '';
    if (!path) return 0;
    return path.split('/').length;
  };

  const curves = useMemo(() => {
    return edges
      .filter((edge) => !edge.hidden)
      .map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);

        if (source && target && !source.hidden && !target.hidden) {
          const sPos = new THREE.Vector3(
            source.position.x * 0.06, -source.position.y * 0.06, -getNodeDepth(source) * 6
          );
          const tPos = new THREE.Vector3(
            target.position.x * 0.06, -target.position.y * 0.06, -getNodeDepth(target) * 6
          );

          // Create a control point that adds a subtle curve toward the center
          const midPoint = new THREE.Vector3().addVectors(sPos, tPos).multiplyScalar(0.5);
          midPoint.z -= 5; // Pull the curve slightly in the Z-axis for depth

          const curve = new THREE.CubicBezierCurve3(sPos, sPos, midPoint, tPos);
          return curve.getPoints(20); // 20 segments for smoothness
        }
        return null;
      })
      .filter(Boolean) as THREE.Vector3[][];
  }, [edges, nodeMap]);

  return (
    <>
      {curves.map((points, i) => (
        <line key={i}>
          <bufferGeometry attach="geometry" setFromPoints={points} />
          <lineBasicMaterial
            attach="material"
            color="#a78bfa"
            transparent
            opacity={0.15}
            depthWrite={false}
          />
        </line>
      ))}
    </>
  );
}

export default function SpatialBrowser3D({
  nodes,
  edges,
  onNodeClick,
  onNodeDoubleClick,
}: SpatialBrowser3DProps) {
  // Filtering out hidden nodes to avoid rendering them in the 3D scene
  const activeNodes = useMemo(() => nodes.filter(n => !n.hidden), [nodes]);

  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const targetCoords = useMemo(() => {
    if (!selectedNode) return null;
    const path = (selectedNode.data as any)?.path || '';
    const depth = path ? path.split('/').length : 0;
    return new THREE.Vector3(
      selectedNode.position.x * 0.06,
      -selectedNode.position.y * 0.06,
      -depth * 6
    );
  }, [selectedNode]);

  const handleHover = (node: Node | null, clientX: number, clientY: number) => {
    setHoveredNode(node);
    if (node) {
      setTooltipPos({ x: clientX, y: clientY });
    }
  };

  const handleNodeSelect = (node: Node) => {
    setSelectedNode(node);
    if (onNodeClick) {
      onNodeClick(null as any, node);
    }
  };

  const handleNodeOpen = (node: Node) => {
    setSelectedNode(node);
    if (onNodeDoubleClick) {
      onNodeDoubleClick(null as any, node);
    }
  };

  return (
    <div className="w-full h-full relative bg-[#040409]">
      <Canvas camera={{ position: [0, 0, 75], fov: 60 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[100, 100, 100]} intensity={1.2} />
        <directionalLight position={[-50, 50, 50]} intensity={0.8} />
        <Stars radius={120} depth={50} count={3500} factor={4} saturation={0} fade speed={1.2} />

        <NodesRenderer
          nodes={activeNodes}
          onHover={handleHover}
          onClickNode={handleNodeSelect}
          onDoubleClickNode={handleNodeOpen}
        />

        <EdgesRenderer edges={edges} nodes={activeNodes} />

        <CameraController targetPosition={targetCoords} />
        
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxDistance={200} minDistance={10} />
      </Canvas>

      {/* Floating Modern Glassmorphic Tooltip */}
      {hoveredNode && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x + 15,
            top: tooltipPos.y + 15,
          }}
          className="z-50 pointer-events-none px-3 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/10 text-white shadow-2xl flex flex-col gap-0.5 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <span className="font-semibold text-white/90">
            {(hoveredNode.data as any)?.label || 'Node'}
          </span>
          {(hoveredNode.data as any)?.path && (
            <span className="text-[10px] text-white/40 font-mono truncate max-w-[200px]">
              {(hoveredNode.data as any).path}
            </span>
          )}
          {(hoveredNode.data as any)?.size !== undefined && (
            <span className="text-[10px] text-violet-300 font-medium">
              Size: {Math.round((hoveredNode.data as any).size / 1024 * 100) / 100} KB
            </span>
          )}
        </div>
      )}
    </div>
  );
}
