-- Everyone can read
create policy "profiles_select_public" on profiles 
  for select using (true);

-- Only owner can update their profile
create policy "profiles_update_self" on profiles 
  for update using (id = auth.uid());

-- Student leads can update role/status of teammates
create policy "profiles_update_student_lead" on profiles 
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.is_student_lead = true
      and p.team_number = profiles.team_number
    )
  );

-- Only authenticated users can insert
create policy "profiles_insert_auth" on profiles 
  for insert with check (auth.role() = 'authenticated');