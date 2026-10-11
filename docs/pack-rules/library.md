<!-- Generated from src/lib/pack by `npm run pack:rules`. Do not edit by hand: change the code, then regenerate. -->

# Mintapp design library and Pack rules

The canonical standard for every Pre-meeting Pack, whether prepared automatically or by hand with Claude. The application enforces everything marked as checked automatically; the reviewer checks the rest with the rubric and the approval checklist.

## 1. The Pack: seventeen sections in three working areas

| Working area | Section | Basis of its statements |
| --- | --- | --- |
| Initial product direction | `client_facts` (What the client told us) | client fact |
| Initial product direction | `assumptions` (Our assumptions) | assumption |
| Initial product direction | `missing_information` (What we still need to learn) | question |
| Initial product direction | `business_context` (The business) | each statement: client_fact (with an exact quote) or assumption |
| Initial product direction | `users` (Who it is for) | each statement: client_fact (with an exact quote) or assumption |
| Initial product direction | `problem` (The problem) | each statement: client_fact (with an exact quote) or assumption |
| Initial product direction | `goals` (Goals) | each statement: client_fact (with an exact quote) or assumption |
| Initial product direction | `design_blueprint` (Product direction) | recommendation |
| Initial product direction | `screens` (Concept screens) | recommendation |
| Initial product direction | `user_flow` (Main user journey) | recommendation |
| Draft scope and proposal direction | `scope_direction` (Recommended first release) | recommendation |
| Draft scope and proposal direction | `proposal_direction` (Proposal direction) | recommendation |
| Discovery and meeting plan | `discovery_questions` (Questions for the meeting) | question |
| Discovery and meeting plan | `decisions_needed` (Decisions the client needs to make) | question |
| Discovery and meeting plan | `risks` (Risks and constraints) | assumption |
| Discovery and meeting plan | `meeting_agenda` (Meeting agenda) | recommendation |
| Discovery and meeting plan | `next_steps` (Next steps) | recommendation |

Every statement is one of: a supplied **client fact** (with an exact, contiguous quote from the brief), a Mintapp **assumption**, a Mintapp **recommendation**, or a **question** requiring confirmation. The exact shape is in `pack.schema.json`; the instructions are in `instructions.md`.

## 2. What the validator refuses (nothing is saved)

- `schema`: The structure is incomplete or has something it should not.
- `wrong_language`: It is not in the brief's language.
- `wrong_script`: Too much of the text is in the other language.
- `ungrounded_fact`: Something marked as the client's words is not a quote from the brief.
- `unsupported_number`: A figure appears that the client never stated.
- `commitment`: It makes a promise (a guarantee, fixed price or delivery date) we never make before discovery.
- `unsupported_claim`: It claims proof we cannot stand behind (endorsements, awards, superlatives).
- `markup`: It contains a link, an email address, code or markup.
- `pattern_kind`: The product pattern does not suit the project type the client chose.
- `proposal_kind`: The kind of proposal does not suit the project type the client chose.
- `template_not_in_pattern`: A screen uses a template outside its pattern.
- `screens`: The screens or the user journey are incomplete.
- `flow_screen`: The user journey points at a screen that does not exist.

## 3. What can be saved but never presented

- Placeholder text: Contains placeholder text (for example [MOCK], TBD or lorem ipsum).
- A design no library pattern fits: No library pattern fits: the concept screens must be prepared by hand before presenting.
- An older format: Older format: cannot be presented.

## 4. Foundations

### Typography (الخطوط)

- One sans family in two weights for text and one bolder weight for headings; no decorative display faces.
- A short scale: display 26, title 18, body 14, small 12.5 on screens; presentation sizes scale with the slide.
- Line length 45-75 characters for reading text; headings in sentence case.
- Arabic uses the same scale with more line height and no letter-spacing; never italic or all-caps for Arabic.

### Spacing (المسافات)

- A 4px base; component padding 12-16, section padding 24-32.
- Related things sit closer than unrelated things; space, not lines, groups content first.

### Responsive grids (الشبكات المتجاوبة)

- Desktop 12 columns, tablet 8, phone 4. Every web concept is drawn at desktop and phone width.
- Cards collapse to one column on phones; tables become stacked rows; side navigation becomes a top bar or a bottom tab bar.
- Nothing may scroll sideways at 320px except a deliberately scrollable table region with a label.

### Colour and contrast (الألوان والتباين)

- Ink on paper with one accent, used only for the primary action and the current state.
- Body text at least 4.5:1 against its background; large text and interface outlines at least 3:1.
- Colour never carries meaning alone: a status also has a word or an icon.
- No client brand is assumed in concepts; brand colour is applied only from approved brand material.

### Borders and radius (الحدود والزوايا)

- Hairline borders (1px, low contrast) separate panels; radius 8 for controls, 12 for cards, 16 for frames.
- One radius family per screen; pills only for chips and status.

### Shadows and elevation (الظلال والارتفاع)

- Three levels only: flat (page), raised (cards: a 1-2px shadow), overlay (dialogs and frames).
- Elevation means 'above' (a dialog, a menu), never decoration.

### Imagery (الصور)

- Concepts use labelled placeholders, never stock photos, generated images or images from the web.
- A placeholder says what would go there; real imagery comes from the client's approved material and its licence is recorded.
- No people, logos or products that are not the client's own.

### Purposeful motion (الحركة الهادفة)

- Motion only to show a change of state or place (an item added, a panel opened), 150-250ms, no bounce.
- Nothing moves on its own; nothing loops. With reduced motion everything is instant.
- Concept screens and the Direction Pack are static.

### Accessibility (إتاحة الوصول)

- WCAG 2.1 AA: contrast, visible focus, labels for every field, headings in order, keyboard reachable.
- Touch targets at least 44 by 44 on phones; error messages say what to do next.
- Placeholders and decorative shapes are hidden from screen readers.

### English and Arabic (right to left) (العربية والإنجليزية (من اليمين إلى اليسار))

- Layouts use logical start and end, so a design mirrors; directional icons (arrows, progress) flip, logos and numbers do not.
- Arabic copy is written in Arabic, not translated word for word, and reviewed by a fluent reader before a client sees it.
- Mixed-direction text (names, codes, URLs) is isolated so it reads correctly in either direction.
- Western digits are used unless the client asks otherwise; dates follow the reader's language.

## 5. Components

### Navigation (التنقل)

Where am I, where can I go: a website top bar, an application side bar.

- Five main destinations at most; the current one is marked by more than colour.
- On phones a website bar collapses to a menu button; an application's side bar becomes a top bar.

Drawn by: SiteNav (website frames), AppChrome (application screens). Used in: overview_dashboard, trend_report, record_table, record_detail, workflow_board, schedule_calendar, data_form, empty_state.

### Hero (الواجهة الرئيسية)

The first view of a website: what this is, for whom, and the one next step.

- One headline, one supporting sentence, one primary action (a secondary one at most).
- No slogans the client did not approve; no invented proof in the hero.

Drawn by: Hero. Used in: hero.

### Cards (البطاقات)

A set of comparable things: services, values, listings.

- Same structure in every card of a set; a title and one short line.
- Three or four across on desktop, one column on phones.

Drawn by: Cards, Catalogue. Used in: value_points, services, catalogue, course_list, proof, home.

### Forms (النماذج)

Collecting what is needed, and only that.

- Every field has a visible label; help text says why a field is asked.
- One column; the primary action at the end, full width on phones.

Drawn by: Fields, FormSection, AppForm. Used in: booking_form, data_form, booking_order.

### Tables and record lists (الجداول وقوائم السجلات)

Scanning and acting on many records.

- The record's name first, its status visible, its next action reachable.
- On phones rows stack; nothing scrolls sideways without a labelled region.

Drawn by: Rows, Table. Used in: record_table, faq, list_search, schedule_calendar, detail, profile.

### Filters and search (التصفية والبحث)

Narrowing a list to what matters now.

- A search field and a few visible filters; the active filters are shown and can be cleared.
- Filters never hide that results exist elsewhere.

Drawn by: FilterBar, the search field in MobileList. Used in: record_table, list_search.

### Dashboards (لوحات المتابعة)

What needs attention, then the detail behind it.

- Tiles name a measure and link to the records behind it; values in a concept are placeholders, never invented.
- Attention first: overdue and blocked before totals.

Drawn by: Dashboard. Used in: overview_dashboard.

### Empty states (الحالات الفارغة)

The first visit or a list with nothing in it yet.

- Say what will appear here and give the first action.
- Never a blank area or a decorative illustration alone.

Drawn by: EmptyState. Used in: empty_state.

### Dialogs (مربعات الحوار)

Confirming a consequential step before it happens.

- Only for decisions with a consequence (paying, cancelling, deleting).
- The title says what will happen; the two actions say what they do, not 'OK' and 'Cancel'.

Drawn by: Confirmation. Used in: confirmation.

### Mobile navigation (التنقل في الجوال)

Moving between the main areas of a phone app with one thumb.

- A bottom tab bar of three to five destinations with labels, not icons alone.
- Back is always available; nothing important sits behind a gesture only.

Drawn by: MobileTabBar (phone frames of mobile patterns).

### Bookings (الحجوزات)

Choosing a service, a person and a time, and confirming it.

- Show what is available, not a blank calendar; confirm before committing.
- Times show their time zone when people may be in different places.

Drawn by: FormSection, Calendar, Confirmation. Used in: booking_form, schedule_calendar, booking_order, confirmation.

### Progress and status (التقدم والحالة)

Where a request, order or case stands and what happens next.

- A status has a word, not only a colour; the next step is named.
- Steps read in the reader's direction.

Drawn by: Steps, MobileTracking, Board. Used in: how_it_works, tracking, workflow_board.

### Data visualisation (عرض البيانات)

A trend over time, only where a decision depends on it.

- Only when the client's decisions depend on a trend; a table is often clearer.
- In concepts, bars and lines are placeholders: no value, axis figure or growth claim is ever drawn.

Drawn by: TrendReport. Used in: trend_report.

## 6. Product patterns

### `studio_site`: Service or company website (موقع شركة أو جهة خدمات)

- Kind: website
- For: a company presenting its services and taking inquiries
- Not for: a product people sign up to use (use the SaaS pattern) or online booking of a time (use the booking pattern)
- Screen templates (choose 2 to 4): hero, value_points, services, how_it_works, proof, faq, contact_cta

### `saas_marketing`: SaaS marketing website (موقع تسويقي لمنتج برمجي)

- Kind: website
- For: a software product explaining its value and converting sign-ups
- Not for: the product itself (a web application pattern) or a services company
- Screen templates (choose 2 to 4): hero, value_points, how_it_works, proof, faq, contact_cta

### `marketplace_site`: Marketplace website (موقع سوق إلكتروني)

- Kind: website
- For: listings from many providers that visitors browse and request
- Not for: a single business's own catalogue (use the service or booking pattern) or the operators' back office (marketplace administration)
- Screen templates (choose 2 to 4): hero, catalogue, how_it_works, confirmation, proof, faq, contact_cta

### `academy_site`: Academy website (موقع أكاديمية أو منصة تعليمية)

- Kind: website
- For: courses or programmes that learners browse and apply to
- Not for: a learning platform with accounts, lessons and progress (a web or mobile application)
- Screen templates (choose 2 to 4): hero, course_list, how_it_works, proof, faq, contact_cta

### `booking_site`: Booking or service business website (موقع حجز لنشاط خدمي)

- Kind: website
- For: a local service business where visitors choose a service and book a time
- Not for: staff managing many calendars and resources (use the scheduling system)
- Screen templates (choose 2 to 4): hero, services, booking_form, confirmation, how_it_works, faq, contact_cta

### `dashboard_app`: Operational dashboard (لوحة متابعة تشغيلية)

- Kind: web_app
- For: people who monitor activity and act on what needs attention
- Not for: a team that mainly moves records through stages (use CRM or workflow)
- Screen templates (choose 2 to 4): overview_dashboard, trend_report, record_table, record_detail, data_form, empty_state

### `crm_app`: CRM or workflow system (نظام علاقات عملاء أو سير عمل)

- Kind: web_app
- For: a team tracking customers, cases, requests or jobs through stages and the next action on each
- Not for: a public website, or a system centred on appointments (use the scheduling system)
- Screen templates (choose 2 to 4): record_table, record_detail, workflow_board, data_form, overview_dashboard, empty_state

### `marketplace_admin`: Marketplace administration (إدارة سوق إلكتروني)

- Kind: web_app
- For: operators who manage providers, listings and orders
- Not for: the public side of the marketplace (marketplace website or mobile patterns)
- Screen templates (choose 2 to 4): overview_dashboard, record_table, record_detail, catalogue, data_form, confirmation

### `scheduling_app`: Scheduling system (نظام مواعيد وجدولة)

- Kind: web_app
- For: staff and customers booking and managing appointments, rooms or resources
- Not for: a single page where visitors only request a time (booking website)
- Screen templates (choose 2 to 4): schedule_calendar, booking_form, confirmation, record_table, record_detail, how_it_works

### `mobile_onboarding`: Mobile onboarding and account (تطبيق جوّال: البدء والحساب)

- Kind: mobile_app
- For: a phone app whose first question is getting people started: welcome, first use, an empty start and the profile
- Not for: an app whose value is finding or ordering things (use the discovery or booking mobile patterns)
- Screen templates (choose 2 to 4): onboarding, home, empty_state, profile

### `mobile_discovery`: Mobile discovery: list and detail (تطبيق جوّال: البحث والقوائم والتفاصيل)

- Kind: mobile_app
- For: a phone app for finding things: a home, search and lists, and a detail page
- Not for: an app centred on placing and following an order or booking (use booking, order and tracking)
- Screen templates (choose 2 to 4): home, list_search, detail, empty_state

### `mobile_transactions`: Mobile booking, order and tracking (تطبيق جوّال: الحجز والطلب والمتابعة)

- Kind: mobile_app
- For: a phone app where people book or order, confirm, follow progress and manage their profile
- Not for: an app with no transaction (use discovery or onboarding)
- Screen templates (choose 2 to 4): detail, booking_order, confirmation, tracking, profile

## 7. Screen templates

| Template | Draws | Kinds | Items at most |
| --- | --- | --- | --- |
| `hero` | Headline, supporting text, actions and an image placeholder; optional short cards. | website | 3 |
| `value_points` | A heading and three or four value cards. | website | 4 |
| `services` | A heading and service cards. | website | 6 |
| `how_it_works` | A heading and numbered steps. | website, web_app | 5 |
| `catalogue` | A heading and listing cards with image placeholders. | website, web_app | 6 |
| `course_list` | The catalogue layout for courses or programmes. | website | 6 |
| `booking_form` | A heading and a form of labelled fields with actions. | website, web_app | 6 |
| `proof` | Proof points the client can stand behind (never invented figures, users or quotes). | website | 3 |
| `faq` | A heading and question rows. | website | 5 |
| `contact_cta` | A closing call to action. | website | 2 |
| `overview_dashboard` | App frame, heading and status tiles; values are drawn as placeholders, never invented. | web_app | 6 |
| `trend_report` | App frame, the measures to watch as a legend, and a chart whose bars are placeholders: no values are ever drawn. | web_app | 4 |
| `record_table` | App frame, filter chips and record rows. | web_app | 6 |
| `record_detail` | App frame, fields and an image placeholder. | web_app | 6 |
| `workflow_board` | App frame and stage columns. | web_app | 5 |
| `schedule_calendar` | App frame, a calendar grid and the day's rows. | web_app | 6 |
| `data_form` | App frame and a form. | web_app | 6 |
| `empty_state` | The first-run or nothing-yet state: what this place is for and the first actions. | web_app, mobile_app | 3 |
| `confirmation` | A dialog over the dimmed screen: what is about to happen, a summary and the two choices. | website, web_app, mobile_app | 4 |
| `onboarding` | Image placeholder, headline, points and an action. | mobile_app | 3 |
| `home` | Headline, image placeholder, cards and an action. | mobile_app | 4 |
| `list_search` | Headline, search field, filter chips and rows. | mobile_app | 6 |
| `detail` | Image placeholder, headline, rows and an action. | mobile_app | 5 |
| `booking_order` | The booking or order form in a phone. | mobile_app | 5 |
| `tracking` | A vertical progress timeline. | mobile_app | 5 |
| `profile` | Avatar placeholder, headline and rows. | mobile_app | 5 |

## 8. Proposal patterns (indicative direction only; never a price, duration or commitment)

### `website`: Website (موقع إلكتروني)

- Kind: website
- For: a new or rebuilt website for a company, product, academy or booking business
- Typical phases: Content and structure; Design; Build and content entry; Launch and handover
- Deliverables: A site map and page structure; Designs for each page type at desktop and phone width; The built website in the agreed languages; Handover of content editing
- What shapes cost and schedule: How many page types and languages; Who writes and translates the content; Forms, booking or payment on the site; Integrations with existing tools
- Usually not in a first release: Copywriting and translation unless agreed; Photography and brand identity; Paid advertising

### `web_app`: Web application (تطبيق ويب)

- Kind: web_app
- For: a system people sign in to and work in: dashboards, workflows, scheduling, administration
- Typical phases: Discovery and flows; Design of the main screens; Build of the first release; Testing with real users and launch
- Deliverables: User flows for the main tasks; Designs for the main screens; The working first release; Accounts and roles for the team
- What shapes cost and schedule: How many user roles and permissions; Integrations and data to import; Reporting needs; Arabic and English throughout
- Usually not in a first release: Data clean-up of old systems; Features for later releases; Hardware and third-party subscriptions

### `mobile_app`: Mobile application (تطبيق جوّال)

- Kind: mobile_app
- For: an app for phones, with or without a web dashboard behind it
- Typical phases: Discovery and flows; Design of the main screens; Build and store preparation; Testing and store release
- Deliverables: User flows; Designs for the main screens at phone size; The app for the agreed platforms; Store listings prepared with the client
- What shapes cost and schedule: Which platforms (iOS, Android, both); Payments and accounts; Notifications and offline use; The admin side behind the app
- Usually not in a first release: Store fees and developer accounts; Marketing the app; Hardware integrations unless agreed

### `existing_product`: Improving an existing product (تطوير منتج قائم)

- Kind: any
- For: a website or app the client already runs that needs a redesign, new features or fixes
- Typical phases: Review of what exists; Priorities agreed; Design and build of the agreed changes; Release and follow-up
- Deliverables: A short review of the current product; A prioritised list of changes; Designs and the built changes; Release notes
- What shapes cost and schedule: The state and ownership of the current code; Access to hosting and data; How much changes at once; Keeping the current product running meanwhile
- Usually not in a first release: Rewriting what works; Unrelated fixes found during the review unless agreed

## 9. Discovery banks

### `project_type`: Project type (نوع المشروع)

Whether this is a website, a web application, a mobile app or several, and which comes first.

- What should people be able to do on the first day it is live? / ما الذي يجب أن يستطيع الناس فعله في أول يوم للإطلاق؟
- Is a website or an app the better first step for your customers? / هل الموقع أم التطبيق هو الخطوة الأولى الأنسب لعملائك؟

### `business_model`: Business model (نموذج العمل)

How the product creates value and earns money, so scope supports the business.

- How does this product earn money or save it? / كيف يحقق هذا المنتج دخلًا أو يوفّر تكلفة؟
- Who pays, and when? / من يدفع، ومتى؟

### `users`: Users (المستخدمون)

Who uses it, what they do today instead, and what they need first.

- Who will use this first, and what do they do today instead? / من سيستخدم المنتج أولًا، وماذا يفعل اليوم بدلًا منه؟
- Which group matters most for the first release? / أي فئة هي الأهم في الإصدار الأول؟

### `operations`: Operations (التشغيل)

How the work actually runs today, step by step, and where it breaks.

- Walk us through a normal day: where does it go wrong? / صف لنا يومًا عاديًا: أين تحدث المشكلات؟
- Who handles exceptions such as cancellations or returns? / من يتعامل مع الحالات الاستثنائية مثل الإلغاء أو الاسترجاع؟

### `payments`: Payments (المدفوعات)

Whether money moves through the product, how, and in which currencies.

- Should customers pay in the product, or is payment handled elsewhere? / هل يدفع العملاء داخل المنتج أم تتم المدفوعات بطريقة أخرى؟
- Which payment methods do your customers expect? / ما وسائل الدفع التي يتوقعها عملاؤك؟

### `integrations`: Integrations (التكاملات)

Existing tools and data the product must work with or replace.

- Which tools do you use today that this must connect to or replace? / ما الأدوات التي تستخدمونها اليوم ويجب أن يرتبط بها المنتج أو يحل محلها؟
- Is there existing data we need to bring in? / هل توجد بيانات حالية يجب نقلها؟

### `roles_permissions`: Roles and permissions (الأدوار والصلاحيات)

Who can see and change what.

- Which people on your team need different access? / من في فريقك يحتاج إلى صلاحيات مختلفة؟
- Is there anything only a manager should be able to do? / هل هناك ما يجب أن يقتصر على المدير؟

### `content`: Content (المحتوى)

What text, images and media exist, who writes the rest, and in which languages.

- What content exists today, and who will write what is missing? / ما المحتوى الموجود حاليًا، ومن سيكتب الناقص؟
- Do you have approved photos and brand material we can use? / هل لديكم صور ومواد هوية معتمدة يمكننا استخدامها؟

### `security_privacy`: Security and privacy (الأمان والخصوصية)

What personal or sensitive data is involved and what rules apply to it.

- What personal information will the product hold, and who may see it? / ما المعلومات الشخصية التي سيحتفظ بها المنتج، ومن يحق له الاطلاع عليها؟
- Are there rules in your sector about storing this data? / هل توجد قواعد في قطاعكم بشأن تخزين هذه البيانات؟

### `analytics`: Analytics (التحليلات)

What the client needs to know after launch to decide what comes next.

- After launch, what would you want to know every week? / بعد الإطلاق، ما الذي تريد معرفته كل أسبوع؟
- How will you know the first release worked? / كيف ستعرف أن الإصدار الأول نجح؟

### `language`: Arabic and English (العربية والإنجليزية)

Which languages, for whom, and who reviews each.

- Which languages do your users need, and is one the main one? / ما اللغات التي يحتاجها مستخدموك، وهل هناك لغة أساسية؟
- Who on your side will review the Arabic and English text? / من في فريقكم سيراجع النصوص العربية والإنجليزية؟

### `support_maintenance`: Support and maintenance (الدعم والصيانة)

Who runs the product after launch and what help they need.

- Who will run the product day to day after launch? / من سيدير المنتج يوميًا بعد الإطلاق؟
- What kind of help would you want after launch? / ما نوع المساعدة التي تريدها بعد الإطلاق؟

## 10. Quality rules

- **No random gradients, glass cards or decorative effects without a purpose.** Decoration hides the structure the client needs to judge. (checked automatically: Concepts are drawn only by library templates from text; nothing in a Pack can carry a style, colour or effect.)
- **No fake statistics, testimonials, users, clients or capabilities.** A first direction must be something we can stand behind in the meeting. (checked automatically and by the reviewer: Any figure the client did not state is refused; claims such as 'trusted by', 'award-winning' or quotes from customers are refused.)
- **No lorem ipsum, 'TBD', bracketed placeholders or test text in anything a client sees.** Placeholder text in a client presentation reads as unfinished work. (checked automatically: A version with placeholder text can be saved and reviewed, but the Direction Pack cannot be presented or exported from it.)
- **No interface pattern outside the library.** What we show must be something we design and build well. (checked automatically: Only library pattern, template, proposal-pattern and discovery-bank ids are accepted; anything else is refused or prepared by hand.)
- **No visually impressive but operationally impossible concept.** The client will plan around what we show. (checked by the reviewer)
- **No desktop-only design.** Most of our clients' customers arrive on phones. (checked automatically and by the reviewer: Every design states its responsive direction, and every web concept is drawn at desktop and phone width.)
- **No English layout simply mirrored without an Arabic review.** Arabic readers notice translated layouts and copy immediately. (checked automatically and by the reviewer: A Pack is written wholly in the client's language (checked); a fluent reader approves the Arabic before presenting.)
- **No excessive animation.** Motion distracts in a meeting and fails people with motion sensitivity. (checked automatically: Concept screens and the Direction Pack are static.)
- **No proposal commitments disguised as assumptions.** Scope, price and timeline are confirmed after discovery, in the final proposal. (checked automatically and by the reviewer: Promises, guarantees, fixed prices and delivery dates are refused anywhere in a Pack, assumptions included.)

## 11. Review rubric

- **Relevance (الصلة بالعميل)**: Is every part about this client's business and words, not a generic template? / هل كل جزء يخص نشاط هذا العميل وكلماته، لا قالبًا عامًا؟
- **Clarity (الوضوح)**: Would the client understand each slide in one reading? / هل سيفهم العميل كل شريحة من قراءة واحدة؟
- **Differentiation (التميّز)**: Does the direction show what would make this product right for this client, not just any product? / هل يبيّن الاتجاه ما يجعل هذا المنتج مناسبًا لهذا العميل تحديدًا؟
- **Feasibility (قابلية التنفيذ)**: Could we build and the client operate what is shown? / هل يمكننا بناء ما يُعرض، ويمكن للعميل تشغيله؟
- **Consistency (الاتساق)**: Do the problem, screens, flow, scope and questions tell one story? / هل تروي المشكلة والشاشات والرحلة والنطاق والأسئلة قصة واحدة؟
- **Accessibility (إتاحة الوصول)**: Are labels, contrast and actions clear for everyone? / هل التسميات والتباين والإجراءات واضحة للجميع؟
- **Responsiveness (التجاوب)**: Does it work on a phone as well as on a desktop? / هل يعمل على الجوال كما يعمل على الحاسوب؟
- **Right to left (الاتجاه من اليمين إلى اليسار)**: If in Arabic: was it reviewed by a fluent reader, and does it read naturally right to left? / إن كان بالعربية: هل راجعه قارئ متمكّن، وهل يُقرأ بطبيعية من اليمين إلى اليسار؟
- **Evidence (الدليل)**: Is each client fact really in the brief, and is every assumption marked as one? / هل كل معلومة منسوبة للعميل موجودة فعلًا في طلبه، وهل كل افتراض موسوم بأنه افتراض؟
- **Meeting usefulness (فائدة الاجتماع)**: Will this help us run a better first meeting and reach a decision? / هل يساعدنا هذا على إدارة اجتماع أول أفضل والوصول إلى قرار؟

## 12. Approval checklist (confirmed by the founder who did not write the version)

- Every 'Client said' item is in the client's own brief. / كل ما وُسم «قاله العميل» موجود في طلب العميل نفسه.
- Every assumption is marked as one, and none is a promise. / كل افتراض موسوم بأنه افتراض، ولا شيء منها وعد.
- No price, date, duration or number appears that the client did not give. / لا يظهر سعر أو تاريخ أو مدة أو رقم لم يذكره العميل.
- No invented users, statistics, testimonials or capabilities. / لا مستخدمين أو إحصاءات أو شهادات أو قدرات مختلَقة.
- We could build what is shown, and the client could run it. / يمكننا بناء ما يُعرض، ويمكن للعميل تشغيله.
- The language reads naturally (Arabic reviewed by a fluent reader). / اللغة طبيعية (والعربية راجعها قارئ متمكّن).
- Nothing reads as a final quote, scope or timeline. / لا شيء يُفهم على أنه عرض سعر أو نطاق أو جدول زمني نهائي.
