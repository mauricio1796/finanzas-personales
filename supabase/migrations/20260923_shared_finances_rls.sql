-- ============================================================
-- BUG-02 — Finanzas compartidas sin migración versionada ni RLS verificable
--
-- El código de `src/features/shared-finances/` consulta cinco tablas que no
-- existían en ninguna migración del repositorio, por lo que su RLS no podía
-- auditarse. Peor aún, `obtenerMiEspacio()` hacía `select * limit 1` SIN filtrar
-- por usuario, confiando por completo en una RLS que nadie podía verificar.
--
-- Esta migración define esas tablas y su aislamiento por membresía.
--
-- IMPORTANTE (idempotencia): usa `create table if not exists`, por lo que si las
-- tablas ya fueron creadas a mano en el dashboard NO se recrean — pero las
-- políticas SÍ se redefinen (drop policy if exists + create policy), de modo que
-- el aislamiento queda garantizado incluso sobre tablas preexistentes.
-- ============================================================

-- ─── Tablas ──────────────────────────────────────────────────────────────────

create table if not exists public.shared_spaces (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  type       text        not null default 'pareja' check (type in ('pareja', 'roomies', 'familia')),
  created_by uuid        not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.space_members (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid        not null references public.shared_spaces on delete cascade,
  user_id    uuid        not null references auth.users on delete cascade,
  role       text        not null default 'miembro' check (role in ('creador', 'miembro')),
  status     text        not null default 'activo'  check (status in ('activo', 'pendiente')),
  created_at timestamptz not null default now(),
  unique (space_id, user_id)
);

create table if not exists public.space_invitations (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid        not null references public.shared_spaces on delete cascade,
  code       text        not null unique,
  email      text,
  status     text        not null default 'pendiente' check (status in ('pendiente', 'aceptada', 'rechazada', 'expirada')),
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

create index if not exists idx_space_members_user  on public.space_members (user_id);
create index if not exists idx_space_members_space on public.space_members (space_id);
create index if not exists idx_shared_expenses_space on public.shared_expenses (space_id);
create index if not exists idx_expense_splits_expense on public.expense_splits (expense_id);

-- ─── Helper de membresía ─────────────────────────────────────────────────────
-- SECURITY DEFINER evita la recursión infinita de RLS: si la política de
-- `space_members` consultara `space_members` con RLS activa, Postgres entraría
-- en bucle. Esta función consulta la tabla sin RLS y solo responde "sí/no".

create or replace function public.es_miembro_activo(p_space_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.space_members m
    where m.space_id = p_space_id
      and m.user_id  = auth.uid()
      and m.status   = 'activo'
  );
$$;

revoke all on function public.es_miembro_activo(uuid) from public;
grant execute on function public.es_miembro_activo(uuid) to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.shared_spaces     enable row level security;
alter table public.space_members     enable row level security;
alter table public.space_invitations enable row level security;
alter table public.shared_expenses   enable row level security;
alter table public.expense_splits    enable row level security;

-- shared_spaces: solo espacios donde el usuario es miembro activo (o su creador).
drop policy if exists "shared_spaces: lectura de miembros" on public.shared_spaces;
create policy "shared_spaces: lectura de miembros"
  on public.shared_spaces for select
  using (created_by = auth.uid() or public.es_miembro_activo(id));

drop policy if exists "shared_spaces: crear propio" on public.shared_spaces;
create policy "shared_spaces: crear propio"
  on public.shared_spaces for insert
  with check (created_by = auth.uid());

drop policy if exists "shared_spaces: actualizar creador" on public.shared_spaces;
create policy "shared_spaces: actualizar creador"
  on public.shared_spaces for update
  using (created_by = auth.uid());

drop policy if exists "shared_spaces: eliminar creador" on public.shared_spaces;
create policy "shared_spaces: eliminar creador"
  on public.shared_spaces for delete
  using (created_by = auth.uid());

-- space_members: se ven los miembros de los espacios a los que perteneces.
drop policy if exists "space_members: lectura del espacio" on public.space_members;
create policy "space_members: lectura del espacio"
  on public.space_members for select
  using (user_id = auth.uid() or public.es_miembro_activo(space_id));

-- Un usuario solo puede insertarse a SÍ MISMO (aceptar invitación / crear espacio).
drop policy if exists "space_members: unirse uno mismo" on public.space_members;
create policy "space_members: unirse uno mismo"
  on public.space_members for insert
  with check (user_id = auth.uid());

drop policy if exists "space_members: actualizar propio" on public.space_members;
create policy "space_members: actualizar propio"
  on public.space_members for update
  using (user_id = auth.uid());

drop policy if exists "space_members: salir del espacio" on public.space_members;
create policy "space_members: salir del espacio"
  on public.space_members for delete
  using (user_id = auth.uid());

-- space_invitations: un invitado necesita leer por código ANTES de ser miembro,
-- por eso la lectura permite una invitación pendiente y vigente. No expone
-- finanzas: solo el código, el espacio y su vencimiento.
drop policy if exists "space_invitations: lectura" on public.space_invitations;
create policy "space_invitations: lectura"
  on public.space_invitations for select
  using (
    public.es_miembro_activo(space_id)
    or (status = 'pendiente' and expires_at > now())
  );

drop policy if exists "space_invitations: crear miembro" on public.space_invitations;
create policy "space_invitations: crear miembro"
  on public.space_invitations for insert
  with check (public.es_miembro_activo(space_id));

-- Permite marcar la invitación como aceptada/expirada al unirse.
drop policy if exists "space_invitations: actualizar" on public.space_invitations;
create policy "space_invitations: actualizar"
  on public.space_invitations for update
  using (
    public.es_miembro_activo(space_id)
    or (status = 'pendiente' and expires_at > now())
  );

-- shared_expenses: estrictamente de miembros activos del espacio.
drop policy if exists "shared_expenses: lectura de miembros" on public.shared_expenses;
create policy "shared_expenses: lectura de miembros"
  on public.shared_expenses for select
  using (public.es_miembro_activo(space_id));

drop policy if exists "shared_expenses: crear miembro" on public.shared_expenses;
create policy "shared_expenses: crear miembro"
  on public.shared_expenses for insert
  with check (public.es_miembro_activo(space_id) and paid_by = auth.uid());

drop policy if exists "shared_expenses: actualizar pagador" on public.shared_expenses;
create policy "shared_expenses: actualizar pagador"
  on public.shared_expenses for update
  using (public.es_miembro_activo(space_id) and paid_by = auth.uid());

drop policy if exists "shared_expenses: eliminar pagador" on public.shared_expenses;
create policy "shared_expenses: eliminar pagador"
  on public.shared_expenses for delete
  using (public.es_miembro_activo(space_id) and paid_by = auth.uid());

-- expense_splits: heredan el aislamiento del gasto al que pertenecen.
drop policy if exists "expense_splits: lectura de miembros" on public.expense_splits;
create policy "expense_splits: lectura de miembros"
  on public.expense_splits for select
  using (exists (
    select 1 from public.shared_expenses e
    where e.id = expense_id and public.es_miembro_activo(e.space_id)
  ));

drop policy if exists "expense_splits: crear miembro" on public.expense_splits;
create policy "expense_splits: crear miembro"
  on public.expense_splits for insert
  with check (exists (
    select 1 from public.shared_expenses e
    where e.id = expense_id and public.es_miembro_activo(e.space_id)
  ));

drop policy if exists "expense_splits: actualizar miembro" on public.expense_splits;
create policy "expense_splits: actualizar miembro"
  on public.expense_splits for update
  using (exists (
    select 1 from public.shared_expenses e
    where e.id = expense_id and public.es_miembro_activo(e.space_id)
  ));

drop policy if exists "expense_splits: eliminar miembro" on public.expense_splits;
create policy "expense_splits: eliminar miembro"
  on public.expense_splits for delete
  using (exists (
    select 1 from public.shared_expenses e
    where e.id = expense_id and public.es_miembro_activo(e.space_id)
  ));
