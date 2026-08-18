// Extracts a human-readable Arabic-friendly message from any thrown error
// (Zod validation, fetch Response, plain Error, or unknown shapes).

const FIELD_LABELS: Record<string, string> = {
  email: "البريد الإلكتروني",
  password: "كلمة السر",
  full_name: "الاسم",
  job_title: "المسمى الوظيفي",
  phone: "رقم الموبايل",
  department: "القسم",
  hire_date: "تاريخ التعيين",
  manager_id: "المدير المباشر",
  role: "الدور",
  user_id: "المستخدم",
  new_password: "كلمة السر الجديدة",
};

function translateZodIssue(issue: any): string {
  const path = Array.isArray(issue?.path) ? issue.path : [];
  const fieldKey = path[path.length - 1];
  const label = FIELD_LABELS[fieldKey] ?? (fieldKey ? String(fieldKey) : "الحقل");

  switch (issue?.code) {
    case "too_small":
      if (issue.type === "string") return `${label}: يجب ألا يقل عن ${issue.minimum} حرف`;
      if (issue.type === "number") return `${label}: يجب ألا يقل عن ${issue.minimum}`;
      return `${label}: قيمة صغيرة جدًا`;
    case "too_big":
      if (issue.type === "string") return `${label}: يجب ألا يزيد عن ${issue.maximum} حرف`;
      return `${label}: قيمة كبيرة جدًا`;
    case "invalid_string":
      if (issue.validation === "email") return `${label}: بريد إلكتروني غير صالح`;
      if (issue.validation === "uuid") return `${label}: قيمة غير صالحة`;
      return `${label}: تنسيق غير صالح`;
    case "invalid_type":
      return `${label}: نوع غير صالح`;
    case "invalid_enum_value":
      return `${label}: قيمة غير مسموح بها`;
    default:
      return issue?.message ? `${label}: ${issue.message}` : `${label}: قيمة غير صالحة`;
  }
}

function tryParseZodMessage(text: string): string | null {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.code) {
      return parsed.map(translateZodIssue).join(" — ");
    }
  } catch {
    // not JSON
  }
  return null;
}

export function formatErrorMessage(err: unknown, fallback = "فشلت العملية"): string {
  if (!err) return fallback;

  // ZodError instance (has .issues)
  if (typeof err === "object" && err !== null && Array.isArray((err as any).issues)) {
    return (err as any).issues.map(translateZodIssue).join(" — ");
  }

  // fetch Response
  if (typeof Response !== "undefined" && err instanceof Response) {
    return `خطأ ${err.status}: ${err.statusText || "تعذّر إكمال الطلب"}`;
  }

  // Plain Error
  if (err instanceof Error) {
    const fromZod = tryParseZodMessage(err.message);
    if (fromZod) return fromZod;
    return err.message || fallback;
  }

  // String
  if (typeof err === "string") {
    const fromZod = tryParseZodMessage(err);
    return fromZod ?? err;
  }

  return fallback;
}
