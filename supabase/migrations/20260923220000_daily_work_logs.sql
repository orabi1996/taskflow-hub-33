-- Daily evidence of work, distinct from task completion and timer sessions.
create table public.work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  work_date date not null,
  task_id uuid references public.tasks(id),
  client_id uuid references public.clients(id),
  module_id uuid references public.company_modules(id),
  activity_type text not null check (activity_type in ('work','meeting','support','training','other')),
  description text not null check (length(btrim(description)) between 3 and 3000),
  outcome text not null check (length(btrim(outcome)) between 3 and 3000),
  blocker text not null default '' check (length(blocker) <= 3000),
  minutes integer check (minutes between 1 and 1440),
  status text not null default 'draft' check (status in ('draft','submitted','accepted','returned')),
  review_note text not null default '',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index work_logs_user_date on public.work_logs(user_id, work_date);
create index work_logs_date on public.work_logs(work_date);

create function public.can_review_work_log(employee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth.uid() <> employee
    and exists (select 1 from public.profiles where id = auth.uid() and is_active)
    and (public.is_admin_or_gm(auth.uid()) or
      (public.has_role(auth.uid(), 'manager') and exists (
        select 1 from public.profiles where id = employee and manager_id = auth.uid()
      )));
$$;
revoke all on function public.can_review_work_log(uuid) from public, anon;
grant execute on function public.can_review_work_log(uuid) to authenticated;

alter table public.work_logs enable row level security;
create policy work_logs_read on public.work_logs for select to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and is_active)
  and (user_id = auth.uid() or public.can_review_work_log(user_id))
);
create policy work_logs_insert on public.work_logs for insert to authenticated with check (
  user_id = auth.uid() and status = 'draft'
  and exists (select 1 from public.profiles where id = auth.uid() and is_active)
);
create policy work_logs_update on public.work_logs for update to authenticated
using ((user_id = auth.uid() and status in ('draft','returned')) or (status = 'submitted' and public.can_review_work_log(user_id)))
with check (user_id = auth.uid() or public.can_review_work_log(user_id));
grant select, insert, update on public.work_logs to authenticated;

-- Invoker rights preserve RLS when validating references to existing records.
create function public.guard_work_log() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.work_date > (now() at time zone 'Africa/Cairo')::date then
    raise exception 'لا يمكن تسجيل عمل بتاريخ مستقبلي';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now(); new.reviewed_by := null; new.reviewed_at := null; new.review_note := '';
  else
    if new.id <> old.id or new.user_id <> old.user_id or new.created_at <> old.created_at then
      raise exception 'لا يمكن تغيير مالك السجل أو تاريخ إنشائه';
    end if;
    if old.user_id = auth.uid() then
      if old.status not in ('draft','returned') or new.status not in ('draft','submitted') then
        raise exception 'السجل مرسل أو معتمد ولا يمكن تعديله';
      end if;
      new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    else
      if not public.can_review_work_log(old.user_id) or old.status <> 'submitted' or new.status not in ('accepted','returned') then
        raise exception 'غير مسموح بمراجعة هذا السجل';
      end if;
      if (to_jsonb(new) - array['status','review_note','reviewed_by','reviewed_at','updated_at'])
        is distinct from (to_jsonb(old) - array['status','review_note','reviewed_by','reviewed_at','updated_at']) then
        raise exception 'المراجع لا يعدل بيانات عمل الموظف';
      end if;
      if new.status = 'returned' and length(btrim(new.review_note)) < 3 then
        raise exception 'وضح سبب طلب الاستكمال';
      end if;
      new.reviewed_by := auth.uid(); new.reviewed_at := now(); new.updated_at := now();
      return new;
    end if;
  end if;
  if new.task_id is not null and not exists (select 1 from public.tasks where id = new.task_id) then
    raise exception 'المهمة غير متاحة';
  end if;
  if new.client_id is not null and not exists (select 1 from public.clients where id = new.client_id) then
    raise exception 'العميل غير متاح';
  end if;
  if new.module_id is not null and not exists (select 1 from public.company_modules where id = new.module_id and is_active) then
    raise exception 'الموديول غير متاح';
  end if;
  if new.task_id is not null and exists (select 1 from public.tasks t where t.id = new.task_id and
    (t.client_id is distinct from new.client_id or t.module_id is distinct from new.module_id)) then
    raise exception 'يجب أن يطابق العميل والموديول بيانات المهمة';
  end if;
  new.updated_at := now(); return new;
end;
$$;
create trigger guard_work_log before insert or update on public.work_logs for each row execute function public.guard_work_log();

create table public.work_log_history (
  id bigint generated always as identity primary key,
  work_log_id uuid not null references public.work_logs(id),
  actor_id uuid not null,
  changed_at timestamptz not null default now(),
  old_record jsonb,
  new_record jsonb not null
);
alter table public.work_log_history enable row level security;
create policy work_log_history_read on public.work_log_history for select to authenticated using (
  exists (select 1 from public.work_logs w where w.id = work_log_id)
);
grant select on public.work_log_history to authenticated;
create function public.audit_work_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.work_log_history(work_log_id, actor_id, old_record, new_record)
  values (new.id, auth.uid(), case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end;
$$;
revoke all on function public.audit_work_log() from public, anon, authenticated;
create trigger audit_work_log after insert or update on public.work_logs for each row execute function public.audit_work_log();
