import { z } from 'zod';

/** Datas de filtros são dias de calendário, não instantes UTC. O Firebird usa o dia local do Date recebido. */
function localCalendarDate(value: string, endOfDay: boolean): Date {
  const [year, month, day] = value.split('-').map(Number);
  return endOfDay
    ? new Date(year!, month! - 1, day!, 23, 59, 59, 999)
    : new Date(year!, month! - 1, day!);
}

export const calendarStartSchema = z.iso.date().transform((value) => localCalendarDate(value, false));
export const calendarEndSchema = z.iso.date().transform((value) => localCalendarDate(value, true));
