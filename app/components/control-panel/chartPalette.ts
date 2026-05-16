/**
 * chartPalette — Chart.js registration + theme-aware palette helpers used by
 * tabs that render charts (Overview, etc.).
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

export const resolveCssVar = (name: string, fallback: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

export const hexToRgba = (value: string, alpha: number) => {
  const hex = value.replace("#", "").trim();
  if (hex.length !== 3 && hex.length !== 6) {
    return value;
  }

  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;

  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getControlPanelChartPalette = () => {
  const text = resolveCssVar("--color-text", "#fafafa");
  const textSecondary = resolveCssVar("--color-text-secondary", "#d4d4d4");
  const textMuted = resolveCssVar("--color-text-muted", "#737373");
  const border = resolveCssVar("--color-border-secondary", "rgba(255,255,255,0.08)");
  const primary = resolveCssVar("--color-primary", "#fafafa");
  const success = resolveCssVar("--color-success", "#7ecf9f");
  const warning = resolveCssVar("--color-warning", "#d6b36a");
  const info = resolveCssVar("--color-info", "#86aee8");
  const error = resolveCssVar("--color-error", "#d8837b");

  return {
    text,
    textSecondary,
    textMuted,
    border,
    primary,
    success,
    warning,
    info,
    error,
    neutralFill: hexToRgba(primary, 0.12),
    neutralStroke: hexToRgba(primary, 0.7),
    successFill: hexToRgba(success, 0.18),
    successStroke: success,
    warningFill: hexToRgba(warning, 0.2),
    warningStroke: warning,
    infoFill: hexToRgba(info, 0.18),
    infoStroke: info,
    errorFill: hexToRgba(error, 0.16),
    errorStroke: error,
  };
};

export const createChartOptions = (kind: "line" | "bar" | "pie") => {
  const palette = getControlPanelChartPalette();

  if (kind === "pie") {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: palette.textSecondary,
            usePointStyle: true,
            padding: 18,
            boxWidth: 10,
            boxHeight: 10,
            font: {
              size: 11,
            },
          },
        },
      },
    };
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(12, 12, 12, 0.94)",
        borderColor: palette.border,
        borderWidth: 1,
        titleColor: palette.text,
        bodyColor: palette.textSecondary,
        padding: 12,
        displayColors: false,
      },
    },
    scales: {
      x: {
        border: {
          display: false,
        },
        ticks: {
          color: palette.textMuted,
          maxRotation: 0,
          autoSkipPadding: 14,
          font: {
            size: 11,
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        border: {
          display: false,
        },
        ticks: {
          color: palette.textMuted,
          padding: 10,
          font: {
            size: 11,
          },
        },
        grid: {
          color: hexToRgba(resolveCssVar("--color-text", "#fafafa"), 0.08),
          drawTicks: false,
        },
      },
    },
  };
};
