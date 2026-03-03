import { Hero } from "@/components/home/hero";
import { StatsBar } from "@/components/home/stats-bar";
import { FeatureGrid } from "@/components/home/feature-grid";
import { DataChart } from "@/components/home/data-chart";
import { ContactSection } from "@/components/home/contact-section";

export default function Home() {
  return (
    <>
      <Hero />
      <StatsBar />
      <FeatureGrid />
      <DataChart />
      <ContactSection />
    </>
  );
}
