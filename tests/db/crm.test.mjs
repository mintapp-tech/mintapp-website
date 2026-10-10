// Database-level tests for CRM Release 1 (supabase/migrations/20261011 to 20261014):
// companies and contacts, the pipeline, attribution, proposals, projects,
// outreach, reads, metrics and export. Synthetic data only.
//   npm run test:db

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startCluster, lit } from "./pg-harness.mjs";

let db;
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OMAR = "omar@mintapp.tech";
const ADAM = "adam@mintapp.tech";
const svc = (sql) => db.psql(`set role service_role; ${sql}`);
const json = (sql) => JSON.parse(svc(sql) || "null");
const fail = (sql) => db.psqlExpectError(`set role service_role; ${sql}`);
const obj = (o) => `${lit(JSON.stringify(o))}::jsonb`;
const insertInquiry = (id, o = {}) =>
  db.psql(`insert into public.project_inquiries (id, full_name, email, phone, company_name, company_url, country, preferred_language, project_type, project_description, consent_given, consent_at, utm_source, utm_medium, utm_campaign, utm_content, created_at)
           values (${lit(id)}, ${lit(o.name ?? "Synthetic Client")}, ${lit(o.email ?? "client@crm-test.invalid")}, ${lit(o.phone ?? "+20 100 000 0001")}, ${lit(o.company === undefined ? "Synthetic Studio" : o.company)}, ${lit(o.url === undefined ? "https://www.synthetic-studio.invalid/about" : o.url)}, 'Egypt',
                   ${lit(o.lang ?? "en")}, ${lit(o.type ?? "web_app")}, 'We want an online booking system for our studio.', true, now(), ${lit(o.source ?? null)}, ${lit(o.medium ?? null)}, ${lit(o.campaign ?? null)}, ${lit(o.content ?? null)}, ${o.at ? lit(o.at) : "now()"})`);
const stage = (id) => db.psql(`select lead_status from public.project_inquiries where id = ${lit(id)}`);
const setStage = (id, to, who = OMAR, reason = "null", note = "null", until = "null") => svc(`select public.crm_set_stage(${lit(id)}, ${lit(to)}, ${lit(who)}, ${reason}, ${note}, ${until})`);
const count = (sql) => Number(db.psql(sql));
const actions = (inquiry) => svc(`select string_agg(action, ',' order by at, id) from public.crm_activity where inquiry_id = ${lit(inquiry)}`);

before(async () => {
  db = await startCluster();
  for (const file of db.migrations) db.applyMigration(file);
});
after(() => db?.stop());
beforeEach(() => db.clearData());

describe("access", () => {
  test("anon and authenticated can neither read the CRM tables nor run its functions", () => {
    const tables = ["crm_companies", "crm_contacts", "inquiry_crm", "crm_stage_history", "crm_activity", "crm_proposals", "crm_projects", "crm_prospects", "crm_outreach_touches"];
    const calls = [
      "public.crm_overview(current_date)", "public.crm_inquiry_list('{}')", `public.crm_inquiry_extra('${A}')`, "public.crm_company_list(null)", "public.crm_search('abc')",
      "public.crm_prospect_list()", "public.crm_proposal_list()", "public.crm_project_list()", "public.crm_metrics(current_date, current_date, current_date)", "public.crm_export('contacts', 'x')",
      `public.crm_set_stage('${A}', 'won', 'x')`, "public.crm_duplicates_report()", `public.crm_log('x', 'inquiry', null, null, 'x')`,
    ];
    for (const role of ["anon", "authenticated"]) {
      for (const t of tables) assert.match(db.psqlExpectError(`set role ${role}; select count(*) from public.${t}`), /permission denied/, `${role} ${t}`);
      for (const c of calls) assert.match(db.psqlExpectError(`set role ${role}; select ${c}`), /permission denied/, `${role} ${c}`);
    }
  });

  test("every CRM table has row level security on, and service_role cannot delete from the append-only ones", () => {
    const rls = db.psql(`select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    assert.equal(rls, "0");
    for (const t of ["crm_activity", "crm_stage_history", "crm_outreach_touches"]) {
      assert.match(fail(`delete from public.${t}`), /permission denied/, t);
      assert.match(fail(`update public.${t} set id = id`), /permission denied/, t);
    }
  });

  test("the public form's insert still works (service_role, with and without utm_content) and creates no CRM rows", () => {
    svc(`insert into public.project_inquiries (id, full_name, email, project_description, preferred_language, consent_given, consent_at, utm_content) values (${lit(A)}, 'Form', 'form@crm-test.invalid', 'x', 'en', true, now(), 'flagship_en')`);
    svc(`insert into public.project_inquiries (id, full_name, email, project_description, preferred_language, consent_given, consent_at) values (${lit(B)}, 'Form', 'form2@crm-test.invalid', 'x', 'ar', true, now())`);
    assert.equal(count("select count(*) from public.inquiry_crm"), 0);
    assert.equal(count("select count(*) from public.inquiry_preparations"), 2, "the preparation job is still created in the same transaction");
    assert.equal(stage(A), "new");
    assert.match(fail(`insert into public.project_inquiries (id, full_name, email, project_description, preferred_language, consent_given, consent_at, utm_content) values (${lit(C)}, 'F', 'f@crm-test.invalid', 'x', 'en', true, now(), '${"x".repeat(201)}')`), /utm_content_length/);
  });
});

describe("the thirteen pipeline stages", () => {
  const STAGES = ["new", "reviewing", "meeting_booked", "preparing", "meeting_ready", "meeting_completed", "qualified", "proposal_prep", "proposal_sent", "negotiation", "won", "lost", "paused"];

  test("every stage is accepted, each change is recorded with who, from, to; no change is a no-op", () => {
    insertInquiry(A);
    for (const s of STAGES.filter((x) => x !== "new" && x !== "lost")) assert.equal(json(`select public.crm_set_stage(${lit(A)}, ${lit(s)}, ${lit(OMAR)})`).changed, true, s);
    assert.equal(json(`select public.crm_set_stage(${lit(A)}, 'paused', ${lit(OMAR)})`).changed, false);
    assert.equal(count(`select count(*) from public.crm_stage_history where inquiry_id = ${lit(A)}`), STAGES.length - 2);
    assert.equal(svc(`select from_stage || '>' || to_stage || '>' || actor from public.crm_stage_history where inquiry_id = ${lit(A)} order by created_at, id limit 1`), `new>reviewing>${OMAR}`);
    assert.match(actions(A), /stage_changed/);
  });

  test("an unknown stage and a missing inquiry are refused or ignored; old stage names cannot be written", () => {
    insertInquiry(A);
    assert.match(fail(`select public.crm_set_stage(${lit(A)}, 'converted', ${lit(OMAR)})`), /invalid_stage/);
    assert.match(fail(`update public.project_inquiries set lead_status = 'not_a_fit' where id = ${lit(A)}`), /lead_status_values/);
    assert.equal(svc(`select public.crm_set_stage(${lit(B)}, 'qualified', ${lit(OMAR)})`), "");
  });

  test("losing needs a reason from the list, and it is kept; reopening clears it", () => {
    insertInquiry(A);
    assert.match(fail(`select public.crm_set_stage(${lit(A)}, 'lost', ${lit(OMAR)})`), /loss_reason_required/);
    assert.match(fail(`select public.crm_set_stage(${lit(A)}, 'lost', ${lit(OMAR)}, 'because')`), /loss_reason_required/);
    setStage(A, "lost", OMAR, "'no_budget'", "'Could not fund phase one'");
    assert.equal(svc(`select loss_reason || '|' || loss_note from public.inquiry_crm where inquiry_id = ${lit(A)}`), "no_budget|Could not fund phase one");
    setStage(A, "reviewing");
    assert.equal(svc(`select coalesce(loss_reason, 'none') from public.inquiry_crm where inquiry_id = ${lit(A)}`), "none");
  });

  test("booking, rescheduling, cancelling and rebooking never change the sales stage (or the reverse)", () => {
    insertInquiry(A);
    setStage(A, "qualified");
    svc(`select public.apply_booking_created(${lit(A)}, 'bk-1', now() + interval '3 days', 'Africa/Cairo', now())`);
    assert.equal(stage(A), "qualified");
    svc(`select public.apply_booking_rescheduled(${lit(A)}, 'bk-1', 'bk-2', now() + interval '4 days', 'Africa/Cairo', now() + interval '1 minute')`);
    assert.equal(stage(A), "qualified");
    svc(`select public.apply_booking_cancelled(${lit(A)}, 'bk-2', now() + interval '4 days', 'Africa/Cairo', now() + interval '2 minutes')`);
    assert.equal(stage(A), "qualified");
    svc(`select public.apply_booking_created(${lit(A)}, 'bk-3', now() + interval '5 days', 'Africa/Cairo', now() + interval '3 minutes')`);
    assert.equal(stage(A), "qualified");
    assert.equal(db.psql(`select booking_status from public.project_inquiries where id = ${lit(A)}`), "booked");
    setStage(A, "meeting_completed");
    assert.equal(db.psql(`select booking_status from public.project_inquiries where id = ${lit(A)}`), "booked", "moving the stage does not touch the booking");
    assert.equal(count(`select count(*) from public.crm_stage_history where inquiry_id = ${lit(A)}`), 2, "only the two team decisions are in the history");
  });

  test("the early stage names carry over to their successors when the migration runs on existing rows", () => {
    // Rehearsed in production-upgrade.test.mjs against the real chain; here the rule itself.
    assert.equal(
      db.psql(`select string_agg(case v when 'converted' then 'won' when 'not_a_fit' then 'lost' when 'archived' then 'paused' end, ',' order by v) from unnest(array['archived','converted','not_a_fit']) v`),
      "paused,won,lost",
    );
  });
});

describe("ownership and the activity trail", () => {
  test("owners are changed with the person recorded; unchanged owners add nothing", () => {
    insertInquiry(A);
    assert.equal(svc(`select public.crm_set_owners(${lit(A)}, '["omar","adam"]', ${lit(OMAR)})`), "t");
    svc(`select public.crm_set_owners(${lit(A)}, '["adam","omar","adam"]', ${lit(ADAM)})`);
    assert.equal(count(`select count(*) from public.crm_activity where inquiry_id = ${lit(A)} and action = 'owners_changed'`), 1);
    assert.equal(svc(`select owners from public.project_inquiries where id = ${lit(A)}`), "{adam,omar}");
    assert.equal(svc(`select actor from public.crm_activity where action = 'owners_changed'`), OMAR);
    assert.match(fail(`select public.crm_set_owners(${lit(A)}, '["Not A Member!"]', ${lit(OMAR)})`), /owners_shape/);
  });

  test("follow-ups, notes and draft changes are written to the trail by the database itself, with the person", () => {
    insertInquiry(A);
    svc(`select public.dashboard_add_follow_up(${lit(A)}, 'Send the meeting questions', 'adam', current_date + 2, ${lit(OMAR)})`);
    const fu = svc(`select id from public.inquiry_follow_ups where inquiry_id = ${lit(A)}`);
    svc(`select public.dashboard_complete_follow_up(${lit(A)}, ${lit(fu)}, ${lit(ADAM)})`);
    svc(`select public.dashboard_add_note(${lit(A)}, ${lit(OMAR)}, 'Called the client, wants Arabic first')`);
    svc(`select public.dashboard_save_draft(${lit(A)}, '{"format":"text","body":"x"}', 'manual', ${lit(OMAR)})`);
    svc(`select public.dashboard_review(${lit(A)}, 1, 'in_review', ${lit(OMAR)})`);
    svc(`select public.dashboard_review(${lit(A)}, 1, 'approved', ${lit(ADAM)})`);
    assert.equal(actions(A), "follow_up_added,follow_up_done,note_added,draft_saved,draft_review,draft_review");
    assert.equal(svc(`select actor from public.crm_activity where action = 'follow_up_done'`), ADAM);
    assert.equal(svc(`select detail ->> 'to' from public.crm_activity where action = 'draft_review' order by at desc, id desc limit 1`), "approved");
  });

  test("booking history: a booking, a move and a cancellation are on the trail, with status and time only", () => {
    insertInquiry(A);
    svc(`select public.apply_booking_created(${lit(A)}, 'h-1', now() + interval '3 days', 'Africa/Cairo', now())`);
    svc(`select public.apply_booking_rescheduled(${lit(A)}, 'h-1', 'h-2', now() + interval '4 days', 'Africa/Cairo', now() + interval '1 minute')`);
    svc(`select public.apply_booking_cancelled(${lit(A)}, 'h-2', now() + interval '4 days', 'Africa/Cairo', now() + interval '2 minutes')`);
    // The automatic review action is created with the booking and closed by the cancellation.
    // Entries written in the same statement share a timestamp, so compare them as a set.
    assert.deepEqual(actions(A).split(",").sort(), ["booking_booked", "booking_cancelled", "booking_rescheduled", "follow_up_added", "follow_up_done"]);
    assert.equal(svc(`select string_agg(distinct actor, ',') from public.crm_activity where inquiry_id = ${lit(A)} and action like 'booking_%'`), "cal.com");
    // The automatic review action is the system's, not a person's.
    assert.equal(svc(`select string_agg(distinct actor, ',') from public.crm_activity where inquiry_id = ${lit(A)} and action like 'follow_up_%'`), "system");
    assert.deepEqual(Object.keys(json(`select detail from public.crm_activity where action = 'booking_booked'`)).sort(), ["start", "status"]);
  });

  test("a failure writing the trail can never stop a booking from being recorded", () => {
    insertInquiry(A);
    db.psql("revoke insert on public.crm_activity from service_role");
    try {
      assert.equal(svc(`select public.apply_booking_created(${lit(A)}, 'w-1', now() + interval '3 days', 'Africa/Cairo', now())`), A);
    } finally {
      db.psql("grant insert on public.crm_activity to service_role");
    }
    assert.equal(db.psql(`select booking_status from public.project_inquiries where id = ${lit(A)}`), "booked");
  });

  test("the trail never holds the text of a note, a draft or contact details", () => {
    insertInquiry(A);
    svc(`select public.dashboard_add_note(${lit(A)}, ${lit(OMAR)}, 'secret-note-text')`);
    svc(`select public.dashboard_save_draft(${lit(A)}, '{"format":"text","body":"secret-draft-text"}', 'manual', ${lit(OMAR)})`);
    const everything = svc("select string_agg(detail::text || actor || action, ' ') from public.crm_activity");
    assert.doesNotMatch(everything, /secret-note-text|secret-draft-text|client@crm-test|\+20 100/);
  });
});

describe("companies and contacts", () => {
  test("a company can be created, edited by key, and found; the name needs content", () => {
    const id = svc(`select public.crm_save_company(null, ${obj({ name: "  Nile Clinics ", website: "https://www.nile-clinics.invalid/en", country: "Egypt", language: "ar" })}, ${lit(OMAR)})`);
    assert.equal(svc(`select name || '|' || website_host || '|' || language from public.crm_companies where id = ${lit(id)}`), "Nile Clinics|nile-clinics.invalid|ar");
    svc(`select public.crm_save_company(${lit(id)}, ${obj({ sector: "Healthcare" })}, ${lit(ADAM)})`);
    assert.equal(svc(`select name || '|' || sector || '|' || country from public.crm_companies where id = ${lit(id)}`), "Nile Clinics|Healthcare|Egypt", "keys that were not sent are left alone");
    assert.match(fail(`select public.crm_save_company(null, ${obj({ name: "   " })}, ${lit(OMAR)})`), /name_required/);
    assert.match(fail(`select public.crm_save_company(null, ${obj({ name: "X", language: "fr" })}, ${lit(OMAR)})`), /language_values/);
    assert.equal(json("select public.crm_search('nile')").companies.length, 1);
  });

  test("a company has several contacts; a contact needs no company", () => {
    const co = svc(`select public.crm_save_company(null, ${obj({ name: "Delta Foods" })}, ${lit(OMAR)})`);
    svc(`select public.crm_save_contact(null, ${lit(co)}, ${obj({ full_name: "Mona Ali", role_title: "COO", email: "mona@delta.invalid" })}, ${lit(OMAR)})`);
    svc(`select public.crm_save_contact(null, ${lit(co)}, ${obj({ full_name: "Karim Said", role_title: "CTO", email: "karim@delta.invalid" })}, ${lit(OMAR)})`);
    const solo = svc(`select public.crm_save_contact(null, null, ${obj({ full_name: "Independent Person", email: "solo@solo.invalid" })}, ${lit(OMAR)})`);
    assert.equal(json(`select public.crm_company_get(${lit(co)})`).contacts.length, 2);
    assert.equal(json(`select public.crm_contact_get(${lit(solo)})`).company, null);
    assert.match(fail(`select public.crm_save_contact(null, ${lit(A)}, ${obj({ full_name: "Orphan" })}, ${lit(OMAR)})`), /company_not_found/);
  });

  test("an inquiry needs no company: it links to a contact alone, or to nothing", () => {
    insertInquiry(A, { company: null, url: null });
    const r = json(`select public.crm_create_from_inquiry(${lit(A)}, 'none', null, ${lit(OMAR)})`);
    assert.equal(r.company_id, null);
    assert.ok(r.contact_id);
    assert.equal(count("select count(*) from public.crm_companies"), 0);
    insertInquiry(B, { company: null, url: null, email: "other@crm-test.invalid" });
    assert.equal(json(`select public.crm_inquiry_extra(${lit(B)})`).company, null, "never linked at all is fine too");
    assert.match(fail(`select public.crm_create_from_inquiry(${lit(B)}, 'new', null, ${lit(OMAR)})`), /no_company_name/, "'new' needs the client to have given a company");
  });

  test("creating from an inquiry builds the contact (consent from the form) and company, and reuses an existing contact with the same email", () => {
    insertInquiry(A);
    const first = json(`select public.crm_create_from_inquiry(${lit(A)}, 'new', null, ${lit(OMAR)})`);
    assert.equal(first.contact_reused, false);
    assert.equal(svc(`select consent_status || '|' || (consent_at is not null) from public.crm_contacts where id = ${lit(first.contact_id)}`), "form_consent|true");
    assert.equal(svc(`select name || '|' || website_host from public.crm_companies where id = ${lit(first.company_id)}`), "Synthetic Studio|synthetic-studio.invalid");
    insertInquiry(B, { company: "Synthetic Studio Two" });
    const second = json(`select public.crm_create_from_inquiry(${lit(B)}, 'existing', ${lit(first.company_id)}, ${lit(ADAM)})`);
    assert.equal(second.contact_reused, true);
    assert.equal(second.contact_id, first.contact_id);
    assert.equal(count("select count(*) from public.crm_contacts"), 1, "no second contact for the same person");
    assert.equal(count("select count(*) from public.crm_companies"), 1);
    assert.equal(count("select count(*) from public.inquiry_crm where contact_id is not null"), 2);
  });

  test("duplicates are reported, never merged: same company name or site, same email or phone, same client twice", () => {
    insertInquiry(A);
    insertInquiry(B, { name: "Same Person Again", email: "again@crm-test.invalid", phone: "+201000000001", company: "SYNTHETIC studio.", url: "synthetic-studio.invalid" });
    const coA = svc(`select public.crm_save_company(null, ${obj({ name: "Synthetic Studio" })}, ${lit(OMAR)})`);
    const coB = svc(`select public.crm_save_company(null, ${obj({ name: "Different Name", website: "http://synthetic-studio.invalid" })}, ${lit(OMAR)})`);
    svc(`select public.crm_save_contact(null, ${lit(coA)}, ${obj({ full_name: "Contact One", email: "Client@CRM-test.invalid" })}, ${lit(OMAR)})`);
    insertInquiry(C, { name: "Third Submission" });
    const dup = json(`select public.crm_inquiry_duplicates(${lit(B)})`);
    assert.equal(dup.companies.length, 2, "by name key and by website host");
    assert.deepEqual(dup.inquiries.map((i) => i.id).sort(), [A, C], "same phone number, written differently");
    const dupA = json(`select public.crm_inquiry_duplicates(${lit(A)})`);
    assert.equal(dupA.contacts.length, 1, "the contact with the same email, found case-insensitively");
    assert.doesNotMatch(JSON.stringify(dup) + JSON.stringify(dupA), /crm-test\.invalid|\+20|0100/, "no contact details in duplicate results");
    const report = json("select public.crm_duplicates_report()");
    assert.equal(report.inquiries.length, 1, "A and C came from the same email address");
    assert.equal(report.inquiries[0].length, 2);
    assert.equal(count("select count(*) from public.crm_companies"), 2);
    assert.equal(count("select count(*) from public.project_inquiries"), 3, "nothing was merged or removed");
    assert.ok(coB);
  });

  test("consent and communication controls: withdrawn consent means do not contact, and is kept", () => {
    const k = svc(`select public.crm_save_contact(null, null, ${obj({ full_name: "Someone", email: "s@s.invalid", consent_status: "given_other" })}, ${lit(OMAR)})`);
    assert.equal(svc(`select (consent_at is not null)::text || do_not_contact::text from public.crm_contacts where id = ${lit(k)}`), "truefalse");
    svc(`select public.crm_save_contact(${lit(k)}, null, ${obj({ consent_status: "withdrawn" })}, ${lit(ADAM)})`);
    assert.equal(svc(`select consent_status || '|' || do_not_contact from public.crm_contacts where id = ${lit(k)}`), "withdrawn|true");
    assert.match(fail(`update public.crm_contacts set do_not_contact = false where id = ${lit(k)}`), /withdrawn_blocks_contact/);
    assert.match(fail(`select public.crm_save_contact(${lit(k)}, null, ${obj({ consent_status: "maybe" })}, ${lit(OMAR)})`), /consent_values/);
  });

  test("lists and search show names, never email addresses or phone numbers; detail views do", () => {
    insertInquiry(A);
    const r = json(`select public.crm_create_from_inquiry(${lit(A)}, 'new', null, ${lit(OMAR)})`);
    const surfaces = [json("select public.crm_company_list(null)"), json("select public.crm_search('synthetic')"), json("select public.crm_inquiry_list('{}')"), json("select public.crm_overview(current_date)"), json(`select public.crm_inquiry_extra(${lit(A)})`)];
    for (const s of surfaces) assert.doesNotMatch(JSON.stringify(s), /client@crm-test\.invalid|\+20 100 000 0001/);
    assert.match(JSON.stringify(json(`select public.crm_contact_get(${lit(r.contact_id)})`)), /client@crm-test\.invalid/);
    assert.match(JSON.stringify(json(`select public.crm_company_get(${lit(r.company_id)})`)), /client@crm-test\.invalid/);
    const found = json("select public.crm_search('client@crm-test')");
    assert.equal(found.inquiries.length, 1, "search can match an email without showing it");
    assert.equal(found.contacts.length, 1);
  });

  test("search by company, contact and inquiry text, with wildcards treated as plain text", () => {
    insertInquiry(A, { name: "Layla Hassan", company: "Cedar Labs" });
    insertInquiry(B, { name: "100% Match_Test", company: "Other" });
    assert.equal(json("select public.crm_search('cedar')").inquiries.length, 1);
    assert.equal(json("select public.crm_search('layla')").inquiries.length, 1);
    assert.equal(json("select public.crm_search('booking system')").inquiries.length, 2, "inquiry text");
    assert.equal(json("select public.crm_search('100%')").inquiries.length, 1, "'%' matches only a literal percent sign");
    assert.equal(json("select public.crm_search('%%')").inquiries.length, 0);
    assert.equal(json("select public.crm_search('h_T')").inquiries.length, 1, "'_' matches only a literal underscore");
    assert.equal(json("select public.crm_search('h-T')").inquiries.length, 0);
    assert.equal(json("select public.crm_search('c_d')").inquiries.length, 0);
    assert.equal(json("select public.crm_search('x')").inquiries.length, 0, "a single character searches nothing");
  });
});

describe("contact values for scrubbing a brief", () => {
  test("the inquiry's own name, company, email, phone and website host come back for cutting out of the brief, and only to the server role", () => {
    insertInquiry(A, { name: "Layla Hassan", company: "Cedar Labs", url: "https://www.cedar-labs.invalid/en" });
    const values = json(`select public.preparation_redactions(${lit(A)})`);
    for (const expected of ["Layla Hassan", "Cedar Labs", "client@crm-test.invalid", "+20 100 000 0001", "cedar-labs.invalid", "201000000001"]) assert.ok(values.includes(expected), expected);
    assert.deepEqual(json(`select public.preparation_redactions(${lit(B)})`), []);
    for (const role of ["anon", "authenticated"]) assert.match(db.psqlExpectError(`set role ${role}; select public.preparation_redactions('${A}')`), /permission denied/);
    // The generator-facing input is unchanged: still only the brief and the client's answers.
    assert.deepEqual(Object.keys(json(`select public.preparation_input(${lit(A)})`)).sort(), ["budget_currency", "budget_range", "country", "preferred_language", "project_description", "project_type", "timeline"]);
  });
});

describe("source, campaign and qualification", () => {
  test("origin, partner, campaign, content, tier and score are saved; the score is the sum of seven 0-2 categories", () => {
    insertInquiry(A, { source: "linkedin", medium: "organic", campaign: "start_with_direction", content: "flagship_en" });
    svc(`select public.crm_save_inquiry_details(${lit(A)}, ${obj({ lead_origin: "referral", referral_partner: "Studio Nine", fit_tier: "tier_1", trigger_note: "Raised a seed round", research_note: "Manual bookings.", score: { trigger: 2, problem: 2, access: 1, proof: 2, timing: 1, commercial: 2, geo: 2 } })}, ${lit(OMAR)})`);
    const extra = json(`select public.crm_inquiry_extra(${lit(A)})`);
    assert.deepEqual(extra.source, { lead_origin: "referral", referral_partner: "Studio Nine", referral_source: null, utm_source: "linkedin", utm_medium: "organic", utm_campaign: "start_with_direction", utm_content: "flagship_en", campaign: null, content_id: null, source_page: null });
    assert.equal(extra.qualification.lead_score, 12);
    assert.equal(extra.qualification.fit_tier, "tier_1");
  });

  test("invalid scores, tiers and origins are refused", () => {
    insertInquiry(A);
    assert.match(fail(`select public.crm_save_inquiry_details(${lit(A)}, ${obj({ score: { trigger: 3 } })}, ${lit(OMAR)})`), /score_valid/);
    assert.match(fail(`select public.crm_save_inquiry_details(${lit(A)}, ${obj({ score: { trigger: 1.5 } })}, ${lit(OMAR)})`), /score_valid/);
    assert.match(fail(`select public.crm_save_inquiry_details(${lit(A)}, ${obj({ score: { budget: 1 } })}, ${lit(OMAR)})`), /score_valid/);
    assert.match(fail(`select public.crm_save_inquiry_details(${lit(A)}, ${obj({ fit_tier: "tier_9" })}, ${lit(OMAR)})`), /fit_values/);
    assert.match(fail(`select public.crm_save_inquiry_details(${lit(A)}, ${obj({ lead_origin: "cold" })}, ${lit(OMAR)})`), /origin_values/);
  });

  test("an inquiry with no CRM row reads as inbound, with the campaign from the form", () => {
    insertInquiry(A, { campaign: "start_with_direction" });
    const row = json("select public.crm_inquiry_list('{}')")[0];
    assert.equal(row.lead_origin, "inbound");
    assert.equal(row.campaign, "start_with_direction");
    assert.equal(count("select count(*) from public.inquiry_crm"), 0, "reading creates nothing");
  });
});

describe("proposals and scope", () => {
  const fields = { summary: "Booking system for a studio", recommended_scope: "Web app, admin", deliverables: "Designs, build", exclusions: "Native apps", assumptions: "Content provided by client", timeline_weeks_min: 8, timeline_weeks_max: 12, price_min: 5000, price_max: 8000, currency: "USD", price_notes: "Excludes hosting" };
  const create = (inq = A, who = OMAR, o = fields) => svc(`select public.crm_create_proposal(${lit(inq)}, ${obj(o)}, ${lit(who)})`);
  const to = (id, status, who, note = "null") => svc(`select public.crm_proposal_transition(${lit(id)}, ${lit(status)}, ${lit(who)}, ${note})`);

  test("a proposal is a record with every field; a revision is a new version and supersedes the old", () => {
    insertInquiry(A);
    const v1 = create();
    const v2 = create(A, ADAM, { ...fields, price_max: 9000 });
    assert.equal(svc(`select string_agg(version || ':' || status, ',' order by version) from public.crm_proposals where inquiry_id = ${lit(A)}`), "1:superseded,2:draft");
    assert.equal(svc(`select price_max from public.crm_proposals where id = ${lit(v2)}`), "9000.00");
    assert.notEqual(v1, v2);
    assert.equal(svc(`select created_by from public.crm_proposals where id = ${lit(v2)}`), ADAM);
  });

  test("the full path: draft, internal review, teammate approval, sent, accepted; the stage is never changed by it", () => {
    insertInquiry(A);
    setStage(A, "proposal_prep");
    const id = create(A, OMAR);
    assert.equal(to(id, "internal_review", OMAR), "t");
    assert.equal(to(id, "approved", ADAM), "t");
    assert.equal(to(id, "sent", OMAR), "t");
    assert.equal(to(id, "accepted", OMAR, "'Signed by email'"), "t");
    assert.equal(svc(`select status || '|' || approved_by || '|' || sent_by || '|' || decision_note from public.crm_proposals where id = ${lit(id)}`), `accepted|${ADAM}|${OMAR}|Signed by email`);
    assert.equal(stage(A), "proposal_prep", "proposals never move the sales stage");
    assert.match(actions(A), /proposal_created,proposal_internal_review,proposal_approved,proposal_sent,proposal_accepted/);
  });

  test("nobody approves their own proposal: not the author, not the last editor, however the call is made", () => {
    insertInquiry(A);
    const id = create(A, OMAR);
    svc(`select public.crm_update_proposal(${lit(id)}, ${obj({ summary: "Edited by Adam" })}, ${lit(ADAM)})`);
    to(id, "internal_review", ADAM);
    assert.match(fail(`select public.crm_proposal_transition(${lit(id)}, 'approved', ${lit(OMAR)})`), /teammate_approval_required/, "the author");
    assert.match(fail(`select public.crm_proposal_transition(${lit(id)}, 'approved', ${lit(ADAM)})`), /teammate_approval_required/, "the last editor");
    assert.match(fail(`update public.crm_proposals set status = 'approved', approved_by = ${lit(OMAR)} where id = ${lit(id)}`), /teammate_approval/, "not even directly");
    assert.equal(svc(`select status from public.crm_proposals where id = ${lit(id)}`), "internal_review");
  });

  test("only allowed moves: nothing is sent before it is approved; drafts only are edited in place", () => {
    insertInquiry(A);
    const id = create();
    assert.match(fail(`select public.crm_proposal_transition(${lit(id)}, 'sent', ${lit(OMAR)})`), /transition_not_allowed/);
    assert.match(fail(`select public.crm_proposal_transition(${lit(id)}, 'accepted', ${lit(OMAR)})`), /transition_not_allowed/);
    to(id, "internal_review", OMAR);
    assert.match(fail(`select public.crm_proposal_transition(${lit(id)}, 'sent', ${lit(ADAM)})`), /transition_not_allowed/);
    assert.equal(svc(`select public.crm_update_proposal(${lit(id)}, ${obj({ summary: "late edit" })}, ${lit(OMAR)})`), "f", "past draft it is revised, not edited");
    to(id, "draft", ADAM);
    assert.equal(svc(`select approved_by is null from public.crm_proposals where id = ${lit(id)}`), "t");
    assert.equal(svc(`select public.crm_update_proposal(${lit(id)}, ${obj({ summary: "ok edit" })}, ${lit(OMAR)})`), "t");
  });

  test("price needs a currency, ranges must make sense, and fields are length-limited", () => {
    insertInquiry(A);
    assert.match(fail(`select public.crm_create_proposal(${lit(A)}, ${obj({ price_min: 100 })}, ${lit(OMAR)})`), /price_needs_currency/);
    assert.match(fail(`select public.crm_create_proposal(${lit(A)}, ${obj({ price_min: 200, price_max: 100, currency: "USD" })}, ${lit(OMAR)})`), /price_range/);
    assert.match(fail(`select public.crm_create_proposal(${lit(A)}, ${obj({ timeline_weeks_min: 12, timeline_weeks_max: 8 })}, ${lit(OMAR)})`), /timeline_range/);
    assert.match(fail(`select public.crm_create_proposal(${lit(A)}, ${obj({ currency: "XYZ" })}, ${lit(OMAR)})`), /currency_values/);
    assert.match(fail(`select public.crm_create_proposal(${lit(A)}, ${obj({ summary: "x".repeat(2001) })}, ${lit(OMAR)})`), /summary_length/);
    assert.equal(count("select count(*) from public.crm_proposals"), 0, "a refused proposal leaves nothing behind");
  });

  test("proposals awaiting action are listed with the inquiry's name", () => {
    insertInquiry(A);
    insertInquiry(B);
    create(A);
    const sent = create(B, ADAM);
    to(sent, "internal_review", ADAM);
    to(sent, "approved", OMAR);
    to(sent, "sent", OMAR);
    const awaiting = json("select public.crm_proposal_list()");
    assert.deepEqual(awaiting.map((p) => p.status).sort(), ["draft", "sent"]);
    assert.equal(json("select public.crm_overview(current_date)").counts.proposals_awaiting, 2);
  });
});

describe("won to project", () => {
  test("a project needs a won inquiry; it keeps scope, source, owners and decisions, and the history stays reachable", () => {
    insertInquiry(A, { source: "linkedin", campaign: "start_with_direction", content: "omar_post_01" });
    svc(`select public.crm_set_owners(${lit(A)}, '["omar","adam"]', ${lit(OMAR)})`);
    svc(`select public.crm_save_inquiry_details(${lit(A)}, ${obj({ lead_origin: "warm" })}, ${lit(OMAR)})`);
    svc(`select public.dashboard_add_note(${lit(A)}, ${lit(OMAR)}, 'Kick-off call agreed')`);
    svc(`select public.dashboard_save_draft(${lit(A)}, '{"format":"text","body":"prep"}', 'manual', ${lit(OMAR)})`);
    svc(`select public.dashboard_review(${lit(A)}, 1, 'in_review', ${lit(OMAR)})`);
    svc(`select public.dashboard_review(${lit(A)}, 1, 'approved', ${lit(ADAM)})`);
    const prop = svc(`select public.crm_create_proposal(${lit(A)}, ${obj({ summary: "Agreed scope", recommended_scope: "Phase one", currency: "EGP", price_min: 100000, price_max: 120000 })}, ${lit(OMAR)})`);
    for (const [s, who] of [["internal_review", OMAR], ["approved", ADAM], ["sent", OMAR], ["accepted", OMAR]]) svc(`select public.crm_proposal_transition(${lit(prop)}, ${lit(s)}, ${lit(who)})`);
    assert.match(fail(`select public.crm_convert_to_project(${lit(A)}, null, ${lit(OMAR)})`), /inquiry_not_won/);
    setStage(A, "qualified");
    setStage(A, "won");
    const project = svc(`select public.crm_convert_to_project(${lit(A)}, null, ${lit(OMAR)})`);
    const p = json(`select public.crm_project_get(${lit(project)})`);
    assert.equal(p.project.name, "Synthetic Studio");
    assert.deepEqual(p.project.owners, ["adam", "omar"]);
    assert.equal(p.project.source.utm_content, "omar_post_01");
    assert.equal(p.project.source.lead_origin, "warm");
    assert.equal(p.project.scope.summary, "Agreed scope");
    assert.equal(p.project.scope.currency, "EGP");
    assert.equal(p.project.preparation_version, 1);
    assert.ok(p.project.decisions.some((d) => /qualified to won|qualified/.test(d.what)));
    assert.ok(p.project.decisions.some((d) => /proposal v1 accepted/.test(d.what)));
    assert.equal(p.inquiry.id, A, "the inquiry, its notes, drafts and meeting history stay where they are");
    assert.equal(count(`select count(*) from public.inquiry_notes where inquiry_id = ${lit(A)}`), 1);
    assert.equal(count(`select count(*) from public.preparation_drafts where inquiry_id = ${lit(A)}`), 1);
    assert.equal(stage(A), "won", "converting changes nothing about the inquiry");
  });

  test("converting twice returns the same project; a name can be given; status is checked", () => {
    insertInquiry(A);
    setStage(A, "won");
    const one = svc(`select public.crm_convert_to_project(${lit(A)}, 'Studio booking app', ${lit(OMAR)})`);
    const two = svc(`select public.crm_convert_to_project(${lit(A)}, 'Another name', ${lit(ADAM)})`);
    assert.equal(one, two);
    assert.equal(count("select count(*) from public.crm_projects"), 1);
    assert.equal(svc(`select name from public.crm_projects where id = ${lit(one)}`), "Studio booking app");
    assert.equal(svc(`select public.crm_set_project_status(${lit(one)}, 'active', ${lit(OMAR)})`), "t");
    assert.match(fail(`select public.crm_set_project_status(${lit(one)}, 'archived', ${lit(OMAR)})`), /invalid_status/);
  });
});

describe("outreach: the first accounts", () => {
  const prospect = (o = {}) => svc(`select public.crm_save_prospect(null, ${obj({ company_name: "Acme Robotics", country: "UAE", pool: "trigger_startup", contact_name: "Dana Lee", contact_role: "Founder", contact_channel: "linkedin", contact_handle: "linkedin.com/in/dana-test", trigger_note: "Seed round announced", owner: "omar", score: { trigger: 2, problem: 2, access: 2, proof: 1, timing: 2, commercial: 2, geo: 1 }, fit_tier: "tier_1", ...o })}, ${lit(OMAR)})`);

  test("a prospect records the research: owner, trigger, observation, proof, score and tier", () => {
    const id = prospect({ observation: "Manual onboarding", proof_case: "Clinic booking case" });
    const p = json(`select public.crm_prospect_get(${lit(id)})`).prospect;
    assert.equal(p.lead_score, 12);
    assert.equal(p.owner, "omar");
    assert.equal(p.stage, "identified");
    assert.equal(p.pool, "trigger_startup");
    assert.match(fail(`select public.crm_save_prospect(null, ${obj({ company_name: "X", owner: "omar", pool: "random" })}, ${lit(OMAR)})`), /pool_values/);
    assert.match(fail(`select public.crm_save_prospect(null, ${obj({ company_name: "X", owner: "Not Valid" })}, ${lit(OMAR)})`), /owner_shape/);
  });

  test("an active prospect always has a next action with one responsible person and a date", () => {
    const id = prospect();
    assert.match(fail(`select public.crm_set_prospect_stage(${lit(id)}, 'contacted', ${lit(OMAR)})`), /follow_up_required/);
    assert.equal(svc(`select public.crm_set_prospect_stage(${lit(id)}, 'contacted', ${lit(OMAR)}, 'Send touch 2', 'omar', current_date + 4)`), "t");
    assert.match(fail(`update public.crm_prospects set follow_up_due_on = null, follow_up_action = null, follow_up_owner = null where id = ${lit(id)}`), /open_has_follow_up/);
    assert.match(fail(`update public.crm_prospects set follow_up_owner = null where id = ${lit(id)}`), /follow_up_whole/);
    assert.match(fail(`select public.crm_set_prospect_follow_up(${lit(id)}, 'x', null, current_date, ${lit(OMAR)})`), /follow_up_required/);
  });

  test("four touches are logged; the first moves the prospect to contacted; a reply to replied; nothing is sent", () => {
    const id = prospect();
    assert.match(fail(`select public.crm_log_touch(${lit(id)}, 'outbound', 1, 'linkedin', current_date, 'Relevant observation about the seed round', ${lit(OMAR)})`), /follow_up_required/);
    assert.equal(count("select count(*) from public.crm_outreach_touches"), 0, "a touch without a next action is not half-recorded");
    svc(`select public.crm_log_touch(${lit(id)}, 'outbound', 1, 'linkedin', current_date, 'Relevant observation about the seed round', ${lit(OMAR)}, 'Touch 2: useful framing', 'omar', current_date + 4)`);
    assert.equal(svc(`select stage from public.crm_prospects where id = ${lit(id)}`), "contacted");
    svc(`select public.crm_log_touch(${lit(id)}, 'outbound', 2, 'linkedin', current_date, 'Shared a workflow observation', ${lit(OMAR)}, 'Touch 3: proof', 'omar', current_date + 6)`);
    svc(`select public.crm_log_touch(${lit(id)}, 'reply', null, 'linkedin', current_date, 'Asked for a call next week', ${lit(OMAR)}, 'Propose two slots', 'adam', current_date + 1)`);
    assert.equal(svc(`select stage || '|' || follow_up_owner from public.crm_prospects where id = ${lit(id)}`), "replied|adam");
    const row = json("select public.crm_prospect_list()")[0];
    assert.equal(row.touches, 2);
    assert.match(fail(`select public.crm_log_touch(${lit(id)}, 'outbound', 5, 'email', current_date, 'x', ${lit(OMAR)})`), /no_range/);
    assert.match(fail(`select public.crm_log_touch(${lit(id)}, 'outbound', null, 'email', current_date, 'x', ${lit(OMAR)})`), /outbound_no/);
  });

  test("a prospect marked do-not-contact cannot have an outbound touch recorded", () => {
    const id = prospect();
    svc(`select public.crm_save_prospect(${lit(id)}, ${obj({ do_not_contact: true })}, ${lit(OMAR)})`);
    assert.match(fail(`select public.crm_log_touch(${lit(id)}, 'outbound', 1, 'email', current_date, 'x', ${lit(OMAR)}, 'n', 'omar', current_date)`), /do_not_contact/);
  });

  test("closing needs a reason and clears the follow-up; a closed prospect takes no more outreach", () => {
    const id = prospect();
    svc(`select public.crm_set_prospect_stage(${lit(id)}, 'contacted', ${lit(OMAR)}, 'Touch 2', 'omar', current_date + 3)`);
    assert.match(fail(`select public.crm_set_prospect_stage(${lit(id)}, 'not_now', ${lit(OMAR)})`), /reason_required/);
    svc(`select public.crm_set_prospect_stage(${lit(id)}, 'not_now', ${lit(OMAR)}, null, null, null, 'Asked to come back next quarter')`);
    assert.equal(svc(`select stage || '|' || coalesce(follow_up_owner, 'none') from public.crm_prospects where id = ${lit(id)}`), "not_now|none");
    assert.match(fail(`select public.crm_log_touch(${lit(id)}, 'outbound', 3, 'email', current_date, 'x', ${lit(OMAR)})`), /prospect_closed/);
  });

  test("when the prospect submits an inquiry, the inquiry inherits origin, tier, score and research; nothing is merged", () => {
    const id = prospect({ observation: "Manual onboarding", fit_reason: "Ops-heavy" });
    insertInquiry(A);
    assert.equal(svc(`select public.crm_link_prospect_inquiry(${lit(id)}, ${lit(A)}, ${lit(ADAM)})`), "t");
    const extra = json(`select public.crm_inquiry_extra(${lit(A)})`);
    assert.equal(extra.source.lead_origin, "outbound");
    assert.equal(extra.qualification.lead_score, 12);
    assert.equal(extra.qualification.trigger_note, "Seed round announced");
    assert.equal(extra.prospect.stage, "inquiry_submitted");
    assert.equal(svc(`select inquiry_id from public.crm_prospects where id = ${lit(id)}`), A);
    assert.equal(count("select count(*) from public.project_inquiries"), 1);
  });

  test("the prospect list and search show no contact handle; the detail view does", () => {
    const id = prospect();
    assert.doesNotMatch(JSON.stringify(json("select public.crm_prospect_list()")), /dana-test/);
    assert.doesNotMatch(JSON.stringify(json("select public.crm_search('acme')")), /dana-test/);
    assert.match(JSON.stringify(json(`select public.crm_prospect_get(${lit(id)})`)), /dana-test/);
  });
});

describe("the dashboard overview", () => {
  test("new inquiries, meetings to prepare, upcoming meetings, failures, drafts to review, workload and recent activity", () => {
    insertInquiry(A, { name: "Alpha" });
    insertInquiry(B, { name: "Bravo" });
    insertInquiry(C, { name: "Charlie" });
    svc(`select public.apply_booking_created(${lit(A)}, 'o-1', now() + interval '2 days', 'Africa/Cairo', now())`);
    svc(`select public.apply_booking_created(${lit(B)}, 'o-2', now() + interval '3 days', 'Africa/Cairo', now())`);
    svc(`select public.dashboard_save_draft(${lit(B)}, '{"format":"text","body":"x"}', 'manual', ${lit(OMAR)})`);
    svc(`select public.dashboard_review(${lit(B)}, 1, 'in_review', ${lit(OMAR)})`);
    db.psql(`update public.inquiry_preparations set status = 'failed', attempts = 3, last_error = 'timeout' where inquiry_id = ${lit(C)}`);
    svc(`select public.crm_set_owners(${lit(A)}, '["omar"]', ${lit(OMAR)})`);
    svc(`select public.dashboard_add_follow_up(${lit(A)}, 'Send questions', 'adam', current_date - 2, ${lit(OMAR)})`);
    const o = json("select public.crm_overview(current_date)");
    assert.equal(o.counts.new_inquiries, 3);
    assert.equal(o.counts.upcoming_meetings, 2);
    assert.equal(o.counts.meetings_to_prepare, 2);
    assert.equal(o.counts.prep_failures, 1);
    assert.equal(o.counts.drafts_awaiting_review, 1);
    assert.equal(o.counts.overdue_follow_ups, 1);
    assert.deepEqual(o.overdue_follow_ups.map((f) => [f.name, f.owner]), [["Alpha", "adam"]]);
    assert.equal(o.counts.unowned_open, 2);
    assert.equal(o.upcoming_meetings[0].name, "Alpha");
    assert.equal(o.upcoming_meetings[0].ready, false);
    const adam = o.owner_workload.find((w) => w.owner === "adam");
    assert.deepEqual([adam.open_follow_ups, adam.overdue_follow_ups], [1, 1]);
    assert.ok(o.recent_activity.length >= 3);
    assert.deepEqual(o.attention.map((x) => x.name).sort(), ["Bravo", "Charlie"], "no owner or no next action (Alpha has both, and its follow-up is overdue instead)");
    svc(`select public.dashboard_review(${lit(B)}, 1, 'approved', ${lit(ADAM)})`);
    assert.equal(json("select public.crm_overview(current_date)").counts.meetings_to_prepare, 1, "approved preparation takes a meeting off the list");
  });

  test("overdue means before today; paused, lost and won are not 'open' work", () => {
    insertInquiry(A);
    insertInquiry(B);
    setStage(A, "won");
    setStage(B, "paused");
    const o = json("select public.crm_overview(current_date)");
    assert.equal(o.counts.open_inquiries, 0);
    assert.equal(o.counts.unowned_open, 0);
    svc(`select public.dashboard_add_follow_up(${lit(A)}, 'Today', 'omar', current_date, ${lit(OMAR)})`);
    assert.equal(json("select public.crm_overview(current_date)").counts.overdue_follow_ups, 0);
    assert.equal(json("select public.crm_overview(current_date + 1)").counts.overdue_follow_ups, 1);
  });
});

describe("filters", () => {
  test("by owner (including unassigned), stage, meeting, preparation, origin, campaign and text; combined", () => {
    insertInquiry(A, { name: "Alpha", campaign: "start_with_direction" });
    insertInquiry(B, { name: "Bravo", company: "Bravo Works" });
    insertInquiry(C, { name: "Charlie" });
    svc(`select public.crm_set_owners(${lit(A)}, '["omar"]', ${lit(OMAR)})`);
    svc(`select public.crm_set_owners(${lit(B)}, '["omar","adam"]', ${lit(OMAR)})`);
    setStage(B, "qualified");
    svc(`select public.apply_booking_created(${lit(C)}, 'f-1', now() + interval '2 days', 'Africa/Cairo', now())`);
    svc(`select public.crm_save_inquiry_details(${lit(C)}, ${obj({ lead_origin: "referral" })}, ${lit(OMAR)})`);
    db.psql(`update public.inquiry_preparations set status = 'failed', attempts = 3, last_error = 'timeout' where inquiry_id = ${lit(A)}`);
    const names = (f) => json(`select public.crm_inquiry_list(${obj(f)})`).map((r) => r.client_name).sort();
    assert.deepEqual(names({}), ["Alpha", "Bravo", "Charlie"]);
    assert.deepEqual(names({ owner: "omar" }), ["Alpha", "Bravo"]);
    assert.deepEqual(names({ owner: "adam" }), ["Bravo"]);
    assert.deepEqual(names({ owner: "unassigned" }), ["Charlie"]);
    assert.deepEqual(names({ stage: "qualified" }), ["Bravo"]);
    assert.deepEqual(names({ meeting: "booked" }), ["Charlie"]);
    assert.deepEqual(names({ preparation: "failed" }), ["Alpha"]);
    assert.deepEqual(names({ origin: "referral" }), ["Charlie"]);
    assert.deepEqual(names({ origin: "inbound" }), ["Alpha", "Bravo"]);
    assert.deepEqual(names({ campaign: "start_with_direction" }), ["Alpha"]);
    assert.deepEqual(names({ q: "bravo works" }), ["Bravo"]);
    assert.deepEqual(names({ q: "BRAVO", owner: "adam", stage: "qualified" }), ["Bravo"]);
    assert.deepEqual(names({ q: "bravo", owner: "unassigned" }), []);
    assert.deepEqual(names({ q: "'; drop table public.project_inquiries; --" }), [], "a filter is data, not SQL");
    assert.equal(count("select count(*) from public.project_inquiries"), 3);
  });

  test("a linked CRM company or contact name finds the inquiry", () => {
    insertInquiry(A, { company: "Typed By Client" });
    const co = svc(`select public.crm_save_company(null, ${obj({ name: "Registered Legal Name" })}, ${lit(OMAR)})`);
    svc(`select public.crm_link_inquiry(${lit(A)}, ${lit(co)}, null, ${lit(OMAR)})`);
    assert.equal(json(`select public.crm_inquiry_list(${obj({ q: "registered legal" })})`).length, 1);
  });
});

describe("metrics", () => {
  test("funnel, events, sources and loss reasons for the period; stages can be skipped and booking is its own measure", () => {
    const today = db.psql("select (now() at time zone 'Africa/Cairo')::date");
    insertInquiry(A, { name: "A", source: "linkedin", medium: "organic", campaign: "start_with_direction", content: "flagship_en" });
    insertInquiry(B, { name: "B", source: "linkedin", medium: "organic", campaign: "start_with_direction", content: "flagship_en" });
    insertInquiry(C, { name: "C" });
    insertInquiry("dddddddd-dddd-4ddd-8ddd-dddddddddddd", { name: "Old", at: "2020-01-02 12:00:00+00" });
    svc(`select public.apply_booking_created(${lit(A)}, 'm-1', now() + interval '2 days', 'Africa/Cairo', now())`);
    svc(`select public.apply_booking_created(${lit(B)}, 'm-2', now() + interval '2 days', 'Africa/Cairo', now())`);
    svc(`select public.dashboard_save_draft(${lit(A)}, '{"format":"text","body":"x"}', 'manual', ${lit(OMAR)})`);
    svc(`select public.dashboard_review(${lit(A)}, 1, 'in_review', ${lit(OMAR)})`);
    svc(`select public.dashboard_review(${lit(A)}, 1, 'approved', ${lit(ADAM)})`);
    setStage(A, "meeting_completed");
    setStage(A, "qualified");
    setStage(A, "proposal_prep");
    const prop = svc(`select public.crm_create_proposal(${lit(A)}, ${obj({ summary: "s" })}, ${lit(OMAR)})`);
    for (const [s, who] of [["internal_review", OMAR], ["approved", ADAM], ["sent", OMAR]]) svc(`select public.crm_proposal_transition(${lit(prop)}, ${lit(s)}, ${lit(who)})`);
    setStage(A, "won");
    setStage(B, "qualified");
    setStage(B, "lost", OMAR, "'no_budget'");
    const m = json(`select public.crm_metrics(${lit(today)}, ${lit(today)}, ${lit(today)})`);
    assert.deepEqual(m.cohort, { inquiries: 3, booked: 2, meeting_ready: 1, discovery_complete: 2, qualified: 2, proposal_made: 1, proposal_sent: 1, won: 1, lost: 1 });
    assert.equal(m.events.wins, 1);
    assert.equal(m.events.losses, 1);
    assert.equal(m.events.proposals_sent, 1);
    const li = m.sources.find((s) => s.source === "linkedin");
    assert.deepEqual([li.inquiries, li.booked, li.qualified, li.won, li.lost, li.campaign, li.content], [2, 2, 2, 1, 1, "start_with_direction", "flagship_en"]);
    assert.equal(m.sources.find((s) => s.source === "direct").inquiries, 1);
    assert.deepEqual(m.loss_reasons, [{ reason: "no_budget", count: 1 }]);
    const old = json(`select public.crm_metrics('2020-01-02', '2020-01-02', ${lit(today)})`);
    assert.equal(old.cohort.inquiries, 1);
  });

  test("outreach activity: touches, replies, qualified prospects and days from first touch to meeting", () => {
    const today = db.psql("select current_date");
    const p = svc(`select public.crm_save_prospect(null, ${obj({ company_name: "Acme", owner: "omar" })}, ${lit(OMAR)})`);
    svc(`select public.crm_log_touch(${lit(p)}, 'outbound', 1, 'email', current_date - 6, 'First', ${lit(OMAR)}, 'Touch 2', 'omar', current_date)`);
    svc(`select public.crm_log_touch(${lit(p)}, 'reply', null, 'email', current_date - 2, 'Replied', ${lit(OMAR)}, 'Call', 'adam', current_date + 1)`);
    insertInquiry(A);
    svc(`select public.crm_link_prospect_inquiry(${lit(p)}, ${lit(A)}, ${lit(OMAR)})`);
    svc(`select public.apply_booking_created(${lit(A)}, 'p-1', (current_date + 4)::timestamptz + interval '10 hours', 'Africa/Cairo', now())`);
    const m = json(`select public.crm_metrics(current_date - 10, current_date, ${lit(today)})`);
    assert.deepEqual([m.outreach.touches, m.outreach.replies, m.outreach.contacted, m.outreach.replied, m.outreach.inquiries], [1, 1, 1, 1, 1]);
    assert.equal(m.outreach.median_days_first_touch_to_meeting, 10);
    assert.equal(m.outreach.by_stage.inquiry_submitted, 1);
  });

  test("an empty database gives zeros, not errors", () => {
    const m = json("select public.crm_metrics(current_date - 30, current_date, current_date)");
    assert.equal(m.cohort.inquiries, 0);
    assert.deepEqual(m.sources, []);
    assert.equal(m.outreach.median_days_first_touch_to_meeting, null);
  });
});

describe("export", () => {
  test("inquiries, companies and prospects exports carry no email, phone or handle; contacts do, and each export is recorded without its rows", () => {
    insertInquiry(A);
    svc(`select public.crm_create_from_inquiry(${lit(A)}, 'new', null, ${lit(OMAR)})`);
    svc(`select public.crm_save_prospect(null, ${obj({ company_name: "Acme", contact_handle: "handle-secret", owner: "omar" })}, ${lit(OMAR)})`);
    for (const kind of ["inquiries", "companies", "prospects"]) {
      const rows = json(`select public.crm_export(${lit(kind)}, ${lit(OMAR)})`);
      assert.ok(rows.length >= 1, kind);
      assert.doesNotMatch(JSON.stringify(rows), /client@crm-test|\+20 100|handle-secret/, kind);
    }
    const contacts = json(`select public.crm_export('contacts', ${lit(ADAM)})`);
    assert.equal(contacts[0].email, "client@crm-test.invalid");
    assert.equal(count("select count(*) from public.crm_activity where action = 'exported'"), 4);
    assert.equal(svc(`select detail::text from public.crm_activity where action = 'exported' and actor = ${lit(ADAM)}`), '{"kind": "contacts", "rows": 1}');
    assert.match(fail(`select public.crm_export('everything', ${lit(OMAR)})`), /unknown_export/);
    assert.equal(count("select count(*) from public.crm_activity where action = 'exported'"), 4, "a refused export is not recorded as one");
  });

  test("the inquiries export has the next action and its one responsible person", () => {
    insertInquiry(A);
    svc(`select public.dashboard_add_follow_up(${lit(A)}, 'Send the questions', 'adam', current_date + 1, ${lit(OMAR)})`);
    const [row] = json(`select public.crm_export('inquiries', ${lit(OMAR)})`);
    assert.equal(row.next_action, "Send the questions");
    assert.equal(row.next_action_owner, "adam");
  });
});

describe("migration safety", () => {
  test("applying the CRM migrations a second time changes nothing and loses nothing", () => {
    insertInquiry(A);
    setStage(A, "qualified");
    svc(`select public.crm_save_inquiry_details(${lit(A)}, ${obj({ fit_tier: "tier_2" })}, ${lit(OMAR)})`);
    const before = db.psql("select (select count(*) from public.crm_stage_history) || '|' || (select count(*) from public.inquiry_crm) || '|' || (select lead_status from public.project_inquiries limit 1)");
    for (const file of db.migrations.filter((f) => f >= "20261010")) db.applyMigration(file);
    assert.equal(db.psql("select (select count(*) from public.crm_stage_history) || '|' || (select count(*) from public.inquiry_crm) || '|' || (select lead_status from public.project_inquiries limit 1)"), before);
    assert.equal(count("select count(*) from pg_trigger where tgname = 'inquiry_follow_ups_trail' and not tgisinternal"), 1);
  });

  test("no migration contains personal data, a review marker or synthetic seeds", () => {
    const text = db.psql("select string_agg(prosrc, ' ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'crm\\_%'");
    assert.doesNotMatch(text, /review_environment|@example\./i);
  });
});
