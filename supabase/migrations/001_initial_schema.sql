-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Gyms
create table public.gyms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  address text,
  phone text,
  email text,
  logo_url text,
  created_at timestamptz not null default now()
);
alter table public.gyms enable row level security;
create policy "Owners can manage their gym" on public.gyms
  using (owner_id = auth.uid());

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'owner' check (role in ('owner', 'trainer', 'member')),
  gym_id uuid references public.gyms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users can view and update own profile" on public.profiles
  using (id = auth.uid())
  with check (id = auth.uid());
create policy "Gym owners can view member profiles" on public.profiles
  for select using (
    gym_id in (select id from public.gyms where owner_id = auth.uid())
  );

-- Memberships (plans)
create table public.memberships (
  id uuid primary key default uuid_generate_v4(),
  gym_id uuid references public.gyms(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'quarterly', 'yearly')),
  features text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
create policy "Gym owners manage memberships" on public.memberships
  using (gym_id in (select id from public.gyms where owner_id = auth.uid()));

-- Members
create table public.members (
  id uuid primary key default uuid_generate_v4(),
  gym_id uuid references public.gyms(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  membership_id uuid references public.memberships(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  joined_at timestamptz not null default now(),
  expires_at timestamptz,
  unique(gym_id, profile_id)
);
alter table public.members enable row level security;
create policy "Gym owners manage members" on public.members
  using (gym_id in (select id from public.gyms where owner_id = auth.uid()));
create policy "Members can view own record" on public.members
  for select using (profile_id = auth.uid());

-- Check-ins
create table public.check_ins (
  id uuid primary key default uuid_generate_v4(),
  gym_id uuid references public.gyms(id) on delete cascade not null,
  member_id uuid references public.members(id) on delete cascade not null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz
);
alter table public.check_ins enable row level security;
create policy "Gym owners view check-ins" on public.check_ins
  using (gym_id in (select id from public.gyms where owner_id = auth.uid()));

-- Classes
create table public.classes (
  id uuid primary key default uuid_generate_v4(),
  gym_id uuid references public.gyms(id) on delete cascade not null,
  trainer_id uuid references public.profiles(id) on delete set null not null,
  name text not null,
  description text,
  capacity integer not null default 20,
  duration_minutes integer not null default 60,
  scheduled_at timestamptz not null,
  location text,
  created_at timestamptz not null default now()
);
alter table public.classes enable row level security;
create policy "Gym owners manage classes" on public.classes
  using (gym_id in (select id from public.gyms where owner_id = auth.uid()));
create policy "Members view classes" on public.classes
  for select using (
    gym_id in (
      select gym_id from public.members where profile_id = auth.uid()
    )
  );

-- Class bookings
create table public.class_bookings (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references public.classes(id) on delete cascade not null,
  member_id uuid references public.members(id) on delete cascade not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'waitlist')),
  booked_at timestamptz not null default now(),
  unique(class_id, member_id)
);
alter table public.class_bookings enable row level security;
create policy "Gym owners view bookings" on public.class_bookings
  using (
    class_id in (
      select id from public.classes where gym_id in (
        select id from public.gyms where owner_id = auth.uid()
      )
    )
  );
create policy "Members manage own bookings" on public.class_bookings
  using (
    member_id in (select id from public.members where profile_id = auth.uid())
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_gym_id uuid;
begin
  -- Create gym if gym_name is provided
  if new.raw_user_meta_data->>'gym_name' is not null then
    insert into public.gyms (name, owner_id)
    values (new.raw_user_meta_data->>'gym_name', new.id)
    returning id into new_gym_id;
  end if;

  insert into public.profiles (id, full_name, role, gym_id)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'owner',
    new_gym_id
  );

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
