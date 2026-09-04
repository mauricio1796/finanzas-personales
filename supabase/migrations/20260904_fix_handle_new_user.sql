-- ============================================================
-- Fix: "Database error saving new user"
--
-- Causa: handle_new_user() podía insertar NULL en profiles.name
-- (coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1))
-- resuelve a NULL si el email es NULL o no trae '@', lo cual viola el
-- NOT NULL de profiles.name y aborta el INSERT en auth.users completo).
--
-- Además: cualquier error inesperado en este trigger bloqueaba el
-- signup entero. Se envuelve en EXCEPTION para que un fallo al crear
-- el perfil nunca impida crear el usuario de auth.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    )
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
