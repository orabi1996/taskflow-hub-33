import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeWorkLogs } from "../src/lib/work-log-summary.ts";

test("multiple contributions to one task are not counted as multiple completed tasks", () => {
  const rows = [
    { user_id: "a", work_date: "2026-09-20", task_id: "task", minutes: 30, status: "accepted" },
    { user_id: "a", work_date: "2026-09-21", task_id: "task", minutes: 60, status: "submitted" },
    { user_id: "a", work_date: "2026-09-21", task_id: null, minutes: null, status: "returned" },
    { user_id: "b", work_date: "2026-09-21", task_id: "task", minutes: 20, status: "draft" },
  ];
  assert.deepEqual(summarizeWorkLogs(rows), [
    {
      userId: "a",
      logs: 3,
      accepted: 1,
      returned: 1,
      submitted: 1,
      minutes: 90,
      tasksWorkedOn: 1,
      recordedDays: 2,
    },
    {
      userId: "b",
      logs: 1,
      accepted: 0,
      returned: 0,
      submitted: 0,
      minutes: 20,
      tasksWorkedOn: 1,
      recordedDays: 1,
    },
  ]);
});
test("empty periods do not manufacture zero performance scores", () => {
  assert.deepEqual(summarizeWorkLogs([]), []);
});
