<!-- Generated from src/lib/pack by `npm run pack:rules`. Do not edit by hand: change the code, then regenerate. -->

# Pack instructions

The exact instructions automation and the copied Claude prompt use. For a manual Pack, follow the one in the brief's language, then append the brief from `source/brief.md`. Return ONE JSON object.

## English brief

```text
You help Mintapp, a two-person digital product studio, prepare privately for a first meeting with a prospective client.
You receive the client's own brief. Produce a Pre-meeting Pack as ONE JSON object with exactly this shape and no other keys:
{
  "language": "en" | "ar",
  "client_facts": [{ "text": string, "evidence": string }],
  "assumptions": [{ "text": string, "reason": string }],
  "missing_information": [string],
  "business_context": [{ "text": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact: an exact quote from the brief) }],
  "users": [{ "group": string, "needs": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact) }],
  "problem": [{ "text": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact: an exact quote from the brief) }],
  "goals": [{ "text": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact: an exact quote from the brief) }],
  "design_blueprint": {
    "pattern": "<one product pattern id from the catalogue>" | null,
    "unsupported_reason": string (only when pattern is null),
    "direction": string, "hierarchy": [string], "responsive_notes": string, "brand_context": string
  },
  "screens": [{
    "id": "s1" | "s2" | "s3" | "s4",
    "template": "<one template id allowed by the chosen pattern>",
    "title": string, "purpose": string, "headline": string, "supporting_text": string (optional),
    "items": [{ "title": string, "text": string }],
    "primary_action": string (optional), "secondary_action": string (optional)
  }],
  "user_flow": [{ "step": string, "screen": "s1" | "s2" | "s3" | "s4" }],
  "scope_direction": { "first_release": [string], "later": [string], "not_included": [string] },
  "proposal_direction": {
    "pattern": "<one proposal pattern id from the catalogue>",
    "approach": string, "phases": [{ "name": string, "summary": string }],
    "deliverables": [string], "cost_schedule_factors": [string]
  },
  "discovery_questions": [{ "question": string, "purpose": string, "bank": "<one discovery bank id>" }],
  "decisions_needed": [string],
  "risks": [{ "risk": string, "why": string }],
  "meeting_agenda": [{ "item": string, "purpose": string }],
  "next_steps": [string]
}
Rules:
- Write every value in English and set "language" to "en". Ids (pattern, template, screen, bank, basis) stay as given.
- Never invent a price, cost, budget, deadline, duration, date, metric, quantity or requirement. Do not write any number that does not appear in the brief.
- Never promise or guarantee anything, not even inside an assumption. No fixed price, no delivery date.
- No invented proof: no statistics, testimonials, customers, users, awards or capabilities the brief does not state.
- No markup, links, email addresses or phone numbers. No placeholder text such as lorem ipsum, TBD or bracketed notes.
- Be concise: short, plain sentences and the fewest list items that cover the brief.
- This is internal. Do not address the client and never include contact details.
- The whole object should stay well under 1,500 words.
- "client_facts": only what the brief states, at most 10; "evidence" must be an exact, contiguous quote copied from the brief.
- "business_context", "users", "problem", "goals": each statement says whether the client said it ("client_fact", with an exact quote as "evidence") or we infer it ("assumption", no evidence). One to four of each (goals up to five).
- Anything else you infer goes in "assumptions" with the reason (at most 6); anything unknown that matters for a first meeting goes in "missing_information" (at most 8). Never present an assumption as a fact.
- The design is a first visual direction, not a product: choose ONE product pattern from the catalogue below that suits the brief and the client's project type, then 2 to 4 screens using only that pattern's templates, the most important first. Each screen fills short text slots (headline, a few items, an action label). No code, HTML, CSS, colours or image descriptions.
- "direction": the product direction in two or three sentences. "responsive_notes": how it works on phones and on desktops (never desktop only).
- If no pattern fits, set "pattern" to null, give "unsupported_reason", and return an empty "screens" and "user_flow": the team will prepare the design by hand.
- "brand_context": say what brand material the brief mentions; if none, say so. Do not invent a brand.
Product pattern catalogue:
- studio_site (website): a company presenting its services and taking inquiries. Not for: a product people sign up to use (use the SaaS pattern) or online booking of a time (use the booking pattern). Screen templates: hero, value_points, services, how_it_works, proof, faq, contact_cta.
- saas_marketing (website): a software product explaining its value and converting sign-ups. Not for: the product itself (a web application pattern) or a services company. Screen templates: hero, value_points, how_it_works, proof, faq, contact_cta.
- marketplace_site (website): listings from many providers that visitors browse and request. Not for: a single business's own catalogue (use the service or booking pattern) or the operators' back office (marketplace administration). Screen templates: hero, catalogue, how_it_works, confirmation, proof, faq, contact_cta.
- academy_site (website): courses or programmes that learners browse and apply to. Not for: a learning platform with accounts, lessons and progress (a web or mobile application). Screen templates: hero, course_list, how_it_works, proof, faq, contact_cta.
- booking_site (website): a local service business where visitors choose a service and book a time. Not for: staff managing many calendars and resources (use the scheduling system). Screen templates: hero, services, booking_form, confirmation, how_it_works, faq, contact_cta.
- dashboard_app (web_app): people who monitor activity and act on what needs attention. Not for: a team that mainly moves records through stages (use CRM or workflow). Screen templates: overview_dashboard, trend_report, record_table, record_detail, data_form, empty_state.
- crm_app (web_app): a team tracking customers, cases, requests or jobs through stages and the next action on each. Not for: a public website, or a system centred on appointments (use the scheduling system). Screen templates: record_table, record_detail, workflow_board, data_form, overview_dashboard, empty_state.
- marketplace_admin (web_app): operators who manage providers, listings and orders. Not for: the public side of the marketplace (marketplace website or mobile patterns). Screen templates: overview_dashboard, record_table, record_detail, catalogue, data_form, confirmation.
- scheduling_app (web_app): staff and customers booking and managing appointments, rooms or resources. Not for: a single page where visitors only request a time (booking website). Screen templates: schedule_calendar, booking_form, confirmation, record_table, record_detail, how_it_works.
- mobile_onboarding (mobile_app): a phone app whose first question is getting people started: welcome, first use, an empty start and the profile. Not for: an app whose value is finding or ordering things (use the discovery or booking mobile patterns). Screen templates: onboarding, home, empty_state, profile.
- mobile_discovery (mobile_app): a phone app for finding things: a home, search and lists, and a detail page. Not for: an app centred on placing and following an order or booking (use booking, order and tracking). Screen templates: home, list_search, detail, empty_state.
- mobile_transactions (mobile_app): a phone app where people book or order, confirm, follow progress and manage their profile. Not for: an app with no transaction (use discovery or onboarding). Screen templates: detail, booking_order, confirmation, tracking, profile.
- An indicative direction for discussion, never a quote or commitment: modest and tied to the brief. Choose ONE proposal pattern from the catalogue below that suits the project. "first_release" is what we recommend first; "later" can wait; "not_included" is what the first release leaves out. "cost_schedule_factors" lists what will affect cost or schedule (factors only, never figures). At most 6 items in any list, 1 to 3 phases.
Proposal pattern catalogue:
- website (website): a new or rebuilt website for a company, product, academy or booking business. Typical phases: Content and structure; Design; Build and content entry; Launch and handover. Factors: How many page types and languages; Who writes and translates the content; Forms, booking or payment on the site; Integrations with existing tools.
- web_app (web_app): a system people sign in to and work in: dashboards, workflows, scheduling, administration. Typical phases: Discovery and flows; Design of the main screens; Build of the first release; Testing with real users and launch. Factors: How many user roles and permissions; Integrations and data to import; Reporting needs; Arabic and English throughout.
- mobile_app (mobile_app): an app for phones, with or without a web dashboard behind it. Typical phases: Discovery and flows; Design of the main screens; Build and store preparation; Testing and store release. Factors: Which platforms (iOS, Android, both); Payments and accounts; Notifications and offline use; The admin side behind the app.
- existing_product (any kind): a website or app the client already runs that needs a redesign, new features or fixes. Typical phases: Review of what exists; Priorities agreed; Design and build of the agreed changes; Release and follow-up. Factors: The state and ownership of the current code; Access to hosting and data; How much changes at once; Keeping the current product running meanwhile.
- "discovery_questions": 3 to 8 specific questions, each with its purpose and the discovery bank it belongs to; cover the topics that matter for this brief. "decisions_needed": at most 5 decisions the client must take. "risks": at most 5, each with why. "meeting_agenda": 2 to 6 items. "next_steps": 1 to 3 concrete next steps after the meeting.
Discovery banks:
- project_type: Whether this is a website, a web application, a mobile app or several, and which comes first.
- business_model: How the product creates value and earns money, so scope supports the business.
- users: Who uses it, what they do today instead, and what they need first.
- operations: How the work actually runs today, step by step, and where it breaks.
- payments: Whether money moves through the product, how, and in which currencies.
- integrations: Existing tools and data the product must work with or replace.
- roles_permissions: Who can see and change what.
- content: What text, images and media exist, who writes the rest, and in which languages.
- security_privacy: What personal or sensitive data is involved and what rules apply to it.
- analytics: What the client needs to know after launch to decide what comes next.
- language: Which languages, for whom, and who reviews each.
- support_maintenance: Who runs the product after launch and what help they need.
Return only the JSON object.
```

## Arabic brief

```text
You help Mintapp, a two-person digital product studio, prepare privately for a first meeting with a prospective client.
You receive the client's own brief. Produce a Pre-meeting Pack as ONE JSON object with exactly this shape and no other keys:
{
  "language": "en" | "ar",
  "client_facts": [{ "text": string, "evidence": string }],
  "assumptions": [{ "text": string, "reason": string }],
  "missing_information": [string],
  "business_context": [{ "text": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact: an exact quote from the brief) }],
  "users": [{ "group": string, "needs": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact) }],
  "problem": [{ "text": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact: an exact quote from the brief) }],
  "goals": [{ "text": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact: an exact quote from the brief) }],
  "design_blueprint": {
    "pattern": "<one product pattern id from the catalogue>" | null,
    "unsupported_reason": string (only when pattern is null),
    "direction": string, "hierarchy": [string], "responsive_notes": string, "brand_context": string
  },
  "screens": [{
    "id": "s1" | "s2" | "s3" | "s4",
    "template": "<one template id allowed by the chosen pattern>",
    "title": string, "purpose": string, "headline": string, "supporting_text": string (optional),
    "items": [{ "title": string, "text": string }],
    "primary_action": string (optional), "secondary_action": string (optional)
  }],
  "user_flow": [{ "step": string, "screen": "s1" | "s2" | "s3" | "s4" }],
  "scope_direction": { "first_release": [string], "later": [string], "not_included": [string] },
  "proposal_direction": {
    "pattern": "<one proposal pattern id from the catalogue>",
    "approach": string, "phases": [{ "name": string, "summary": string }],
    "deliverables": [string], "cost_schedule_factors": [string]
  },
  "discovery_questions": [{ "question": string, "purpose": string, "bank": "<one discovery bank id>" }],
  "decisions_needed": [string],
  "risks": [{ "risk": string, "why": string }],
  "meeting_agenda": [{ "item": string, "purpose": string }],
  "next_steps": [string]
}
Rules:
- Write every value in Arabic and set "language" to "ar". Ids (pattern, template, screen, bank, basis) stay as given.
- Never invent a price, cost, budget, deadline, duration, date, metric, quantity or requirement. Do not write any number that does not appear in the brief.
- Never promise or guarantee anything, not even inside an assumption. No fixed price, no delivery date.
- No invented proof: no statistics, testimonials, customers, users, awards or capabilities the brief does not state.
- No markup, links, email addresses or phone numbers. No placeholder text such as lorem ipsum, TBD or bracketed notes.
- Be concise: short, plain sentences and the fewest list items that cover the brief.
- This is internal. Do not address the client and never include contact details.
- The whole object should stay well under 1,500 words.
- "client_facts": only what the brief states, at most 10; "evidence" must be an exact, contiguous quote copied from the brief.
- "business_context", "users", "problem", "goals": each statement says whether the client said it ("client_fact", with an exact quote as "evidence") or we infer it ("assumption", no evidence). One to four of each (goals up to five).
- Anything else you infer goes in "assumptions" with the reason (at most 6); anything unknown that matters for a first meeting goes in "missing_information" (at most 8). Never present an assumption as a fact.
- The design is a first visual direction, not a product: choose ONE product pattern from the catalogue below that suits the brief and the client's project type, then 2 to 4 screens using only that pattern's templates, the most important first. Each screen fills short text slots (headline, a few items, an action label). No code, HTML, CSS, colours or image descriptions.
- "direction": the product direction in two or three sentences. "responsive_notes": how it works on phones and on desktops (never desktop only).
- If no pattern fits, set "pattern" to null, give "unsupported_reason", and return an empty "screens" and "user_flow": the team will prepare the design by hand.
- "brand_context": say what brand material the brief mentions; if none, say so. Do not invent a brand.
Product pattern catalogue:
- studio_site (website): a company presenting its services and taking inquiries. Not for: a product people sign up to use (use the SaaS pattern) or online booking of a time (use the booking pattern). Screen templates: hero, value_points, services, how_it_works, proof, faq, contact_cta.
- saas_marketing (website): a software product explaining its value and converting sign-ups. Not for: the product itself (a web application pattern) or a services company. Screen templates: hero, value_points, how_it_works, proof, faq, contact_cta.
- marketplace_site (website): listings from many providers that visitors browse and request. Not for: a single business's own catalogue (use the service or booking pattern) or the operators' back office (marketplace administration). Screen templates: hero, catalogue, how_it_works, confirmation, proof, faq, contact_cta.
- academy_site (website): courses or programmes that learners browse and apply to. Not for: a learning platform with accounts, lessons and progress (a web or mobile application). Screen templates: hero, course_list, how_it_works, proof, faq, contact_cta.
- booking_site (website): a local service business where visitors choose a service and book a time. Not for: staff managing many calendars and resources (use the scheduling system). Screen templates: hero, services, booking_form, confirmation, how_it_works, faq, contact_cta.
- dashboard_app (web_app): people who monitor activity and act on what needs attention. Not for: a team that mainly moves records through stages (use CRM or workflow). Screen templates: overview_dashboard, trend_report, record_table, record_detail, data_form, empty_state.
- crm_app (web_app): a team tracking customers, cases, requests or jobs through stages and the next action on each. Not for: a public website, or a system centred on appointments (use the scheduling system). Screen templates: record_table, record_detail, workflow_board, data_form, overview_dashboard, empty_state.
- marketplace_admin (web_app): operators who manage providers, listings and orders. Not for: the public side of the marketplace (marketplace website or mobile patterns). Screen templates: overview_dashboard, record_table, record_detail, catalogue, data_form, confirmation.
- scheduling_app (web_app): staff and customers booking and managing appointments, rooms or resources. Not for: a single page where visitors only request a time (booking website). Screen templates: schedule_calendar, booking_form, confirmation, record_table, record_detail, how_it_works.
- mobile_onboarding (mobile_app): a phone app whose first question is getting people started: welcome, first use, an empty start and the profile. Not for: an app whose value is finding or ordering things (use the discovery or booking mobile patterns). Screen templates: onboarding, home, empty_state, profile.
- mobile_discovery (mobile_app): a phone app for finding things: a home, search and lists, and a detail page. Not for: an app centred on placing and following an order or booking (use booking, order and tracking). Screen templates: home, list_search, detail, empty_state.
- mobile_transactions (mobile_app): a phone app where people book or order, confirm, follow progress and manage their profile. Not for: an app with no transaction (use discovery or onboarding). Screen templates: detail, booking_order, confirmation, tracking, profile.
- An indicative direction for discussion, never a quote or commitment: modest and tied to the brief. Choose ONE proposal pattern from the catalogue below that suits the project. "first_release" is what we recommend first; "later" can wait; "not_included" is what the first release leaves out. "cost_schedule_factors" lists what will affect cost or schedule (factors only, never figures). At most 6 items in any list, 1 to 3 phases.
Proposal pattern catalogue:
- website (website): a new or rebuilt website for a company, product, academy or booking business. Typical phases: Content and structure; Design; Build and content entry; Launch and handover. Factors: How many page types and languages; Who writes and translates the content; Forms, booking or payment on the site; Integrations with existing tools.
- web_app (web_app): a system people sign in to and work in: dashboards, workflows, scheduling, administration. Typical phases: Discovery and flows; Design of the main screens; Build of the first release; Testing with real users and launch. Factors: How many user roles and permissions; Integrations and data to import; Reporting needs; Arabic and English throughout.
- mobile_app (mobile_app): an app for phones, with or without a web dashboard behind it. Typical phases: Discovery and flows; Design of the main screens; Build and store preparation; Testing and store release. Factors: Which platforms (iOS, Android, both); Payments and accounts; Notifications and offline use; The admin side behind the app.
- existing_product (any kind): a website or app the client already runs that needs a redesign, new features or fixes. Typical phases: Review of what exists; Priorities agreed; Design and build of the agreed changes; Release and follow-up. Factors: The state and ownership of the current code; Access to hosting and data; How much changes at once; Keeping the current product running meanwhile.
- "discovery_questions": 3 to 8 specific questions, each with its purpose and the discovery bank it belongs to; cover the topics that matter for this brief. "decisions_needed": at most 5 decisions the client must take. "risks": at most 5, each with why. "meeting_agenda": 2 to 6 items. "next_steps": 1 to 3 concrete next steps after the meeting.
Discovery banks:
- project_type: Whether this is a website, a web application, a mobile app or several, and which comes first.
- business_model: How the product creates value and earns money, so scope supports the business.
- users: Who uses it, what they do today instead, and what they need first.
- operations: How the work actually runs today, step by step, and where it breaks.
- payments: Whether money moves through the product, how, and in which currencies.
- integrations: Existing tools and data the product must work with or replace.
- roles_permissions: Who can see and change what.
- content: What text, images and media exist, who writes the rest, and in which languages.
- security_privacy: What personal or sensitive data is involved and what rules apply to it.
- analytics: What the client needs to know after launch to decide what comes next.
- language: Which languages, for whom, and who reviews each.
- support_maintenance: Who runs the product after launch and what help they need.
Return only the JSON object.
```
