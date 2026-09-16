import { MetricCard } from '../ui/MetricCard.js';

interface StatTileProps {
  label: string;
  value: string;
}

/** Compatibilidade para os dashboards existentes; a aparência vive no MetricCard do design system. */
export function StatTile({ label, value }: StatTileProps) {
  return <MetricCard label={label} value={value} />;
}
