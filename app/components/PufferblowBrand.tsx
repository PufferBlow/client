import { type CSSProperties } from "react";

type BrandAlign = "left" | "center";

interface PufferblowMarkProps {
  size?: number;
  className?: string;
  animated?: boolean;
  surfaceColor?: string;
}

interface PufferblowBrandProps extends PufferblowMarkProps {
  titleClassName?: string;
  subtitleClassName?: string;
  textClassName?: string;
  subtitle?: string;
  align?: BrandAlign;
}

export function PufferblowMark({
  size = 64,
  className = "",
  animated = true,
  surfaceColor = "var(--color-background)",
}: PufferblowMarkProps) {
  const style = {
    width: `${size}px`,
    height: `${size}px`,
    "--pb-logo-cutout": surfaceColor,
  } as CSSProperties;

  return (
    <span
      className={`pb-logo ${animated ? "pb-logo-animated" : ""} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <g className="pb-logo-mark">
          <line className="pb-logo-spoke pb-logo-h-right" x1="50" y1="50" x2="82" y2="50" />
          <line className="pb-logo-spoke pb-logo-h-left" x1="50" y1="50" x2="18" y2="50" />
          <line className="pb-logo-spoke pb-logo-v-down" x1="50" y1="50" x2="50" y2="82" />
          <line className="pb-logo-spoke pb-logo-v-up" x1="50" y1="50" x2="50" y2="18" />
          <line className="pb-logo-spoke pb-logo-d1-br" x1="50" y1="50" x2="73" y2="73" />
          <line className="pb-logo-spoke pb-logo-d1-tl" x1="50" y1="50" x2="27" y2="27" />
          <line className="pb-logo-spoke pb-logo-d2-bl" x1="50" y1="50" x2="27" y2="73" />
          <line className="pb-logo-spoke pb-logo-d2-tr" x1="50" y1="50" x2="73" y2="27" />
          <circle className="pb-logo-knockout" cx="50" cy="50" r="21" />
          <circle className="pb-logo-ring" cx="50" cy="50" r="21" />
          <circle className="pb-logo-dot" cx="50" cy="50" r="3.2" />
        </g>
      </svg>
    </span>
  );
}

export function PufferblowBrand({
  size = 64,
  className = "",
  titleClassName = "",
  subtitleClassName = "",
  textClassName = "",
  subtitle,
  align = "left",
  animated = true,
  surfaceColor,
}: PufferblowBrandProps) {
  const alignment =
    align === "center"
      ? "items-center text-center"
      : "items-start text-left";

  return (
    <div className={`flex items-center gap-4 ${className}`.trim()}>
      <PufferblowMark
        size={size}
        animated={animated}
        surfaceColor={surfaceColor}
        className="shrink-0"
      />
      <div className={`flex flex-col ${alignment} ${textClassName}`.trim()}>
        <span
          className={`text-3xl font-black tracking-[-0.04em] text-[var(--color-text)] ${titleClassName}`.trim()}
        >
          Pufferblow
        </span>
        {subtitle ? (
          <span
            className={`text-sm font-medium uppercase tracking-[0.28em] text-[var(--color-text-secondary)] ${subtitleClassName}`.trim()}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}
