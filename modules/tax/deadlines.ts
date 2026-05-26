export type Quarter = 1 | 2 | 3 | 4;

export interface QuarterDeadline {
  quarter: Quarter;
  year: number;
  label: string;
  deadline: Date;
  daysRemaining: number;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export function getDeadline(year: number, quarter: Quarter): Date {
  switch (quarter) {
    case 1: return new Date(year, 4, 15);
    case 2: return new Date(year, 7, 15);
    case 3: return new Date(year, 10, 15);
    case 4: return new Date(year + 1, 3, 15);
  }
}

export function getDaysRemaining(deadline: Date, today: Date = new Date()): number {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const deadlineMidnight = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const ms = deadlineMidnight.getTime() - todayMidnight.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function getCurrentQuarter(today: Date = new Date()): { quarter: Quarter; year: number } {
  const month = today.getMonth();
  const year = today.getFullYear();
  if (month <= 2) return { quarter: 1, year };
  if (month <= 5) return { quarter: 2, year };
  if (month <= 8) return { quarter: 3, year };
  return { quarter: 4, year };
}

export function getQuarterDeadline(year: number, quarter: Quarter, today: Date = new Date()): QuarterDeadline {
  const deadline = getDeadline(year, quarter);
  const daysRemaining = getDaysRemaining(deadline, today);
  return {
    quarter, year,
    label: `Q${quarter} ${year}`,
    deadline, daysRemaining,
    isOverdue: daysRemaining < 0,
    isDueSoon: daysRemaining >= 0 && daysRemaining <= 7,
  };
}

export function formatDeadlineDate(deadline: Date): string {
  return deadline.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}

export function getUrgencyMessage(info: QuarterDeadline): string {
  if (info.isOverdue) {
    const days = Math.abs(info.daysRemaining);
    return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  }
  if (info.daysRemaining === 0) return "Due today";
  if (info.isDueSoon) return `Due in ${info.daysRemaining} day${info.daysRemaining === 1 ? "" : "s"}`;
  return `${info.daysRemaining} days remaining`;
}