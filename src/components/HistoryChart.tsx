import * as React from "react";

import type { HistoryRecord } from "@/lib/types";
import { downsampleHistory, formatShortDate, formatTime } from "@/lib/format";

interface HistoryChartProps {
  records: HistoryRecord[];
  range: "24h" | "7d" | "30d" | "all";
}

const WIDTH = 760;
const HEIGHT = 280;
const PADDING = { top: 22, right: 18, bottom: 34, left: 42 };

export function HistoryChart({ records, range }: HistoryChartProps) {
  const titleId = React.useId();
  const chart = React.useMemo(() => {
    const sample = downsampleHistory(records, 140);
    const first = sample[0];
    const last = sample[sample.length - 1];
    if (!first || !last) {
      return null;
    }
    const times = sample.map((record) => new Date(record.observedAt).getTime());
    const finiteTimes = times.filter(Number.isFinite);
    const minTime = finiteTimes.length ? Math.min(...finiteTimes) : 0;
    const maxTime = finiteTimes.length ? Math.max(...finiteTimes) : 1;
    const span = Math.max(1, maxTime - minTime);
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const x = (time: number, index: number) =>
      PADDING.left +
      (finiteTimes.length > 1
        ? ((time - minTime) / span) * plotWidth
        : (index / Math.max(1, sample.length - 1)) * plotWidth);
    const y = (percent: number) =>
      PADDING.top + (1 - Math.min(100, Math.max(0, percent)) / 100) * plotHeight;
    const points = sample.map((record, index) => ({
      record,
      x: x(times[index] ?? minTime, index),
      y: y(record.percent),
    }));
    const line = points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`,
      )
      .join(" ");
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const area =
      firstPoint && lastPoint
        ? `${line} L${lastPoint.x.toFixed(1)},${HEIGHT - PADDING.bottom} L${firstPoint.x.toFixed(1)},${HEIGHT - PADDING.bottom} Z`
        : "";
    const xLabels = [0, Math.floor((sample.length - 1) / 2), sample.length - 1]
      .filter((index, position, all) => all.indexOf(index) === position)
      .map((index) => points[index])
      .filter((point): point is NonNullable<typeof point> => Boolean(point));
    return {
      points,
      line,
      area,
      xLabels,
      minTime,
      maxTime,
      minPercent: Math.min(...sample.map((record) => record.percent)),
      maxPercent: Math.max(...sample.map((record) => record.percent)),
      count: records.length,
      latest: last,
    };
  }, [records]);

  if (!chart) {
    return null;
  }

  const timeLabel = (value: string) =>
    range === "24h" ? formatTime(value) : formatShortDate(value);

  return (
    <figure className="min-w-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          Battery charge over time. {chart.count} samples, from {chart.minPercent}% to{" "}
          {chart.maxPercent}%, latest {chart.latest.percent}%.
        </title>
        <defs>
          <linearGradient id="history-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--chart)" stopOpacity="0.015" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((value) => {
          const y =
            PADDING.top + (1 - value / 100) * (HEIGHT - PADDING.top - PADDING.bottom);
          return (
            <g key={value}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray={value === 0 ? undefined : "3 5"}
              />
              <text
                x={PADDING.left - 10}
                y={y + 4}
                textAnchor="end"
                fill="var(--muted-foreground)"
                fontSize="11"
              >
                {value}%
              </text>
            </g>
          );
        })}
        {chart.area ? <path d={chart.area} fill="url(#history-fill)" /> : null}
        <path
          d={chart.line}
          fill="none"
          stroke="var(--chart)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chart.points.length <= 60
          ? chart.points.map((point) => (
              <circle
                key={point.record.observedAt}
                cx={point.x}
                cy={point.y}
                r="3"
                fill="var(--card)"
                stroke="var(--chart)"
                strokeWidth="2"
              >
                <title>
                  {formatShortDate(point.record.observedAt)}{" "}
                  {formatTime(point.record.observedAt)}: {point.record.percent}%
                </title>
              </circle>
            ))
          : null}
        {chart.xLabels.map((point) => (
          <text
            key={`label-${point.record.observedAt}`}
            x={point.x}
            y={HEIGHT - 10}
            textAnchor={
              point === chart.xLabels[0]
                ? "start"
                : point === chart.xLabels[chart.xLabels.length - 1]
                  ? "end"
                  : "middle"
            }
            fill="var(--muted-foreground)"
            fontSize="11"
          >
            {timeLabel(point.record.observedAt)}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">
        {chart.count} local samples. Lowest {chart.minPercent}%, highest{" "}
        {chart.maxPercent}%, latest {chart.latest.percent}%.
      </figcaption>
    </figure>
  );
}
