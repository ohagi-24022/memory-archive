create extension if not exists "pgcrypto";

create table if not exists public.archives (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text not null,
  og_image_url text,
  description text,
  summary text,
  user_memo text,
  created_at timestamptz default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.archive_tags (
  archive_id uuid references public.archives(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (archive_id, tag_id)
);

create index if not exists archives_created_at_idx on public.archives(created_at desc);
create index if not exists archive_tags_archive_id_idx on public.archive_tags(archive_id);
create index if not exists archive_tags_tag_id_idx on public.archive_tags(tag_id);

