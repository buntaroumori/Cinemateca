import { useEffect, useRef } from "react";

/**
 * Grano de película: un único canvas fijo con un búfer de ruido de 128×128 px
 * escalado por CSS. Se dibuja una vez y la animación solo mueve el elemento
 * (composición en GPU), así que el coste por frame es nulo y no se emite
 * ninguna imagen rasterizada (nada de PNG/WebP en el bundle).
 */
const BUFFER = 128;

function paintNoise(ctx: CanvasRenderingContext2D): void {
  const image = ctx.createImageData(BUFFER, BUFFER);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = 108 + Math.floor(Math.random() * 147);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

export function GrainOverlay({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    canvas.width = BUFFER;
    canvas.height = BUFFER;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    paintNoise(ctx);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="grain-canvas"
      width={BUFFER}
      height={BUFFER}
    />
  );
}
