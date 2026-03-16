import Link from "next/link";
import { Leaf } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-border/30 mt-16">
            <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground/60">
                <Link href="/disciplinas" className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors">
                    <Leaf size={12} className="text-primary/70" />
                    <span className="font-serif font-semibold">Kuara</span>
                    <span className="ml-1">· © {new Date().getFullYear()} UFSJ</span>
                </Link>
                <div className="flex items-center gap-4">
                    <a
                        href="https://www.ufsj.edu.br/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-muted-foreground transition-colors"
                    >
                        UFSJ
                    </a>
                    <a
                        href="https://www.ufsj.edu.br/cemec/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-muted-foreground transition-colors"
                    >
                        Eng. Mecatrônica
                    </a>
                </div>
            </div>
        </footer>
    );
}
