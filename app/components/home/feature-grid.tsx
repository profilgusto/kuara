"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Microscope, Zap, Trees, Satellite } from "lucide-react";

const features = [
    {
        icon: Microscope,
        badge: "Pesquisa",
        title: "Ciência Ambiental Aplicada",
        description:
            "Estudamos a dinâmica de ecossistemas florestais com metodologias de ponta, combinando sensoriamento remoto e análise laboratorial.",
        metric: "12 projetos ativos",
    },
    {
        icon: Zap,
        badge: "Energia",
        title: "Sistemas de Energia Sustentável",
        description:
            "Desenvolvemos soluções de energia renovável adaptadas a ambientes remotos e off-grid, com foco em confiabilidade e resiliência.",
        metric: "3.2 MWh gerados",
    },
    {
        icon: Trees,
        badge: "Biodiversidade",
        title: "IA para Biodiversidade",
        description:
            "Modelos de aprendizado de máquina que identificam e monitoram espécies automaticamente a partir de dados acústicos e visuais.",
        metric: ">91% precisão",
    },
    {
        icon: Satellite,
        badge: "Tecnologia",
        title: "Rede de Sensores IoT",
        description:
            "Infraestrutura autônoma de sensores distribuídos que transmitem dados em tempo real sobre solo, ar, água e microclima.",
        metric: "75 nós activos",
    },
];

function FeatureCard({
    feature,
    delay,
}: {
    feature: (typeof features)[0];
    delay: number;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                }
            },
            { threshold: 0.15 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    const Icon = feature.icon;

    return (
        <div
            ref={ref}
            className="reveal opacity-0 h-full"
            style={{ animationDelay: `${delay}ms` }}
        >
            <Card className="h-full bg-bg-surface1 border-bg-border hover:border-primary-DEFAULT/50 transition-all duration-320 group">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="p-2.5 rounded-md bg-primary-glow border border-primary-DEFAULT/20 text-primary-DEFAULT group-hover:shadow-[0_0_14px_0_rgba(63,175,92,0.2)] transition-all duration-320">
                            <Icon size={18} />
                        </div>
                        <Badge
                            variant="outline"
                            className="text-xs font-mono text-secondary-DEFAULT border-secondary-DEFAULT/30 bg-secondary-DEFAULT/5"
                        >
                            {feature.badge}
                        </Badge>
                    </div>
                    <CardTitle className="text-base font-sans font-semibold text-foreground leading-snug">
                        {feature.title}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground leading-[1.7] mb-4">
                        {feature.description}
                    </p>
                    <span className="metric text-sm">{feature.metric}</span>
                </CardContent>
            </Card>
        </div>
    );
}

export function FeatureGrid() {
    return (
        <section id="pesquisa" className="py-24 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Section header */}
                <div className="mb-14">
                    <span className="text-xs font-mono uppercase tracking-widest text-primary-DEFAULT">
                        Áreas de atuação
                    </span>
                    <h2 className="mt-3 text-display-md font-sans font-semibold text-foreground max-w-lg leading-tight">
                        Pesquisa que alimenta o futuro do planeta
                    </h2>
                    <p className="mt-4 text-muted-foreground max-w-[55ch] leading-[1.7]">
                        Nossa atuação interdisciplinar une ciência de dados, engenharia de
                        campo e ecologia aplicada para gerar impacto mensurável.
                    </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {features.map((feature, i) => (
                        <FeatureCard key={feature.title} feature={feature} delay={i * 80} />
                    ))}
                </div>
            </div>
        </section>
    );
}
