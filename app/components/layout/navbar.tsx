"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Moon, Sun, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
    { label: "Sobre", href: "#sobre" },
    { label: "Pesquisa", href: "#pesquisa" },
    { label: "Projetos", href: "#projetos" },
    { label: "Contato", href: "#contato" },
];

export function Navbar() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        setMounted(true);
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-320 ${scrolled
                    ? "bg-bg-base/80 backdrop-blur-md border-b border-bg-border"
                    : "bg-transparent"
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link
                    href="/"
                    className="flex items-center gap-2 group"
                    aria-label="Kuara Biofloresta"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/icon.svg"
                        alt="Kuara logo"
                        width={24}
                        height={24}
                        className="transition-opacity duration-240 group-hover:opacity-80"
                    />
                    <span className="font-serif font-semibold text-lg tracking-tight text-foreground">
                        Bio<span className="text-primary-DEFAULT">floresta</span>
                    </span>
                </Link>

                {/* Desktop nav */}
                <nav className="hidden md:flex items-center gap-8" aria-label="Navegação principal">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="bio-link text-sm text-muted-foreground hover:text-foreground transition-colors duration-240"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* Right side actions */}
                <div className="flex items-center gap-3">
                    {/* Theme toggle */}
                    {mounted && (
                        <button
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors duration-240"
                            aria-label="Alternar tema"
                        >
                            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                    )}

                    {/* CTA */}
                    <Button
                        size="sm"
                        variant="outline"
                        className="hidden md:flex border-primary-DEFAULT text-primary-DEFAULT hover:bg-primary-DEFAULT hover:text-bg-base transition-all duration-240 hover:shadow-[0_0_14px_0_rgba(63,175,92,0.3)]"
                        asChild
                    >
                        <Link href="#contato">Entrar em contato</Link>
                    </Button>

                    {/* Mobile menu */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <button
                                className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors duration-240"
                                aria-label="Abrir menu"
                            >
                                <Menu size={20} />
                            </button>
                        </SheetTrigger>
                        <SheetContent
                            side="right"
                            className="bg-bg-surface1 border-bg-border w-[260px]"
                        >
                            <nav className="mt-10 flex flex-col gap-6" aria-label="Menu mobile">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="text-base text-muted-foreground hover:text-primary-DEFAULT transition-colors duration-240"
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                                <Button
                                    className="mt-4 border-primary-DEFAULT text-primary-DEFAULT hover:bg-primary-DEFAULT hover:text-bg-base"
                                    variant="outline"
                                    asChild
                                >
                                    <Link href="#contato">Entrar em contato</Link>
                                </Button>
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
