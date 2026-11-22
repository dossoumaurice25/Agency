-- =========================================================
-- GLAgency — Base de données partagée (Supabase)
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- /!\ Remplace TON_EMAIL@exemple.com (ligne is_trainer) par l'e-mail
--     du compte formateur AVANT de lancer.
-- =========================================================

-- 1) Table des demandes (une demande = un manager + une ou plusieurs lignes shift/nombre)
create table if not exists public.requests (
  id         uuid primary key default gen_random_uuid(),
  manager    text not null check (char_length(manager) between 2 and 60),
  team       text not null default '' check (char_length(team) <= 60),
  priority   text not null default 'normal' check (priority in ('normal', 'urgent')),
  note       text not null default '' check (char_length(note) <= 300),
  lines      jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 5),
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2) Qui est le formateur ? (un seul endroit à modifier : ton e-mail) 
create or replace function public.is_trainer()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'email') = 'dossoujesug@gmail.com', false);
$$;

-- 3) Sécurité : une demande envoyée par un manager est toujours "propre"
--    (aucun chatter déjà envoyé, jamais archivée, shifts valides, 1 à 99 chatters).
create or replace function public.sanitize_request()
returns trigger
language plpgsql
as $$
declare
  l     jsonb;
  clean jsonb := '[]'::jsonb;
begin
  if not public.is_trainer() then
    for l in select * from jsonb_array_elements(new.lines) loop
      if (l ->> 'shift') in ('matin', 'apres-midi', 'soiree', 'nuit', 'nuit-longue')
         and coalesce((l ->> 'requested')::int, 0) between 1 and 99 then
        clean := clean || jsonb_build_object(
          'shift', l ->> 'shift',
          'requested', (l ->> 'requested')::int,
          'assigned', 0,
          'history', '[]'::jsonb
        );
      end if;
    end loop;

    if jsonb_array_length(clean) = 0 then
      raise exception 'Demande invalide : aucun shift valide';
    end if;

    new.lines      := clean;
    new.archived   := false;
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists sanitize_request on public.requests;
create trigger sanitize_request
  before insert on public.requests
  for each row execute function public.sanitize_request();

-- 4) Droits d'accès (Row Level Security)
--    Managers (anonymes) : peuvent ENVOYER une demande, rien d'autre (ni lire, ni modifier).
--    Formateur           : lit, modifie et supprime tout.
alter table public.requests enable row level security;

grant insert on public.requests to anon;
grant select, insert, update, delete on public.requests to authenticated;

drop policy if exists "managers envoient"   on public.requests;
drop policy if exists "formateur lit"       on public.requests;
drop policy if exists "formateur modifie"   on public.requests;
drop policy if exists "formateur supprime"  on public.requests;

create policy "managers envoient"  on public.requests for insert to anon, authenticated with check (true);
create policy "formateur lit"      on public.requests for select to authenticated using (public.is_trainer());
create policy "formateur modifie"  on public.requests for update to authenticated using (public.is_trainer()) with check (public.is_trainer());
create policy "formateur supprime" on public.requests for delete to authenticated using (public.is_trainer());

-- 5) Mises à jour en direct dans le dashboard
do $$
begin
  alter publication supabase_realtime add table public.requests;
exception when duplicate_object then null;
end $$;
