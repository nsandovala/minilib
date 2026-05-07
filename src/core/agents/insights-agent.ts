import type { TimelineEntry } from '@/types';

export interface MicroInsight {
  id: string;
  type: 'pattern' | 'reminder' | 'summary' | 'anomaly';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export function detectInsights(entries: TimelineEntry[]): MicroInsight[] {
  const insights: MicroInsight[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  const todayEntries = entries.filter((e) => e.date === todayStr);
  const pendingEntries = entries.filter((e) => !e.done && e.date);

  if (todayEntries.length > 3) {
    insights.push({
      id: 'busy-day',
      type: 'summary',
      message: `Tienes ${todayEntries.length} entradas para hoy`,
      severity: 'low',
    });
  }

  const overdueEntries = pendingEntries.filter(
    (e) => e.date && e.date < todayStr
  );
  if (overdueEntries.length > 0) {
    insights.push({
      id: 'overdue',
      type: 'reminder',
      message: `${overdueEntries.length} entrada(s) vencida(s)`,
      severity: 'high',
    });
  }

  const paymentEntries = entries.filter((e) => e.type === 'payment' && !e.done);
  if (paymentEntries.length >= 3) {
    insights.push({
      id: 'payment-cluster',
      type: 'pattern',
      message: `${paymentEntries.length} pagos pendientes`,
      severity: 'medium',
    });
  }

  const healthEntries = entries.filter(
    (e) => e.type === 'health' && !e.done && e.date && e.date >= todayStr
  );
  if (healthEntries.length > 0) {
    insights.push({
      id: 'health-upcoming',
      type: 'reminder',
      message: `${healthEntries.length} asunto(s) de salud próximo(s)`,
      severity: 'medium',
    });
  }

  const petEntries = entries.filter(
    (e) => e.type === 'pet' && !e.done && e.date && e.date >= todayStr
  );
  if (petEntries.length > 0) {
    insights.push({
      id: 'pet-upcoming',
      type: 'reminder',
      message: `${petEntries.length} asunto(s) de mascota próximo(s)`,
      severity: 'low',
    });
  }

  return insights;
}
