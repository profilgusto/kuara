"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, MapPin, Send } from "lucide-react";

export function ContactSection() {
    const ref = useRef<HTMLElement>(null);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.querySelectorAll(".reveal").forEach((el) =>
                            el.classList.add("visible")
                        );
                    }
                });
            },
            { threshold: 0.1 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        // Placeholder – wire to API route or email service
        setSent(true);
    }

    return (
        <section id="contato" ref={ref} className="py-24 px-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                {/* Left */}
                <div>
                    <span className="reveal opacity-0 text-xs font-mono uppercase tracking-widest text-primary-DEFAULT">
                        Contato
                    </span>
                    <h2 className="reveal opacity-0 mt-3 text-display-md font-sans font-semibold text-foreground leading-tight" style={{ animationDelay: "60ms" }}>
                        Vamos colaborar
                    </h2>
                    <p className="reveal opacity-0 mt-4 text-muted-foreground max-w-[48ch] leading-[1.7]" style={{ animationDelay: "120ms" }}>
                        Seja para parcerias de pesquisa, aplicações de tecnologia ou simplesmente
                        troca de conhecimento — nossa equipe está aberta ao diálogo.
                    </p>

                    <div className="reveal opacity-0 mt-10 space-y-5" style={{ animationDelay: "180ms" }}>
                        {[
                            { icon: Mail, label: "contato@biofloresta.org" },
                            { icon: MapPin, label: "Florianópolis, SC – Brasil" },
                        ].map(({ icon: Icon, label }) => (
                            <div key={label} className="flex items-center gap-3 text-sm text-muted-foreground">
                                <Icon size={15} className="text-primary-DEFAULT flex-shrink-0" />
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form */}
                <div className="reveal opacity-0" style={{ animationDelay: "100ms" }}>
                    {sent ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-center gap-4">
                            <span className="text-3xl">🌿</span>
                            <p className="font-sans font-semibold text-foreground">Mensagem enviada!</p>
                            <p className="text-sm text-muted-foreground">Retornaremos em breve.</p>
                        </div>
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className="space-y-5 bg-bg-surface1 border border-bg-border rounded-xl p-8"
                            aria-label="Formulário de contato"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {[
                                    { id: "nome", label: "Nome", type: "text", required: true },
                                    { id: "email", label: "E-mail", type: "email", required: true },
                                ].map((field) => (
                                    <div key={field.id} className="flex flex-col gap-1.5">
                                        <label htmlFor={field.id} className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                                            {field.label}
                                        </label>
                                        <input
                                            id={field.id}
                                            name={field.id}
                                            type={field.type}
                                            required={field.required}
                                            className="bg-bg-surface2 border border-bg-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-organic focus:outline-none focus:ring-1 focus:ring-primary-DEFAULT transition-all duration-240"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="mensagem" className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                                    Mensagem
                                </label>
                                <textarea
                                    id="mensagem"
                                    name="mensagem"
                                    rows={5}
                                    required
                                    className="bg-bg-surface2 border border-bg-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-organic focus:outline-none focus:ring-1 focus:ring-primary-DEFAULT transition-all duration-240 resize-none"
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full border border-primary-DEFAULT text-primary-DEFAULT bg-transparent hover:bg-primary-DEFAULT hover:text-bg-base transition-all duration-240 hover:shadow-[0_0_20px_0_rgba(63,175,92,0.3)] active:scale-[0.98] group"
                            >
                                Enviar mensagem
                                <Send size={14} className="ml-2 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 duration-240" />
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
