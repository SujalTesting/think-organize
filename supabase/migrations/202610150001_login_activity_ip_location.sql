-- Allow login activity to distinguish IP-detected location from profile data.
-- Existing rows and the user's profile are intentionally left unchanged.
alter table public.login_activity
  drop constraint if exists login_activity_location_source_check;

alter table public.login_activity
  add constraint login_activity_location_source_check
  check (location_source in ('profile', 'ip', 'not_provided'));

comment on table public.login_activity is
  'Successful sign-in history. Location is approximated from the sign-in public IP when available; the IP address itself is not stored.';

comment on column public.login_activity.location_source is
  'ip means approximate public-IP geolocation; profile means legacy profile-derived data; not_provided means location lookup was unavailable.';
