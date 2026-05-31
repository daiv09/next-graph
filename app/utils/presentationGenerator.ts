import pptxgen from 'pptxgenjs';
import { API_BASE } from './constants';
import type { Node, Edge } from '@xyflow/react';

interface SlideData {
  screenshot: string; // base64 PNG data URL
  title: string;
  description: string;
  targetNodeId: string;
}

export const generatePresentation = async (
  projectName: string,
  nodes: Node[],
  edges: Edge[],
  tourSteps: any[],
  capturedSlides: Record<number, SlideData>,
  repoUrl: string
) => {
  // 1. Fetch Topology and Architecture details
  const topologyRes = await fetch(`${API_BASE}/api/infer-topology`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodes: nodes.map(n => ({ id: n.id, type: n.type, data: n.data })),
      edges: edges.map(e => ({ source: e.source, target: e.target })),
      repo_url: repoUrl,
    }),
  });
  if (!topologyRes.ok) throw new Error('Failed to infer topology from backend');
  const topology = await topologyRes.json();

  // 2. Fetch AI slide summaries for each step in parallel
  const notePromises = tourSteps.map(async (step, index) => {
    try {
      // Find the focused node type
      const targetNode = nodes.find(n => n.id === step.targetNodeId);
      const targetType = targetNode?.type || (targetNode?.data as any)?.nodeType || 'file';
      const targetLabel = (targetNode?.data as any)?.label || targetNode?.id || step.title;
      const targetPath = (targetNode?.data as any)?.path || '';

      const notesRes = await fetch(`${API_BASE}/api/infer-slide-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_title: step.title,
          step_narration: step.narration,
          target_node_label: targetLabel,
          target_node_path: targetPath,
          target_node_type: targetType,
          visible_nodes: [], // Can be populated if needed
          inferred_infrastructure: topology.inferred_infrastructure,
        }),
      });
      if (notesRes.ok) {
        const data = await notesRes.json();
        return data.slide_note;
      }
    } catch (e) {
      console.error('Failed to fetch slide notes', e);
    }
    return '';
  });
  const slideNotes = await Promise.all(notePromises);

  // 3. Construct presentation
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  // Set dark theme properties
  const bgStyle = { color: '121212' }; // Hex color for background
  const textColor = 'FFFFFF';
  const subtitleColor = 'A0A0AA';
  const accentColor = '0EA5E9'; // sky-500
  const accentBg = '1E1E28'; // Dark gray box
  
  // --- SLIDE 1: Title Slide ---
  let slide = pptx.addSlide();
  slide.background = bgStyle;
  
  // Title
  slide.addText(`${projectName} Architecture`, {
    x: 0.8,
    y: 1.8,
    w: 8.4,
    h: 1.0,
    fontSize: 36,
    bold: true,
    color: textColor,
    fontFace: 'Segoe UI',
  });
  
  // Subtitle
  slide.addText('Interactive Codebase Tour & Dependency Topology Audit', {
    x: 0.8,
    y: 2.8,
    w: 8.4,
    h: 0.5,
    fontSize: 16,
    color: accentColor,
    fontFace: 'Segoe UI',
  });

  // Metadata
  slide.addText(`Generated on ${new Date().toLocaleDateString()} | `, {
    x: 0.8,
    y: 4.8,
    w: 8.4,
    h: 0.4,
    fontSize: 11,
    color: '6B7280',
    fontFace: 'Segoe UI',
  });

  // --- SLIDE 2: Inferred Infrastructure & Tech Stack ---
  slide = pptx.addSlide();
  slide.background = bgStyle;
  
  // Header
  slide.addText('System Infrastructure Topology', {
    x: 0.5,
    y: 0.4,
    w: 9.0,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: textColor,
    fontFace: 'Segoe UI',
  });

  // Left Column: Tech Stack list
  slide.addText('INFERRED TECH STACK', {
    x: 0.5,
    y: 1.2,
    w: 4.2,
    h: 0.3,
    fontSize: 12,
    bold: true,
    color: accentColor,
    fontFace: 'Segoe UI',
  });

  let stackY = 1.6;
  topology.tech_stack.forEach((tech: string) => {
    slide.addText(`• ${tech}`, {
      x: 0.5,
      y: stackY,
      w: 4.2,
      h: 0.35,
      fontSize: 14,
      color: textColor,
      fontFace: 'Segoe UI',
    });
    stackY += 0.4;
  });

  // Right Column: Summary Box
  slide.addText('ARCHITECTURE OVERVIEW', {
    x: 5.2,
    y: 1.2,
    w: 4.3,
    h: 0.3,
    fontSize: 12,
    bold: true,
    color: accentColor,
    fontFace: 'Segoe UI',
  });

  slide.addText(topology.inferred_infrastructure, {
    x: 5.2,
    y: 1.6,
    w: 4.3,
    h: 3.2,
    fontSize: 13,
    color: 'D1D5DB',
    fontFace: 'Segoe UI',
    align: 'left',
  });

  // --- SLIDE 3: Dependency Coupling Hotspots ---
  slide = pptx.addSlide();
  slide.background = bgStyle;

  slide.addText('Dependency Map & Coupling Analysis', {
    x: 0.5,
    y: 0.4,
    w: 9.0,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: textColor,
    fontFace: 'Segoe UI',
  });

  slide.addText('High-degree hubs identified in the codebase network graph:', {
    x: 0.5,
    y: 1.0,
    w: 9.0,
    h: 0.3,
    fontSize: 13,
    color: subtitleColor,
    fontFace: 'Segoe UI',
  });

  // Grid/List of hotspots
  let hotspotY = 1.4;
  topology.hotspots.forEach((spot: any) => {
    // Backdrop panel
    slide.addText('', {
      x: 0.5,
      y: hotspotY,
      w: 9.0,
      h: 0.65,
      fill: { color: accentBg },
    });

    slide.addText(spot.label, {
      x: 0.7,
      y: hotspotY + 0.05,
      w: 3.0,
      h: 0.25,
      fontSize: 14,
      bold: true,
      color: textColor,
      fontFace: 'Segoe UI',
    });

    slide.addText(spot.path || '/', {
      x: 0.7,
      y: hotspotY + 0.3,
      w: 3.0,
      h: 0.25,
      fontSize: 11,
      color: '9CA3AF',
      fontFace: 'Segoe UI',
    });

    slide.addText(spot.role, {
      x: 4.0,
      y: hotspotY + 0.05,
      w: 3.0,
      h: 0.25,
      fontSize: 12,
      bold: true,
      color: accentColor,
      fontFace: 'Segoe UI',
    });

    slide.addText(`Connections: ${spot.connections}`, {
      x: 7.2,
      y: hotspotY + 0.05,
      w: 2.0,
      h: 0.25,
      fontSize: 12,
      color: 'E5E7EB',
      fontFace: 'Segoe UI',
      align: 'right',
    });

    hotspotY += 0.75;
  });

  // --- SLIDE 4: Maintainability Audit ---
  slide = pptx.addSlide();
  slide.background = bgStyle;

  slide.addText('Maintainability & Complexity Audit', {
    x: 0.5,
    y: 0.4,
    w: 9.0,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: textColor,
    fontFace: 'Segoe UI',
  });

  slide.addText('Components flagged with critical or high structural complexity metrics:', {
    x: 0.5,
    y: 1.0,
    w: 9.0,
    h: 0.3,
    fontSize: 13,
    color: subtitleColor,
    fontFace: 'Segoe UI',
  });

  let auditY = 1.4;
  if (topology.critical_files && topology.critical_files.length > 0) {
    topology.critical_files.forEach((file: any) => {
      slide.addText('', {
        x: 0.5,
        y: auditY,
        w: 9.0,
        h: 0.65,
        fill: { color: accentBg },
      });

      slide.addText(file.label, {
        x: 0.7,
        y: auditY + 0.05,
        w: 3.0,
        h: 0.25,
        fontSize: 14,
        bold: true,
        color: textColor,
        fontFace: 'Segoe UI',
      });

      slide.addText(file.path || '/', {
        x: 0.7,
        y: auditY + 0.3,
        w: 3.0,
        h: 0.25,
        fontSize: 11,
        color: '9CA3AF',
        fontFace: 'Segoe UI',
      });

      const ratingColor = file.rating === 'Critical' ? 'F43F5E' : 'FBBF24';
      slide.addText(`${file.rating} Complexity (Score: ${file.complexity})`, {
        x: 4.0,
        y: auditY + 0.05,
        w: 3.0,
        h: 0.25,
        fontSize: 12,
        bold: true,
        color: ratingColor,
        fontFace: 'Segoe UI',
      });

      slide.addText(`LOC: ${file.loc}`, {
        x: 7.2,
        y: auditY + 0.05,
        w: 2.0,
        h: 0.25,
        fontSize: 12,
        color: 'E5E7EB',
        fontFace: 'Segoe UI',
        align: 'right',
      });

      auditY += 0.75;
    });
  } else {
    slide.addText('No high complexity components detected. Codebase is highly maintainable.', {
      x: 0.5,
      y: 2.0,
      w: 9.0,
      h: 1.0,
      fontSize: 16,
      color: '34D399',
      fontFace: 'Segoe UI',
      align: 'center',
    });
  }

  // --- SLIDES 5+: Guided Tour Steps ---
  tourSteps.forEach((step, idx) => {
    slide = pptx.addSlide();
    slide.background = bgStyle;

    // Header
    slide.addText(`Tour Step ${idx + 1}: ${step.title}`, {
      x: 0.5,
      y: 0.4,
      w: 9.0,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: textColor,
      fontFace: 'Segoe UI',
    });

    // Capture/Screenshot Column
    const captured = capturedSlides[idx];
    if (captured && captured.screenshot) {
      slide.addImage({
        data: captured.screenshot,
        x: 0.5,
        y: 1.2,
        w: 5.5,
        h: 3.8,
      });
      // Subtle border for graph
      slide.addShape('rect', {
        x: 0.5,
        y: 1.2,
        w: 5.5,
        h: 3.8,
        line: { color: '334155', width: 1.5 },
      });
    } else {
      slide.addText('No graph screenshot captured.', {
        x: 0.5,
        y: 1.2,
        w: 5.5,
        h: 3.8,
        fill: { color: '1A1A24' },
        color: '6B7280',
        fontSize: 14,
        align: 'center',
        fontFace: 'Segoe UI',
      });
    }

    // Details Column
    // Narration
    slide.addText('NARRATIVE', {
      x: 6.2,
      y: 1.2,
      w: 3.3,
      h: 0.25,
      fontSize: 10,
      bold: true,
      color: accentColor,
      fontFace: 'Segoe UI',
    });

    slide.addText(step.narration, {
      x: 6.2,
      y: 1.5,
      w: 3.3,
      h: 1.3,
      fontSize: 12,
      color: 'D1D5DB',
      fontFace: 'Segoe UI',
    });

    // AI-Augmented Summary Box
    slide.addText('EXECUTIVE SUMMARY & INSIGHTS', {
      x: 6.2,
      y: 2.9,
      w: 3.3,
      h: 0.25,
      fontSize: 10,
      bold: true,
      color: '10B981', // emerald-500
      fontFace: 'Segoe UI',
    });

    const aiNote = slideNotes[idx] || 'Analyzed code module patterns inside project hierarchy.';
    slide.addText(aiNote, {
      x: 6.2,
      y: 3.2,
      w: 3.3,
      h: 1.8,
      fontSize: 12,
      color: 'E5E7EB',
      fontFace: 'Segoe UI',
      fill: { color: '10B981', transparency: 90 }, // 10% opacity light green background tint
      line: { color: '10B981', width: 1 },
      margin: 10,
    });
  });

  // 4. Save file
  await pptx.writeFile({ fileName: `${projectName.replace(/\s+/g, '_')}_Architecture_Presentation` });
};
