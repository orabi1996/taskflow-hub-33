export interface WorkFact {
  user_id: string;
  work_date: string;
  task_id: string | null;
  minutes: number | null;
  status: string;
}

/** Aggregate raw facts, never average percentages or equate logs with finished tasks. */
export function summarizeWorkLogs(rows: WorkFact[]) {
  const totals = new Map<
    string,
    {
      userId: string;
      logs: number;
      accepted: number;
      returned: number;
      submitted: number;
      minutes: number;
      tasks: Set<string>;
      days: Set<string>;
    }
  >();
  for (const row of rows) {
    const item = totals.get(row.user_id) ?? {
      userId: row.user_id,
      logs: 0,
      accepted: 0,
      returned: 0,
      submitted: 0,
      minutes: 0,
      tasks: new Set<string>(),
      days: new Set<string>(),
    };
    item.logs++;
    if (row.status === "accepted") item.accepted++;
    if (row.status === "returned") item.returned++;
    if (row.status === "submitted") item.submitted++;
    item.minutes += row.minutes ?? 0;
    if (row.task_id) item.tasks.add(row.task_id);
    item.days.add(row.work_date);
    totals.set(row.user_id, item);
  }
  return [...totals.values()].map(({ tasks, days, ...item }) => ({
    ...item,
    tasksWorkedOn: tasks.size,
    recordedDays: days.size,
  }));
}
