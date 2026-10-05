/**
 * Centralized formatting and UI color utilities for the Agentic School ERP.
 */

export function formatCurrencyINR(amount: number | null | undefined): string {
  const val = Number(amount ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(date);
  }
}

export function formatTimeAgo(date: string | Date | null | undefined): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getGradeBadge(score: number, maxScore: number = 100): { grade: string; color: string; bg: string } {
  if (maxScore <= 0) return { grade: '-', color: 'var(--text-tertiary)', bg: 'var(--bg-app)' };
  const pct = (score / maxScore) * 100;
  if (pct >= 90) return { grade: 'A+', color: '#059669', bg: '#ECFDF5' };
  if (pct >= 80) return { grade: 'A', color: '#10B981', bg: '#D1FAE5' };
  if (pct >= 70) return { grade: 'B', color: '#2563EB', bg: '#EFF6FF' };
  if (pct >= 60) return { grade: 'C', color: '#0891B2', bg: '#ECFEFF' };
  if (pct >= 50) return { grade: 'D', color: '#D97706', bg: '#FFFBEB' };
  if (pct >= 35) return { grade: 'E', color: '#EA580C', bg: '#FFF7ED' };
  return { grade: 'F', color: '#DC2626', bg: '#FEF2F2' };
}

export function getAttendanceStatusBadge(status: string): { label: string; color: string; bg: string } {
  const s = (status || '').toUpperCase();
  if (s === 'PRESENT') return { label: 'Present', color: 'var(--status-success)', bg: 'rgba(16, 185, 129, 0.1)' };
  if (s === 'ABSENT') return { label: 'Absent', color: 'var(--status-danger)', bg: 'rgba(239, 68, 68, 0.1)' };
  if (s === 'LATE') return { label: 'Late', color: 'var(--status-warning)', bg: 'rgba(245, 158, 11, 0.1)' };
  if (s === 'HALF_DAY') return { label: 'Half Day', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' };
  return { label: status || 'Unknown', color: 'var(--text-secondary)', bg: 'var(--bg-surface-hover)' };
}

export function getAnomalyBadgeStyle(type: string): { label: string; color: string; bg: string; border: string } {
  const t = (type || '').toUpperCase();
  if (t === 'CRITICAL') {
    return {
      label: 'CRITICAL',
      color: 'var(--status-danger)',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.25)',
    };
  }
  if (t === 'WARNING') {
    return {
      label: 'WARNING',
      color: 'var(--status-warning)',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.25)',
    };
  }
  return {
    label: 'INFO',
    color: 'var(--brand-primary)',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.25)',
  };
}

export function formatChartSeries(labels: string[], datasets: { label: string; data: number[] }[]): any[] {
  if (!labels || !labels.length) return [];
  return labels.map((label, index) => {
    const item: Record<string, any> = { name: label };
    datasets.forEach((ds) => {
      item[ds.label] = ds.data[index] ?? 0;
    });
    return item;
  });
}

export function getMTSSRiskBadge(level?: string | null): { label: string; color: string; bg: string; border: string; tier: string } {
  const l = (level || '').toUpperCase();
  if (l === 'CRITICAL' || l === 'TIER_3') {
    return {
      label: 'Tier 3 (High Risk)',
      tier: 'Tier 3',
      color: 'var(--status-danger)',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
    };
  }
  if (l === 'HIGH' || l === 'MODERATE' || l === 'TIER_2') {
    return {
      label: l === 'HIGH' ? 'Tier 2 (High Risk)' : 'Tier 2 (Moderate)',
      tier: 'Tier 2',
      color: 'var(--status-warning)',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
    };
  }
  return {
    label: 'Tier 1 (Universal / Low)',
    tier: 'Tier 1',
    color: 'var(--status-success)',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
  };
}

export function numberToIndianWords(num: number): string {
  const n = Math.round(Number(num || 0));
  if (n <= 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  function convertTwoDigits(v: number): string {
    if (v < 20) return ones[v];
    return `${tens[Math.floor(v / 10)]}${v % 10 !== 0 ? ' ' + ones[v % 10] : ''}`;
  }

  function convertThreeDigits(v: number): string {
    const h = Math.floor(v / 100);
    const rem = v % 100;
    const hStr = h > 0 ? `${ones[h]} Hundred` : '';
    const remStr = rem > 0 ? convertTwoDigits(rem) : '';
    return [hStr, remStr].filter(Boolean).join(' and ');
  }

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundredAndBelow = n % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${convertTwoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${convertTwoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${convertTwoDigits(thousand)} Thousand`);
  if (hundredAndBelow > 0) parts.push(convertThreeDigits(hundredAndBelow));

  return `Rupees ${parts.join(' ')} Only`;
}

