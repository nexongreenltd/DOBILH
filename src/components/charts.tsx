"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AZURE = "#1260eb";

function money(v: number) {
  return v >= 100000 ? `৳${(v / 100000).toFixed(1)}L` : v >= 1000 ? `৳${(v / 1000).toFixed(0)}k` : `৳${v}`;
}

/** Single-series revenue trend: area + 2px line, crosshair tooltip, recessive grid. */
export function RevenueChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`Revenue by month: ${data.map((d) => `${d.label} ${d.value} taka`).join(", ")}`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AZURE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={AZURE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#eef1f6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#7c8a99", fontSize: 12 }} />
          <YAxis tickFormatter={money} tickLine={false} axisLine={false} width={52} tick={{ fill: "#7c8a99", fontSize: 12 }} />
          <Tooltip
            cursor={{ stroke: "#c5d9fb", strokeWidth: 1 }}
            contentStyle={{ borderRadius: 12, border: "1px solid #e8ebf1", boxShadow: "0 8px 24px -12px rgba(7,19,49,.2)", fontSize: 12 }}
            labelStyle={{ color: "#4d637b" }}
            formatter={(v: number) => [`৳${v.toLocaleString("en-IN")}`, "Revenue"]}
          />
          <Area type="monotone" dataKey="value" stroke={AZURE} strokeWidth={2} fill="url(#rev)" activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: AZURE }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
