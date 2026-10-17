import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cx } from "@/lib/format";
import { affinityLabel } from "@/lib/essay-engine";
import { COLOR_FAMILY_MAP, LIMITS } from "@/lib/constants";
import { tmdbImageUrl } from "@/lib/images";
import { useTheme } from "@/app/theme";
import { useSettings } from "@/app/settings";
import { openFilmWithHero } from "@/app/hero";
import type { Soulmate } from "@/lib/essays";
import type { GraphNode, ImageQuality } from "@/lib/types";
import {
  createBodies,
  geometryFor,
  hitTest,
  loadNodeImage,
  renderGraph,
  stepBodies,
  type Body,
} from "./engine";
import { IconGraph } from "../ui/Icons";

export interface AffinityGraphProps {
  centerTitle: string;
  centerYear: number | null;
  centerPosterPath: string | null;
  centerId: number;
  soulmates: Soulmate[];
  quality: ImageQuality;
  onNotify?: (message: string) => void;
}

function reasonFor(soulmate: Soulmate): string {
  const parts: string[] = [];
  const keywords = soulmate.score.sharedKeywords.slice(0, 3).map((keyword) => keyword.name);
  if (keywords.length) parts.push(`comparte ${keywords.join(", ")}`);
  if (soulmate.score.sameDirector) parts.push("misma dirección");
  else if (soulmate.score.sameCinematographer) parts.push("misma fotografía");
  if (soulmate.score.sharedGenres.length) parts.push(`mismo territorio: ${soulmate.score.sharedGenres.slice(0, 2).join(" y ")}`);
  if (soulmate.score.temporalGap <= 4 && soulmate.fingerprint.year) parts.push(`coetánea (${soulmate.fingerprint.year})`);
  if (parts.length === 0) parts.push(soulmate.score.chromaticDistance > 0.5 ? "contraste cromático extremo" : "clima visual equivalente");
  return parts.join(" · ");
}

function toGraphNodes(
  centerId: number,
  centerTitle: string,
  centerYear: number | null,
  centerPosterPath: string | null,
  soulmates: Soulmate[],
  accent: string,
): GraphNode[] {
  const center: GraphNode = {
    id: centerId,
    title: centerTitle,
    year: centerYear,
    posterPath: centerPosterPath,
    rating: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 46,
    affinity: 1,
    reason: "Película en proyección",
    sharedKeywords: [],
    family: "neutro",
    accent,
    image: null,
    pinned: true,
  };
  const satellites: GraphNode[] = soulmates.slice(0, LIMITS.graphNodes - 1).map((soulmate) => ({
    id: soulmate.fingerprint.id,
    title: soulmate.fingerprint.title,
    year: soulmate.fingerprint.year,
    posterPath: soulmate.fingerprint.posterPath,
    rating: soulmate.fingerprint.rating,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 20,
    affinity: Math.max(0.12, Math.min(1, soulmate.score.total)),
    reason: reasonFor(soulmate),
    sharedKeywords: soulmate.score.sharedKeywords.map((keyword) => keyword.name),
    family: soulmate.fingerprint.family,
    accent: soulmate.fingerprint.palette?.accentHex ?? COLOR_FAMILY_MAP[soulmate.fingerprint.family].hex,
    image: null,
    pinned: false,
  }));
  return [center, ...satellites];
}

/** Lienzo interactivo con físicas reales: hover traza el rayo y justifica el vínculo. */
export const AffinityGraph = memo(function AffinityGraph({
  centerTitle,
  centerYear,
  centerPosterPath,
  centerId,
  soulmates,
  quality,
}: AffinityGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bodiesRef = useRef<Body[]>([]);
  const geometryRef = useRef(geometryFor(800, 520));
  const hoveredRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const { accent } = useTheme();
  const { settings, reducedMotion } = useSettings();
  const physicsEnabled = settings.graphPhysics && settings.heavyAnimations && !reducedMotion;

  const nodes = useMemo(
    () => toGraphNodes(centerId, centerTitle, centerYear, centerPosterPath, soulmates, accent),
    [centerId, centerTitle, centerYear, centerPosterPath, soulmates, accent],
  );

  /* --- precarga de pósters de los nodos --- */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const node of nodes) {
        if (cancelled) return;
        const url = tmdbImageUrl({ path: node.posterPath, kind: "posterSmall", quality, size: "w154" });
        const image = await loadNodeImage(url);
        if (cancelled) return;
        node.image = image;
        const body = bodiesRef.current.find((entry) => entry.node.id === node.id);
        if (body) body.node.image = image;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nodes, quality]);

  /* --- construcción de cuerpos --- */
  useEffect(() => {
    bodiesRef.current = createBodies(nodes, geometryRef.current);
  }, [nodes]);

  /* --- bucle de render --- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(340, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      geometryRef.current = geometryFor(width, height);
      if (bodiesRef.current.length === 0) bodiesRef.current = createBodies(nodes, geometryRef.current);
      for (const body of bodiesRef.current) {
        if (body.center) continue;
        body.orbit = Math.min(body.orbit, geometryRef.current.baseOrbit * 1.65);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const draw = (time: number) => {
      if (!running) return;
      const dt = lastTimeRef.current ? Math.min(48, time - lastTimeRef.current) : 16.7;
      lastTimeRef.current = time;
      stepBodies({
        geometry: geometryRef.current,
        bodies: bodiesRef.current,
        hovered: hoveredRef.current,
        time,
        dt,
        physics: physicsEnabled,
      });
      renderGraph({
        ctx,
        bodies: bodiesRef.current,
        geometry: geometryRef.current,
        hovered: hoveredRef.current,
        accent,
        time,
        dpr,
      });
      frameRef.current = window.requestAnimationFrame(draw);
    };

    if (physicsEnabled) {
      frameRef.current = window.requestAnimationFrame(draw);
    } else {
      // Sin físicas: asentamos los nodos y dibujamos una vez.
      for (let i = 0; i < 90; i++) {
        stepBodies({
          geometry: geometryRef.current,
          bodies: bodiesRef.current,
          hovered: hoveredRef.current,
          time: i * 16,
          dt: 16,
          physics: false,
        });
      }
      renderGraph({
        ctx,
        bodies: bodiesRef.current,
        geometry: geometryRef.current,
        hovered: hoveredRef.current,
        accent,
        time: 0,
        dpr,
      });
    }

    return () => {
      running = false;
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      observer.disconnect();
    };
  }, [accent, physicsEnabled, nodes]);

  /* --- redraw ligero cuando cambia el hover sin físicas --- */
  useEffect(() => {
    if (physicsEnabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderGraph({
      ctx,
      bodies: bodiesRef.current,
      geometry: geometryRef.current,
      hovered: hoveredRef.current,
      accent,
      time: 0,
      dpr,
    });
  }, [hoveredId, physicsEnabled, accent]);

  /* --- seguimiento de la tarjeta (8 Hz, fuera del rAF) --- */
  useEffect(() => {
    if (hoveredId === null) return;
    const update = () => {
      const body = bodiesRef.current.find((entry) => entry.node.id === hoveredId);
      if (!body) return;
      setCardPosition({ x: body.x, y: body.y });
    };
    update();
    if (!physicsEnabled) return;
    const timer = window.setInterval(update, 120);
    return () => window.clearInterval(timer);
  }, [hoveredId, physicsEnabled]);

  const handlePointer = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const body = hitTest(bodiesRef.current, x, y);
    const next = body && !body.center ? body.node.id : null;
    if (next !== hoveredRef.current) {
      hoveredRef.current = next;
      setHoveredId(next);
      if (next !== null && body) setCardPosition({ x: body.x, y: body.y });
      canvas.style.cursor = next !== null ? "pointer" : "default";
    }
  }, []);

  const handleLeave = useCallback(() => {
    hoveredRef.current = null;
    setHoveredId(null);
  }, []);

  const handleOpen = useCallback(
    (id: number) => {
      if (id === centerId) return;
      openFilmWithHero(id, null);
    },
    [centerId],
  );

  const hoveredNode = hoveredId === null ? null : nodes.find((node) => node.id === hoveredId) ?? null;

  return (
    <section className="border-t border-white/6 py-14" aria-labelledby="grafo-title">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="type-eyebrow flex items-center gap-2 text-[9px]">
            <IconGraph size={12} />
            Grafo de afinidades
          </p>
          <h2 id="grafo-title" className="type-display mt-3 text-[clamp(24px,3.2vw,38px)] text-[#f4f1ea]">
            Constelación sensorial
          </h2>
          <p className="mt-3 max-w-[62ch] font-serif text-[16px] italic leading-relaxed text-[#8b8b95]">
            Cada nodo flota con físicas propias. Pasa el cursor para trazar el rayo que lo une al centro y leer por qué
            respira igual que <span className="not-italic text-[#d9d5cc]">{centerTitle}</span>.
          </p>
        </div>
        <p className="type-mono hidden text-[9px] uppercase tracking-[0.18em] text-[#7e7e88] lg:block">
          {nodes.length - 1} vínculos · {physicsEnabled ? "simulación activa" : "nodos asentados"}
        </p>
      </header>

      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-[4px] border border-white/8 bg-[radial-gradient(120%_90%_at_50%_10%,#0a0a0c_0%,#000000_70%)]"
        style={{ height: "clamp(380px, 58vh, 640px)" }}
      >
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointer}
          onPointerLeave={handleLeave}
          onClick={() => hoveredRef.current !== null && handleOpen(hoveredRef.current)}
          className="block h-full w-full touch-none"
          role="img"
          aria-label={`Grafo de afinidades de ${centerTitle} con ${Math.max(0, nodes.length - 1)} películas vinculadas`}
        />

        {hoveredNode ? (
          <div
            className="glass pointer-events-none absolute z-20 w-[268px] -translate-x-1/2 rounded-[3px] p-4"
            style={{
              left: `${Math.min(Math.max(cardPosition.x, 150), (wrapRef.current?.clientWidth ?? 600) - 150)}px`,
              top: `${Math.max(8, cardPosition.y - hoveredNode.radius - 172)}px`,
              borderColor: `${hoveredNode.accent}55`,
              boxShadow: `0 30px 70px -40px ${hoveredNode.accent}, 0 0 0 1px rgba(255,255,255,0.04) inset`,
            }}
          >
            <p className="type-mono text-[8.5px] uppercase tracking-[0.22em]" style={{ color: hoveredNode.accent }}>
              {affinityLabel(hoveredNode.affinity)} · {(hoveredNode.affinity * 100).toFixed(0)}%
            </p>
            <p className="type-display mt-2 text-[19px] leading-tight text-[#f4f1ea]">{hoveredNode.title}</p>
            <p className="type-mono mt-1 text-[9px] uppercase tracking-[0.16em] text-[#8a8a94]">
              {hoveredNode.year ?? "s.a."}
              {hoveredNode.rating > 0 ? ` · ${hoveredNode.rating.toFixed(1).replace(".", ",")}` : ""}
            </p>
            <p className="mt-3 font-serif text-[14.5px] leading-relaxed text-[#b6b1a6]">{hoveredNode.reason}</p>
            {hoveredNode.sharedKeywords.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {hoveredNode.sharedKeywords.slice(0, 4).map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-white/10 px-2 py-[3px] font-mono text-[8px] uppercase tracking-[0.14em] text-[#8b8b95]"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.18em] text-[#7e7e88]">Clic para abrir la ficha</p>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 px-4 py-3">
          <span className="type-mono text-[8.5px] uppercase tracking-[0.2em] text-[#7e7e88]">
            motor de físicas · canvas 2D acelerado
          </span>
          <span className="type-mono text-[8.5px] uppercase tracking-[0.2em] text-[#7e7e88]">
            {physicsEnabled ? "60 fps" : "estático"}
          </span>
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {nodes.slice(1).map((node) => (
          <li key={node.id}>
            <button
              type="button"
              onMouseEnter={() => {
                hoveredRef.current = node.id;
                setHoveredId(node.id);
              }}
              onMouseLeave={handleLeave}
              onFocus={() => {
                hoveredRef.current = node.id;
                setHoveredId(node.id);
              }}
              onBlur={handleLeave}
              onClick={() => handleOpen(node.id)}
              className={cx(
                "hairline group flex w-full items-center gap-3 rounded-[3px] bg-white/[0.012] px-3 py-2.5 text-left transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "hover:-translate-y-[1px] hover:border-[color:var(--accent-line)] hover:bg-white/[0.05]",
              )}
            >
              <span
                className="h-6 w-6 shrink-0 rounded-full border border-white/10"
                style={{ backgroundColor: node.accent, boxShadow: `0 0 18px -6px ${node.accent}` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-[15px] leading-tight text-[#e3dfd6] group-hover:text-[#f7f4ed]">
                  {node.title}
                </span>
                <span className="type-mono mt-0.5 block text-[8.5px] uppercase tracking-[0.16em] text-[#7e7e88]">
                  {node.year ?? "s.a."} · afinidad {(node.affinity * 100).toFixed(0)}%
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {nodes.length === 1 ? (
        <p className="mt-6 max-w-[64ch] font-serif text-[16px] italic leading-relaxed text-[#8a8a94]">
          TMDB todavía no propone vecindad para este título: el grafo se queda con su nodo central. Conecta una clave
          TMDB válida o explora otra película para ampliar la constelación.
        </p>
      ) : null}
    </section>
  );
});
