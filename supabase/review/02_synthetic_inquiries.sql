-- SYNTHETIC REVIEW DATABASE ONLY. Never apply to the live (production) database.
--
-- Invented inquiries for reviewing the admin application, in English and
-- Arabic. Used by the local demo (scripts/dashboard-demo.mjs) and by the
-- isolated review project. Safe to re-run: existing rows are left alone.

insert into public.project_inquiries (id, full_name, email, preferred_language, project_type, budget_range, timeline, country, project_description, consent_given, consent_at)
values
  ('11111111-0000-4000-8000-000000000001', 'Synthetic Clinic Group', 'clinic@example.com', 'en', 'web_app', 'Not sure yet', 'Within 3 months', 'Egypt',
   'We run three physiotherapy clinics in Cairo. Patients book by phone and we lose track of cancellations. We want an online booking system where patients pick a therapist and time, and our receptionists see the day''s schedule. We already use Google Sheets for schedules.', true, now()),
  ('11111111-0000-4000-8000-000000000002', 'مدرسة تجريبية', 'school@example.com', 'ar', 'website', 'غير محدد', 'خلال شهرين', 'مصر',
   'لدينا مدرسة خاصة في الإسكندرية. أولياء الأمور يسألون عن المصروفات والمواعيد عبر الهاتف طوال الوقت. نريد موقعًا يعرض معلومات المدرسة ويتيح التقديم أونلاين.', true, now()),
  ('11111111-0000-4000-8000-000000000003', 'Synthetic Restaurant', 'food@example.com', 'en', 'mobile_app', null, null, null, 'An app for my restaurant.', true, now()),
  ('11111111-0000-4000-8000-000000000004', 'منصة حرفيين تجريبية', 'crafts@example.com', 'ar', 'other', null, null, 'الأردن',
   'فكرتنا منصة تربط الحرفيين بالعملاء، لكن لسنا متأكدين هل نبدأ بتطبيق أو بموقع. بعض الحرفيين لا يستخدمون الهواتف الذكية.', true, now())
on conflict (id) do nothing;

-- One is already booked, through the real booking function.
select public.apply_booking_created('11111111-0000-4000-8000-000000000002', 'synthetic-seed-booking', now() + interval '4 days', 'Africa/Cairo', now())
where not exists (select 1 from public.project_inquiries where id = '11111111-0000-4000-8000-000000000002' and booking_status = 'booked');
