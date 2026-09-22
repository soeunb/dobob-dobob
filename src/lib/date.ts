export function todayKey(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export function addDaysToDateKey(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date(`${dateKey}T00:00:00`);

  date.setDate(date.getDate() + amount);
  return todayKey(date);
}

export function addMonthsToDateKey(dateKey: string, amount: number) {
  const date = dateFromKey(dateKey);
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();

  targetMonth.setDate(Math.min(date.getDate(), lastDay));
  return todayKey(targetMonth);
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date(`${dateKey}T00:00:00`);
}

export function getWeekDateKeys(dateKey: string) {
  const date = dateFromKey(dateKey);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  const firstDay = addDaysToDateKey(dateKey, -daysSinceMonday);

  return Array.from({ length: 7 }, (_, index) => addDaysToDateKey(firstDay, index));
}

export function getMonthCalendarDates(dateKey: string) {
  const selectedDate = dateFromKey(dateKey);
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const daysSinceMonday = (monthStart.getDay() + 6) % 7;
  const gridStart = addDaysToDateKey(todayKey(monthStart), -daysSinceMonday);

  return Array.from({ length: 42 }, (_, index) => {
    const calendarDateKey = addDaysToDateKey(gridStart, index);
    const calendarDate = dateFromKey(calendarDateKey);

    return {
      dateKey: calendarDateKey,
      isCurrentMonth: calendarDate.getMonth() === selectedDate.getMonth(),
    };
  });
}

export function formatKoreanMonth(dateKey: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(dateFromKey(dateKey));
}

export function formatKoreanDate(dateKey: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${dateKey}T00:00:00`));
}
