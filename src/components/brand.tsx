import { Gem, Shirt, Cog, Armchair, Wheat, Cpu, Package, Laptop, type LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  handicrafts: Gem,
  textiles: Shirt,
  manufacturing: Cog,
  furniture: Armchair,
  food: Wheat,
  electronics: Cpu,
  printing: Package,
  services: Laptop,
};

/** Logo: a block-print rosette, the craftsman's mark, that doubles as a seal. */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#f2a516" />
      <path d="M16 5 L19 13 L27 16 L19 19 L16 27 L13 19 L5 16 L13 13 Z" fill="#0f1647" />
      <circle cx="16" cy="16" r="3.2" fill="#f2a516" />
      <circle cx="16" cy="16" r="1.4" fill="#c2412d" />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <a href="/" className="flex items-center gap-2.5 rounded-md">
      <Mark />
      <span className={`font-display text-xl font-bold ${dark ? "text-ink" : "text-white"}`}>Kaarigar Pay</span>
    </a>
  );
}
