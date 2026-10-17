import { withAlpha } from "@/lib/colors";
import { makeRandom } from "@/lib/random";
import type { GraphNode } from "@/lib/types";

/**
 * Motor de físicas del grafo de afinidades: integración semi-implícita con
 * muelle orbital, deriva angular, repulsión entre nodos y amortiguación.
 * Todo se dibuja en un único canvas 2D acelerado por GPU (offscreen blit).
 */

export interface Body {
  node: GraphNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularSpeed: number;
  orbit: number;
  radius: number;
  center: boolean;
  /** Nodo sujeto por el puntero del usuario: la simulación lo respeta. */
  pinned: boolean;
}

export interface GraphGeometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  baseOrbit: number;
  centerRadius: number;
}

export function geometryFor(width: number, height: number): GraphGeometry {
  const min = Math.min(width, height);
  return {
    width,
    height,
    cx: width / 2,
    cy: height / 2,
    baseOrbit: Math.max(96, min * 0.33),
    centerRadius: Math.max(30, Math.min(54, min * 0.1)),
  };
}

export function createBodies(nodes: GraphNode[], geometry: GraphGeometry): Body[] {
  const random = makeRandom(nodes.length * 7919 + 13);
  const bodies: Body[] = [];
  const total = Math.max(1, nodes.length);

  nodes.forEach((node, index) => {
    const isCenter = index === 0;
    if (isCenter) {
      bodies.push({
        node,
        x: geometry.cx,
        y: geometry.cy,
        vx: 0,
        vy: 0,
        angle: 0,
        angularSpeed: 0,
        orbit: 0,
        radius: geometry.centerRadius,
        center: true,
        pinned: false,
      });
      return;
    }
    const slot = index - 1;
    const angle = (slot / Math.max(1, total - 1)) * Math.PI * 2 + random() * 0.42;
    const orbit = geometry.baseOrbit * (0.74 + node.affinity * 0.62) * (0.9 + random() * 0.26);
    bodies.push({
      node,
      x: geometry.cx + Math.cos(angle) * orbit,
      y: geometry.cy + Math.sin(angle) * orbit * 0.78,
      vx: 0,
      vy: 0,
      angle,
      angularSpeed: (random() - 0.5) * 0.00032 + (node.affinity > 0.7 ? 0.00012 : -0.00008),
      orbit,
      radius: Math.max(14, Math.min(32, 13 + node.affinity * 20)),
      center: false,
      pinned: false,
    });
  });

  return bodies;
}

export interface StepOptions {
  geometry: GraphGeometry;
  bodies: Body[];
  hovered: number | null;
  time: number;
  dt: number;
  physics: boolean;
}

export function stepBodies({ geometry, bodies, hovered, time, dt, physics }: StepOptions): void {
  const scale = Math.min(2.2, Math.max(0.35, dt / 16.67));

  for (const body of bodies) {
    if (body.center) {
      body.x = geometry.cx;
      body.y = geometry.cy + (physics ? Math.sin(time / 1700) * 2.4 : 0);
      continue;
    }

    if (physics && !body.pinned) body.angle += body.angularSpeed * scale * 3.2;

    const targetX = geometry.cx + Math.cos(body.angle) * body.orbit;
    const targetY = geometry.cy + Math.sin(body.angle) * body.orbit * 0.78;
    const k = hovered === body.node.id ? 0.05 : 0.022;
    body.vx += (targetX - body.x) * k * scale;
    body.vy += (targetY - body.y) * k * scale;

    body.vx += (geometry.cx - body.x) * 0.0009 * scale;
    body.vy += (geometry.cy - body.y) * 0.0009 * scale;

    if (physics) {
      const wobbleX = Math.sin(time / 1700 + body.node.id) * 0.018;
      const wobbleY = Math.cos(time / 2100 + body.node.id * 1.7) * 0.018;
      body.vx += wobbleX * scale;
      body.vy += wobbleY * scale;
    }
  }

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSq = dx * dx + dy * dy;
      const minDistance = a.radius + b.radius + 20;
      if (distanceSq > minDistance * minDistance || distanceSq === 0) continue;
      const distance = Math.sqrt(distanceSq);
      const force = ((minDistance - distance) / distance) * 0.3 * scale;
      const fx = dx * force;
      const fy = dy * force;
      if (!a.center && !a.pinned) {
        a.vx -= fx;
        a.vy -= fy;
      }
      if (!b.center && !b.pinned) {
        b.vx += fx;
        b.vy += fy;
      }
    }
  }

  const damping = physics ? 0.86 : 0.4;
  for (const body of bodies) {
    if (body.center) continue;
    if (body.pinned) {
      body.vx = 0;
      body.vy = 0;
      continue;
    }
    body.vx *= damping;
    body.vy *= damping;
    const speed = Math.hypot(body.vx, body.vy);
    const maxSpeed = 2.4;
    if (speed > maxSpeed) {
      body.vx = (body.vx / speed) * maxSpeed;
      body.vy = (body.vy / speed) * maxSpeed;
    }
    body.x += body.vx * scale;
    body.y += body.vy * scale;

    const margin = body.radius + 8;
    if (body.x < margin) {
      body.x = margin;
      body.vx = Math.abs(body.vx) * 0.5;
    }
    if (body.x > geometry.width - margin) {
      body.x = geometry.width - margin;
      body.vx = -Math.abs(body.vx) * 0.5;
    }
    if (body.y < margin) {
      body.y = margin;
      body.vy = Math.abs(body.vy) * 0.5;
    }
    if (body.y > geometry.height - margin) {
      body.y = geometry.height - margin;
      body.vy = -Math.abs(body.vy) * 0.5;
    }
  }
}

function circlePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function drawNodeImage(ctx: CanvasRenderingContext2D, body: Body, dim: number): void {
  const image = body.node.image;
  ctx.save();
  circlePath(ctx, body.x, body.y, body.radius);
  ctx.clip();
  if (image && image.complete && image.naturalWidth > 0) {
    const ratio = image.naturalWidth / image.naturalHeight;
    const targetW = body.radius * 2 * Math.max(1, ratio < 1 ? 1 / ratio : 1);
    const targetH = body.radius * 2 * Math.max(1, ratio > 1 ? ratio : 1);
    ctx.globalAlpha = dim;
    ctx.drawImage(image, body.x - targetW / 2, body.y - targetH / 2, targetW, targetH);
  } else {
    ctx.globalAlpha = dim;
    ctx.fillStyle = body.node.accent;
    ctx.fillRect(body.x - body.radius, body.y - body.radius, body.radius * 2, body.radius * 2);
    ctx.globalAlpha = dim * 0.75;
    ctx.fillStyle = "#000000";
    ctx.font = `600 ${Math.round(body.radius * 0.72)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(body.node.title.slice(0, 1).toUpperCase(), body.x, body.y + 1);
  }
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, body: Body, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const title = body.node.title.length > 26 ? `${body.node.title.slice(0, 25)}…` : body.node.title;
  ctx.font = `500 11px "Inter Variable", "Inter", system-ui, sans-serif`;
  ctx.fillStyle = "#e8e4dc";
  ctx.fillText(title, body.x, body.y + body.radius + 9);
  ctx.font = `500 9px "IBM Plex Mono", monospace`;
  ctx.fillStyle = "#7c7c86";
  const meta = `${body.node.year ?? "s.a."} · ${(body.node.affinity * 100).toFixed(0)}%`;
  ctx.fillText(meta, body.x, body.y + body.radius + 24);
  ctx.restore();
}

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  bodies: Body[];
  geometry: GraphGeometry;
  hovered: number | null;
  accent: string;
  time: number;
  dpr: number;
}

export function renderGraph({ ctx, bodies, geometry, hovered, accent, time, dpr }: RenderOptions): void {
  const { width, height, cx, cy } = geometry;
  ctx.save();
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.scale(dpr, dpr);

  const ambient = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.62);
  ambient.addColorStop(0, withAlpha(accent, 0.13));
  ambient.addColorStop(0.45, withAlpha(accent, 0.035));
  ambient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, width, height);

  const center = bodies.find((body) => body.center) ?? bodies[0];
  const hoveredBody = hovered === null ? null : bodies.find((body) => body.node.id === hovered) ?? null;

  // Órbitas guía
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (const ring of [0.72, 1, 1.3]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, geometry.baseOrbit * ring, geometry.baseOrbit * ring * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const dimOthers = Boolean(hoveredBody);

  // Enlaces
  for (const body of bodies) {
    if (body.center || !center) continue;
    const isHovered = hoveredBody === body;
    const alpha = dimOthers ? (isHovered ? 1 : 0.07) : 0.14 + body.node.affinity * 0.34;
    const midX = (center.x + body.x) / 2 + Math.sin(time / 1400 + body.node.id) * 14;
    const midY = (center.y + body.y) / 2 + Math.cos(time / 1600 + body.node.id) * 14;

    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.quadraticCurveTo(midX, midY, body.x, body.y);
    if (isHovered) {
      const ray = ctx.createLinearGradient(center.x, center.y, body.x, body.y);
      ray.addColorStop(0, withAlpha(accent, 0.95));
      ray.addColorStop(0.5, withAlpha(body.node.accent, 0.85));
      ray.addColorStop(1, withAlpha(body.node.accent, 0.25));
      ctx.strokeStyle = ray;
      ctx.lineWidth = 1.9;
      ctx.shadowColor = withAlpha(body.node.accent, 0.8);
      ctx.shadowBlur = 18;
    } else {
      ctx.strokeStyle = `rgba(220,216,206,${alpha.toFixed(3)})`;
      ctx.lineWidth = body.node.affinity > 0.66 ? 1.05 : 0.7;
      ctx.shadowBlur = 0;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Nodos
  for (const body of bodies) {
    const isHovered = hoveredBody === body;
    const dim = dimOthers && !isHovered && !body.center ? 0.2 : 1;

    if (body.center) {
      const pulse = 1 + Math.sin(time / 900) * 0.035;
      ctx.save();
      ctx.shadowColor = withAlpha(accent, 0.85);
      ctx.shadowBlur = 42;
      circlePath(ctx, body.x, body.y, body.radius * pulse + 6);
      ctx.strokeStyle = withAlpha(accent, 0.55);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = dim;
    circlePath(ctx, body.x, body.y, body.radius + (isHovered ? 4 : 1.5));
    ctx.fillStyle = "#050506";
    ctx.shadowColor = isHovered ? withAlpha(body.node.accent, 0.95) : "rgba(0,0,0,0.85)";
    ctx.shadowBlur = isHovered ? 34 : 16;
    ctx.fill();
    ctx.restore();

    drawNodeImage(ctx, body, dim);

    ctx.save();
    ctx.globalAlpha = dim;
    circlePath(ctx, body.x, body.y, body.radius);
    ctx.strokeStyle = isHovered || body.center ? withAlpha(body.node.accent, 0.95) : withAlpha(body.node.accent, 0.42);
    ctx.lineWidth = isHovered || body.center ? 1.6 : 1;
    ctx.stroke();
    ctx.restore();

    if (isHovered || body.center) drawLabel(ctx, body, dim);
  }

  ctx.restore();
}

export function hitTest(bodies: Body[], x: number, y: number): Body | null {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const body = bodies[i];
    const dx = x - body.x;
    const dy = y - body.y;
    if (dx * dx + dy * dy <= (body.radius + 8) ** 2) return body;
  }
  return null;
}

export function loadNodeImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
