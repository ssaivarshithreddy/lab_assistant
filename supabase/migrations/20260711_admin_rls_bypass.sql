-- Admin RLS bypass policies to allow dashboard to view all data

-- Create admin role if it doesn't exist
do $$
begin
  create role admin_user;
exception when duplicate_object then
  null;
end
$$;

-- Add admin bypass policies for reports (allow unauthenticated public read for admin dashboard)
create policy "admin can view all reports"
on public.reports
for select
using (true);

-- Add admin bypass policies for profiles (allow unauthenticated public read for admin dashboard)
create policy "admin can view all profiles"
on public.profiles
for select
using (true);

-- Add admin bypass policies for chat messages
create policy "admin can view all chat messages"
on public.chat_messages
for select
using (true);
