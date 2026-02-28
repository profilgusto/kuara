import Link from "next/link";
import { Leaf, Github, Linkedin, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const footerLinks = {
    pesquisa: [
        { label: "Projetos Ativos", href: "#projetos" },
        { label: "Publicações", href: "#publicacoes" },
        { label: "Dados Abertos", href: "#dados" },
    ],
    institucional: [
        { label: "Sobre", href: "#sobre" },
        { label: "Equipe", href: "#equipe" },
        { label: "Parceiros", href: "#parceiros" },
    ],
};

export function Footer() {
    return (
        <footer className="border-t border-bg-border bg-bg-surface1/60 backdrop-blur-sm mt-24">
            <div className="max-w-7xl mx-auto px-6 py-14">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                    {/* Brand */}
                    <div className="md:col-span-2">
                        <Link href="/" className="flex items-center gap-2 mb-4 w-fit">
                            <Leaf size={18} className="text-primary-DEFAULT" />
                            <span className="font-serif font-semibold text-lg text-foreground">
                                Bio<span className="text-primary-DEFAULT">floresta</span>
                            </span>
                        </Link>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                            Centro de pesquisa aplicada em ecossistemas, sensoriamento
                            ambiental e tecnologia sustentável de alta precisão.
                        </p>
                        {/* Social */}
                        <div className="flex gap-4 mt-6">
                            {[
                                { icon: Github, href: "#", label: "GitHub" },
                                { icon: Linkedin, href: "#", label: "LinkedIn" },
                                { icon: Mail, href: "mailto:contato@biofloresta.org", label: "Email" },
                            ].map(({ icon: Icon, href, label }) => (
                                <a
                                    key={label}
                                    href={href}
                                    aria-label={label}
                                    className="text-muted-foreground hover:text-primary-DEFAULT transition-colors duration-240"
                                >
                                    <Icon size={18} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Links */}
                    {Object.entries(footerLinks).map(([section, links]) => (
                        <div key={section}>
                            <h3 className="text-xs font-mono uppercase tracking-widest text-accent-light mb-4">
                                {section === "pesquisa" ? "Pesquisa" : "Institucional"}
                            </h3>
                            <ul className="space-y-3">
                                {links.map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-240"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <Separator className="my-8 bg-bg-border" />

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-muted-foreground">
                    <span>© {new Date().getFullYear()} Biofloresta. Todos os direitos reservados.</span>
                    <span className="font-mono text-organic">
                        v0.1.0 · ambiente:{" "}
                        <span className="text-primary-DEFAULT">prod</span>
                    </span>
                </div>
            </div>
        </footer>
    );
}
