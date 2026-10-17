import type { CSSProperties } from "react";
import { cx } from "@/lib/format";

/**
 * Skeletons con la forma exacta del contenido final: pulso suave, sin
 * spinners genéricos. El brillo respeta la paleta oscura (≤ 8 % de blanco).
 */

function Block({ className, delay = 0, style }: { className?: string; delay?: number; style?: CSSProperties }) {
  return (
    <div
      className={cx("shimmer relative overflow-hidden rounded-[2px] bg-[#101013]", className)}
      style={{ animationDelay: `${delay}ms`, ...style }}
      aria-hidden="true"
    />
  );
}

export function PosterSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative w-full overflow-hidden rounded-[3px] bg-[#0c0c0e]" style={{ aspectRatio: "2 / 3" }}>
        <Block className="absolute inset-0" delay={delay} />
      </div>
      <Block className="h-[9px] w-4/5" delay={delay + 90} />
      <Block className="h-[8px] w-2/5" delay={delay + 160} />
    </div>
  );
}

export function GridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="poster-grid" role="presentation" aria-label="Cargando cartelera">
      {Array.from({ length: count }, (_, index) => (
        <PosterSkeleton key={index} delay={index * 55} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1560px] px-5 pb-24 pt-28 sm:px-8 lg:px-14" role="presentation">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-4">
          <Block className="h-[10px] w-32" />
          <div className="relative w-full overflow-hidden rounded-[3px] bg-[#0c0c0e]" style={{ aspectRatio: "2 / 3" }}>
            <Block className="absolute inset-0" />
          </div>
          <div className="flex gap-2">
            <Block className="h-9 flex-1 rounded-[2px]" delay={120} />
            <Block className="h-9 flex-1 rounded-[2px]" delay={200} />
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <Block className="h-[10px] w-40" />
          <Block className="h-[46px] w-4/5 max-w-[560px]" delay={80} />
          <Block className="h-[18px] w-2/5" delay={140} />
          <div className="flex flex-col gap-2.5 pt-3">
            <Block className="h-[11px] w-full max-w-[640px]" delay={200} />
            <Block className="h-[11px] w-[94%] max-w-[600px]" delay={250} />
            <Block className="h-[11px] w-[78%] max-w-[520px]" delay={300} />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-6 sm:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Block key={index} className="h-16 rounded-[2px]" delay={320 + index * 70} />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2 pt-8">
            {[0, 1, 2, 3, 4].map((index) => (
              <Block key={index} className="h-14 rounded-[2px]" delay={420 + index * 60} />
            ))}
          </div>
          <Block className="mt-8 h-[320px] w-full rounded-[3px]" delay={520} />
        </div>
      </div>
    </div>
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden" role="presentation">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="w-[128px] shrink-0">
          <div className="relative w-full overflow-hidden rounded-[3px] bg-[#0c0c0e]" style={{ aspectRatio: "2 / 3" }}>
            <Block className="absolute inset-0" delay={index * 70} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EssaySkeleton() {
  return (
    <div className="flex flex-col gap-3" role="presentation">
      <Block className="h-[13px] w-1/3" />
      <Block className="h-[10px] w-full" delay={90} />
      <Block className="h-[10px] w-[92%]" delay={150} />
      <Block className="h-[10px] w-[70%]" delay={210} />
    </div>
  );
}
