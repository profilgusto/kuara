"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

// Placeholder sensor data – replace with live API in production
const soilMoistureData = [
    { time: "00:00", valor: 68, temp: 24 },
    { time: "04:00", valor: 65, temp: 22 },
    { time: "08:00", valor: 71, temp: 25 },
    { time: "12:00", valor: 58, temp: 29 },
    { time: "16:00", valor: 62, temp: 28 },
    { time: "20:00", valor: 74, temp: 25 },
    { time: "23:59", valor: 70, temp: 23 },
];

const CustomTooltip = ({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string }>;
    label?: string;
}) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-bg-surface1 border border-bg-border rounded-md px-3 py-2 text-xs font-mono shadow-xl">
                <p className="text-organic mb-1">{label}</p>
                {payload.map((p) => (
                    <p key={p.dataKey} className="text-primary-DEFAULT">
                        {p.dataKey === "valor" ? "Umidade" : "Temp"}: {p.value}
                        {p.dataKey === "valor" ? "%" : "°C"}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export function DataChart() {
    return (
        <section id="projetos" className="py-24 px-6 bg-bg-surface1/30">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <span className="text-xs font-mono uppercase tracking-widest text-secondary-DEFAULT">
                            Dados em tempo real
                        </span>
                        <h2 className="mt-3 text-display-md font-sans font-semibold text-foreground leading-tight">
                            Monitoramento Ambiental
                        </h2>
                        <p className="mt-3 text-muted-foreground max-w-[50ch] leading-[1.7]">
                            Visualização contínua dos dados coletados pela rede de sensores no
                            campo experimental.
                        </p>
                    </div>
                    <Badge
                        variant="outline"
                        className="self-start sm:self-auto flex items-center gap-1.5 font-mono text-xs text-primary-DEFAULT border-primary-DEFAULT/40 bg-primary-DEFAULT/5 whitespace-nowrap"
                    >
                        <Activity size={10} className="animate-pulse" />
                        Ao vivo · Sensor #07
                    </Badge>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Soil moisture */}
                    <Card className="bg-bg-surface1 border-bg-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-mono font-medium text-muted-foreground uppercase tracking-widest">
                                Umidade do Solo (%)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={soilMoistureData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="moistureGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3FAF5C" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#3FAF5C" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1F3A30" />
                                    <XAxis
                                        dataKey="time"
                                        tick={{ fill: "#4F5A55", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fill: "#4F5A55", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={[40, 90]}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="valor"
                                        stroke="#3FAF5C"
                                        strokeWidth={2}
                                        fill="url(#moistureGradient)"
                                        dot={false}
                                        activeDot={{ r: 4, fill: "#3FAF5C", strokeWidth: 0 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Temperature */}
                    <Card className="bg-bg-surface1 border-bg-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-mono font-medium text-muted-foreground uppercase tracking-widest">
                                Temperatura (°C)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={soilMoistureData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1F3A30" />
                                    <XAxis
                                        dataKey="time"
                                        tick={{ fill: "#4F5A55", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fill: "#4F5A55", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={[18, 34]}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line
                                        type="monotone"
                                        dataKey="temp"
                                        stroke="#2FA8B8"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4, fill: "#2FA8B8", strokeWidth: 0 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    );
}
