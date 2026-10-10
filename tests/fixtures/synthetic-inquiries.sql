-- TEST FIXTURE: SYNTHETIC DATA ONLY. Never apply to the live (production) database.
--
-- Invented inquiries for testing the admin application, in English and
-- Arabic. Project types follow the public form: web_app and website are
-- explicit choices, not_sure is the form's "Not sure yet", and one inquiry has
-- none, like every inquiry sent before the form asked. Used by the local admin
-- server (scripts/admin-local.mjs) and the browser tests only; it is not
-- product data and is never part of supabase/migrations/.
--
-- THIS FILE MUST STAY ASCII-ONLY. Arabic is written as Postgres Unicode
-- escapes (U&'...' with backslash-hex codes), so no code page, clipboard or
-- terminal pipe can re-encode it on the way in.

insert into public.project_inquiries (id, full_name, email, company_name, company_url, preferred_language, project_type, budget_range, timeline, country, project_description, consent_given, consent_at)
values
  ('11111111-0000-4000-8000-000000000001', 'Synthetic Clinic Group', 'clinic@example.com', 'Nile Physio Group', 'https://www.nile-physio.example/en', 'en', 'web_app', 'Not sure yet', 'Within 3 months', 'Egypt', 'We run three physiotherapy clinics in Cairo. Patients book by phone and we lose track of cancellations. We want an online booking system where patients pick a therapist and time, and our receptionists see the day''s schedule. We already use Google Sheets for schedules.', true, now()),
  -- ar: "Synthetic school"; budget "Not specified"; timeline "Within two months"; country "Egypt"
  -- ar brief: a private school in Alexandria; parents keep phoning about fees and dates; wants a website with online applications.
  ('11111111-0000-4000-8000-000000000002', U&'\0645\062F\0631\0633\0629 \062A\062C\0631\064A\0628\064A\0629', 'school@example.com', null, null, 'ar', 'website', U&'\063A\064A\0631 \0645\062D\062F\062F', U&'\062E\0644\0627\0644 \0634\0647\0631\064A\0646', U&'\0645\0635\0631', U&'\0644\062F\064A\0646\0627 \0645\062F\0631\0633\0629 \062E\0627\0635\0629 \0641\064A \0627\0644\0625\0633\0643\0646\062F\0631\064A\0629. \0623\0648\0644\064A\0627\0621 \0627\0644\0623\0645\0648\0631 \064A\0633\0623\0644\0648\0646 \0639\0646 \0627\0644\0645\0635\0631\0648\0641\0627\062A \0648\0627\0644\0645\0648\0627\0639\064A\062F \0639\0628\0631 \0627\0644\0647\0627\062A\0641 \0637\0648\0627\0644 \0627\0644\0648\0642\062A. \0646\0631\064A\062F \0645\0648\0642\0639\064B\0627 \064A\0639\0631\0636 \0645\0639\0644\0648\0645\0627\062A \0627\0644\0645\062F\0631\0633\0629 \0648\064A\062A\064A\062D \0627\0644\062A\0642\062F\064A\0645 \0623\0648\0646\0644\0627\064A\0646.', true, now()),
  ('11111111-0000-4000-8000-000000000003', 'Synthetic Restaurant', 'food@example.com', null, null, 'en', null, null, null, null, 'An app for my restaurant.', true, now()),
  -- ar: "Synthetic crafts platform"; country "Jordan"; budget and timeline as stored codes (the clinic keeps an older form's English labels)
  -- ar brief: a platform linking craftspeople and customers; unsure whether to start with an app or a website; some craftspeople do not use smartphones.
  ('11111111-0000-4000-8000-000000000004', U&'\0645\0646\0635\0629 \062D\0631\0641\064A\064A\0646 \062A\062C\0631\064A\0628\064A\0629', 'crafts@example.com', null, null, 'ar', 'not_sure', '5000_10000', 'asap', U&'\0627\0644\0623\0631\062F\0646', U&'\0641\0643\0631\062A\0646\0627 \0645\0646\0635\0629 \062A\0631\0628\0637 \0627\0644\062D\0631\0641\064A\064A\0646 \0628\0627\0644\0639\0645\0644\0627\0621\060C \0644\0643\0646 \0644\0633\0646\0627 \0645\062A\0623\0643\062F\064A\0646 \0647\0644 \0646\0628\062F\0623 \0628\062A\0637\0628\064A\0642 \0623\0648 \0628\0645\0648\0642\0639. \0628\0639\0636 \0627\0644\062D\0631\0641\064A\064A\0646 \0644\0627 \064A\0633\062A\062E\062F\0645\0648\0646 \0627\0644\0647\0648\0627\062A\0641 \0627\0644\0630\0643\064A\0629.', true, now())
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  company_name = excluded.company_name,
  company_url = excluded.company_url,
  preferred_language = excluded.preferred_language,
  project_type = excluded.project_type,
  budget_range = excluded.budget_range,
  timeline = excluded.timeline,
  country = excluded.country,
  project_description = excluded.project_description;

-- One is already booked, through the real booking function.
select public.apply_booking_created('11111111-0000-4000-8000-000000000002', 'synthetic-seed-booking', now() + interval '4 days', 'Africa/Cairo', now())
where not exists (select 1 from public.project_inquiries where id = '11111111-0000-4000-8000-000000000002' and booking_status = 'booked');
