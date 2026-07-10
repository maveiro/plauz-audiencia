"use client";

import type { MouseEvent } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, LabelList } from "recharts";

export interface HorizontalBarDatum {
  id: string;
  label: string;
  total: number;
}

interface HorizontalBarChartProps {
  data: HorizontalBarDatum[];
  emptyMessage: string;
  /** Quando presente, cada barra vira clicável e chama onBarClick(id) — clicar na barra já ativa (activeId) deve limpar o filtro (fica a cargo de quem chama). */
  onBarClick?: (id: string) => void;
  activeId?: string | null;
}

const ROW_HEIGHT = 32;

export function HorizontalBarChart({ data, emptyMessage, onBarClick, activeId }: HorizontalBarChartProps) {
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
        <Bar
          dataKey="total"
          fill="var(--series-1)"
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
          onClick={
            onBarClick
              ? (d: { payload?: HorizontalBarDatum }, _index: number, _e: MouseEvent) => {
                  if (d.payload) onBarClick(d.payload.id);
                }
              : undefined
          }
          cursor={onBarClick ? "pointer" : undefined}
        >
          {onBarClick
            ? data.map((d) => (
                <Cell
                  key={d.id}
                  fill={activeId && d.id !== activeId ? "var(--series-outros)" : "var(--series-1)"}
                />
              ))
            : null}
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
