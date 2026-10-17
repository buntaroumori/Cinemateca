import { memo, useEffect, useRef } from "react";
import { buildUrl } from "@/app/router";
import { useSettings } from "@/app/settings";
import { Link } from "@/components/Link";
import { IconAperture, IconArrowLeft } from "@/components/ui/Icons";

/**
 * 404 inmersivo: estática de televisor analógico generada por frame en un
 * canvas diminuto (200×120) y escalada con `image-rendering: pixelated`, más
 * una barra de sincronismo vertical que deriva. Coste por frame: ~0,4 ms.
 */
const STATIC_WIDTH = 200;
const STATIC_HEIGHT = 120;

function StaticCanvas({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = STATIC_WIDTH;
    canvas.height = STATIC_HEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    if (!enabled) {
      const image = ctx.createImageData(STATIC_WIDTH, STATIC_HEIGHT);
      for (let i = 0; i < image.data.length; i += 4) {
        const value = 18 + Math.random() * 14;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value + 2;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      return;
    }

    let frame = 0;
    let offset = 0;
    const image = ctx.createImageData(STATIC_WIDTH, STATIC_HEIGHT);
    const data = image.data;

    const draw = () => {
      offset = (offset + 1.35) % STATIC_HEIGHT;
      for (let y = 0; y < STATIC_HEIGHT; y++) {
        const bandDistance = Math.abs(y - offset);
        const band = bandDistance < 7 ? 1 - bandDistance / 7 : 0;
        for (let x = 0; x < STATIC_WIDTH; x++) {
          const index = (y * STATIC_WIDTH + x) * 4;
          const noise = Math.random();
          const value = 8 + noise * 74 + band * 120;
          data[index] = value;
          data[index + 1] = value;
          data[index + 2] = value + (noise > 0.985 ? 26 : 2);
          data[index + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [enabled]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full opacity-[0.5] mix-blend-screen"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export const NotFound = memo(function NotFound() {
  const { reducedMotion } = useSettings();
  const animated = !reducedMotion;

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-black px-5 py-24">
      <div className="absolute inset-0" aria-hidden="true">
        <StaticCanvas enabled={animated} />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 40%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.9) 58%, #000000 100%)",
          }}
        />
        <div
          className="scanline absolute inset-x-0 top-0 h-24 opacity-[0.07]"
          style={{ animationPlayState: animated ? "running" : "paused" }}
        />
      </div>

      <div className="fade-rise relative z-10 flex max-w-[720px] flex-col items-center text-center">
        <span className="text-[#7e7e88]">
          <IconAperture size={30} />
        </span>
        <p className="type-mono mt-8 text-[clamp(58px,14vw,132px)] font-medium leading-none tracking-[0.06em] text-[#6f6f77] [text-shadow:0_0_60px_rgba(255,255,255,0.16)]">
          404
        </p>
        <p className="type-eyebrow mt-4 text-[9px]">Fuera de programa · rollo no encontrado</p>
        <h1 className="type-display mt-6 text-[clamp(28px,5.2vw,54px)] text-[#f2efe8] text-balance">
          Esta sala está a oscuras
        </h1>
        <p className="type-body mt-6 max-w-[54ch]">
          La bobina que buscas no figura en el índice mundial. Puede que la URL se haya escrito mal, que la película se
          haya fusionado con otra ficha de TMDB o que simplemente nadie la haya catalogado todavía.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-2.5 rounded-[2px] bg-[color:var(--accent)] px-6 py-3.5 font-mono text-[10px] uppercase tracking-[0.24em] text-black transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:gap-4"
          >
            <IconArrowLeft size={13} />
            Volver a la cartelera
          </Link>
          <a
            href={buildUrl("/")}
            onClick={(event) => {
              event.preventDefault();
              window.history.back();
            }}
            className="hairline rounded-[2px] px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9d9da7] transition-all duration-400 hover:border-white/25 hover:text-[#f4f1ea]"
          >
            Retroceder un paso
          </a>
        </div>

        <p className="type-mono mt-12 text-[8.5px] uppercase leading-[2] tracking-[0.2em] text-[#7e7e88]">
          Señal perdida · {new Date().getFullYear()} · sin interferencias en el resto del catálogo
        </p>
      </div>
    </div>
  );
});
