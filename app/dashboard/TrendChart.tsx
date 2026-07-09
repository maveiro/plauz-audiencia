"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { TrendPoint, TrendSeries } from "@/lib/dashboard/queries";

interface TrendChartProps {
  data: TrendPoint[];
  series: TrendSeries[];
}

function formatDia(dia: string) {
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
}

export function TrendChart({ data, series }: TrendChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-500">Sem dados no período selecionado.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-gridline)" vertical={false} />
        <XAxis
          dataKey="dia"
          tickFormatter={formatDia}
          stroke="var(--chart-axis)"
          tick={{ fill: "var(--chart-ink-muted)", fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          stroke="var(--chart-axis)"
          tick={{ fill: "var(--chart-ink-muted)", fontSize: 12 }}
          width={32}
        />
        <Tooltip
          labelFormatter={(dia) => formatDia(String(dia))}
          contentStyle={{
            background: "var(--chart-surface)",
            border: "1px solid var(--chart-gridline)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        {series.length >= 2 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={`var(${s.colorVar})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
