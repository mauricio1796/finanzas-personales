-- ============================================================
-- BUG-02 — Finanzas compartidas: esquema BASELINE versionado
--
-- Corrección al informe de auditoría: estas tablas SÍ existían en producción y
-- SÍ tenían RLS correctamente configurada (aislamiento por membresía mediante
-- `is_active_member`). NO había fuga de datos entre usuarios. El problema real
-- era que se habían creado fuera de toda migración, por lo que su seguridad no
-- podía auditarse desde el repositorio.
--
-- Este archivo documenta el esquema tal y como existe en producción, para que
-- un entorno nuevo pueda reproducirlo. Es idempotente: sobre la base actual no
-- cambia nada (las políticas se redefinen con los MISMOS nombres, así que no se
-- duplican ni se acumulan con OR).
-- ============================================================

-- ─── Tablas ──────────────────────────────────────────────────────────────────

create table if not exists public.shared_spaces (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  type       text        not null default 'pareja',
  created_by uuid        not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.space_members (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid        not null references public.shared_spaces on delete cascade,
  user_id    uuid        not null references auth.users on delete cascade,
  role       text        not null default 'miembro',
  status     text        not null default 'activo',
  created_at timestamptz not null default now(),
  unique (space_id, user_id)
);

create table if not exists public.space_invitations (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid        not null references public.shared_spaces on delete cascade,
  code       text        not null unique,
  email      text,
  status     text        not null default 'pendiente',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shared_expenses (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid        not null references public.shared_spaces on delete cascade,
  paid_by     uuid        not null references auth.users on delete cascade,
  amount      numeric     not null check (amount >= 0),
  category    text        not null default 'Otros',
  description text,
  date        date        not null default current_date,
  created_at  timestamptz not null default now()
);

create table if not exists public.expense_splits (
  id              uuid primary key default gen_random_uuid(),
  expense_id      uuid    not null references public.shared_expenses on delete cascade,
  user_id         uuid    not null references auth.users on delete cascade,
  assigned_amount numeric not null check (assigned_amount >= 0),
  unique (expense_id, user_id)
);

-- ─── Helper de membresía ─────────────────────────────────────────────────────
-- SECURITY DEFINER evita la recursión infinita de RLS: si la política de
-- `space_members` consultara `space_members` con RLS activa, Postgres entraría
-- en bucle. Solo responde sí/no.

create or replace function public.is_active_member(p_space_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space_id
      and m.user_id  = (select auth.uid())
      and m.status   = 'activo'
  );
$$;

revoke all on function public.is_active_member(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.shared_spaces     enable row level security;
alter table public.space_members     enable row level security;
alter table public.space_invitations enable row level security;
alter table public.shared_expenses   enable row level security;
alter table public.expense_splits    enable row level security;

drop policy if exists "shared_spaces: ver si soy miembro" on public.shared_spaces;
create policy "shared_spaces: ver si soy miembro"
  on public.shared_spaces for select using (public.is_active_member(id));

drop policy if exists "shared_spaces: crear" on public.shared_spaces;
create policy "shared_spaces: crear"
  on public.shared_spaces for insert with check (created_by = (select auth.uid()));

drop policy if exists "shared_spaces: editar si soy creador" on public.shared_spaces;
create policy "shared_spaces: editar si soy creador"
  on public.shared_spaces for update using (created_by = (select auth.uid()));

drop policy if exists "shared_spaces: borrar si soy creador" on public.shared_spaces;
create policy "shared_spaces: borrar si soy creador"
  on public.shared_spaces for delete using (created_by = (select auth.uid()));

drop policy if exists "space_members: ver si soy miembro" on public.space_members;
create policy "space_members: ver si soy miembro"
  on public.space_members for select using (public.is_active_member(space_id));

drop policy if exists "space_members: insertar como creador o auto" on public.space_members;
create policy "space_members: insertar como creador o auto"
  on public.space_members for insert with check (
    user_id = (select auth.uid())
    or exists (select 1 from public.shared_spaces s
               where s.id = space_members.space_id and s.created_by = (select auth.uid()))
  );

drop policy if exists "space_members: actualizar propio" on public.space_members;
create policy "space_members: actualizar propio"
  on public.space_members for update using (
    user_id = (select auth.uid())
    or exists (select 1 from public.shared_spaces s
               where s.id = space_members.space_id and s.created_by = (select auth.uid()))
  );

-- Lectura/actualización solo para miembros. Quien llega con un código todavía
-- no es miembro, así que usa la RPC `buscar_invitacion_por_codigo`
-- (ver 20260923_harden_space_invitations.sql).
drop policy if exists "space_invitations: lectura de miembros" on public.space_invitations;
create policy "space_invitations: lectura de miembros"
  on public.space_invitations for select using (public.is_active_member(space_id));

drop policy if exists "space_invitations: actualizar miembros" on public.space_invitations;
create policy "space_invitations: actualizar miembros"
  on public.space_invitations for update using (public.is_active_member(space_id));

drop policy if exists "space_invitations: gestionar si soy creador" on public.space_invitations;
create policy "space_invitations: gestionar si soy creador"
  on public.space_invitations for all
  using (exists (select 1 from public.shared_spaces s
                 where s.id = space_invitations.space_id and s.created_by = (select auth.uid())))
  with check (exists (select 1 from public.shared_spaces s
                      where s.id = space_invitations.space_id and s.created_by = (select auth.uid())));

drop policy if exists "shared_expenses: ver si soy miembro" on public.shared_expenses;
create policy "shared_expenses: ver si soy miembro"
  on public.shared_expenses for select using (public.is_active_member(space_id));

drop policy if exists "shared_expenses: insertar si soy miembro" on public.shared_expenses;
create policy "shared_expenses: insertar si soy miembro"
  on public.shared_expenses for insert
  with check (public.is_active_member(space_id) and paid_by = (select auth.uid()));

drop policy if exists "shared_expenses: editar si pague yo" on public.shared_expenses;
create policy "shared_expenses: editar si pague yo"
  on public.shared_expenses for update
  using (public.is_active_member(space_id) and paid_by = (select auth.uid()));

drop policy if exists "shared_expenses: borrar si pague yo" on public.shared_expenses;
create policy "shared_expenses: borrar si pague yo"
  on public.shared_expenses for delete
  using (public.is_active_member(space_id) and paid_by = (select auth.uid()));

drop policy if exists "expense_splits: ver si soy miembro del espacio" on public.expense_splits;
create policy "expense_splits: ver si soy miembro del espacio"
  on public.expense_splits for select using (exists (
    select 1 from public.shared_expenses se
    where se.id = expense_splits.expense_id and public.is_active_member(se.space_id)));

drop policy if exists "expense_splits: insertar si soy miembro del espacio" on public.expense_splits;
create policy "expense_splits: insertar si soy miembro del espacio"
  on public.expense_splits for insert with check (exists (
    select 1 from public.shared_expenses se
    where se.id = expense_splits.expense_id and public.is_active_member(se.space_id)));

drop policy if exists "expense_splits: borrar si soy miembro del espacio" on public.expense_splits;
create policy "expense_splits: borrar si soy miembro del espacio"
  on public.expense_splits for delete using (exists (
    select 1 from public.shared_expenses se
    where se.id = expense_splits.expense_id and public.is_active_member(se.space_id)));
