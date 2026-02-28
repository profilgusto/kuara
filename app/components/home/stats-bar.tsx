"use client";

import { useEffect, useRef, useState } from "react";

interface Stat {
    value: number;
    suffix: string;
    label: string;
    prefix?: string;
}

const stats: Stat[] = [
    { value: 75, suffix: "+", label: "Sensores Ativos" },
    { value: 862, suffix: " kg", label: "CO₂ Sequestrado", prefix: "+" },
    { value: 98, suffix: "%", label: "Uptime da Rede" },
    { value: 24, suffix: "h", label: "Monitoramento Contínuo" },
];

function CountUp({ target, suffix, prefix = "" }: { target: number; suffix: string; prefix?: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const started = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !started.current) {
                    started.current = true;
                    let start = 0;
                    const duration = 1200;
                    const step = 16;
                    const increment = (target / duration) * step;

                    const timer = setInterval(() => {
                        start += increment;
                        if (start >= target) {
                            setCount(target);
                            clearInterval(timer);
                        } else {
                            setCount(Math.floor(start));
                        }
                    }, step);
                }
            },
            { threshold: 0.5 }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target]);

    return (
        <span ref={ref} className="metric text-3xl md:text-4xl">
            {prefix}
            {count}
            {suffix}
        </span>
    );
}

export function StatsBar() {
    return (
        <section id="sobre" className="py-16 border-y border-bg-border bg-bg-surface1/40 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x md:divide-bg-border">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="flex flex-col items-start md:items-center md:px-8 gap-2"
                        >
                            <CountUp
                                target={stat.value}
                                suffix={stat.suffix}
                                prefix={stat.prefix}
                            />
                            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                                {stat.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
