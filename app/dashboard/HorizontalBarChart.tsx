"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from "recharts";

export interface HorizontalBarDatum {
  label: string;
  total: number;
}

interface HorizontalBarChartProps {
  data: HorizontalBarDatum[];
  emptyMessage: string;
}

const ROW_HEIGHT = 32;

export function HorizontalBarChart({ data, emptyMessage }: HorizontalBarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * ROW_HEIGHT, ROW_HEIGHT)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
        barCategoryGap={8}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={160}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--chart-ink-secondary)", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "var(--chart-gridline)" }}
          contentStyle={{
            background: "var(--chart-surface)",
            border: "1px solid var(--chart-gridline)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="total" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={18}>
          <LabelList
            dataKey="total"
            position="right"
            fill="var(--chart-ink-secondary)"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
