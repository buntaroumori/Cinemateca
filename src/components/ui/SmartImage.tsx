import { memo, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { imageSources } from "@/lib/images";
import type { ImageKind, ImageQuality } from "@/lib/types";

export interface SmartImageProps {
  path: string | null | undefined;
  kind: ImageKind;
  quality: ImageQuality;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  wrapperClassName?: string;
  eager?: boolean;
  onLoaded?: () => void;
  /** Se emite cuando la imagen ya está decodificada (para transiciones de héroe). */
  aspectRatio?: string;
  placeholderGradient?: string;
}

/**
 * Imagen perezosa con negociación AVIF → WebP → JPEG, `aspect-ratio` fijo
 * (CLS = 0), decodificación asíncrona y fundido de aparición.
 */
export const SmartImage = memo(function SmartImage({
  path,
  kind,
  quality,
  alt,
  width,
  height,
  sizes,
  className,
  wrapperClassName,
  eager = false,
  onLoaded,
  aspectRatio = "2 / 3",
  placeholderGradient,
}: SmartImageProps) {
  const [state, setState] = useState<"idle" | "loaded" | "error">("idle");
  const sourceKey = `${path ?? ""}|${kind}|${quality}`;
  const loadedFor = useRef<string>("");

  useEffect(() => {
    if (loadedFor.current !== sourceKey) {
      setState("idle");
    }
  }, [sourceKey]);

  const sources = imageSources({ path, kind, quality });

  if (!sources.jpeg) {
    return (
      <div
        className={cx("relative overflow-hidden bg-[#0a0a0c]", wrapperClassName)}
        style={{ aspectRatio }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              placeholderGradient ??
              "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.92) 100%)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="type-eyebrow text-[9px] tracking-[0.32em] text-[#7e7e88]">Sin imagen</span>
        </div>
      </div>
    );
  }

  return (
    <picture className={cx("relative block overflow-hidden bg-[#0a0a0c]", wrapperClassName)} style={{ aspectRatio }}>
      {placeholderGradient || state === "idle" ? (
        <span
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden="true"
          style={{
            background:
              placeholderGradient ??
              "linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(0,0,0,0.9) 100%)",
          }}
        />
      ) : null}
      {sources.avif ? <source srcSet={sources.avif} type="image/avif" sizes={sizes} /> : null}
      {sources.webp ? <source srcSet={sources.webp} type="image/webp" sizes={sizes} /> : null}
      <img
        src={sources.jpeg}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={() => {
          loadedFor.current = sourceKey;
          setState("loaded");
          onLoaded?.();
        }}
        onError={() => setState("error")}
        className={cx(
          "relative z-[1] h-full w-full object-cover transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
          state === "loaded" ? "opacity-100" : "opacity-0",
          className,
        )}
      />
      {state === "error" ? (
        <span className="absolute inset-0 z-[2] grid place-items-center bg-[#0a0a0c]">
          <span className="type-eyebrow text-[9px] text-[#7e7e88]">No disponible</span>
        </span>
      ) : null}
    </picture>
  );
});
