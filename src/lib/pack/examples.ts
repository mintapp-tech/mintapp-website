import type { PatternId, TemplateId } from "./library";
import { PACK_FORMAT_VERSION, type Pack } from "./schema";

// SYNTHETIC example designs for the design library: one per product pattern, for
// invented businesses, written by hand and drawn by the same trusted templates as a
// real concept. They show what each pattern looks like without any client data or
// any AI call. Checked by src/lib/pack/examples.test.ts.

export interface DesignExample {
  id: string;
  label: { en: string; ar: string };
  // A stored-design shape (format 2, design part only), drawn with renderableDesign.
  design: { format: "pack-design"; v: typeof PACK_FORMAT_VERSION; language: "en" | "ar"; blueprint: Pack["design_blueprint"]; screens: Pack["screens"]; user_flow: Pack["user_flow"] };
}

type Screen = Pack["screens"][number];
const NO_BRAND = { en: "Synthetic example: no brand material; neutral placeholders only.", ar: "مثال تجريبي: لا توجد هوية بصرية، وكل الصور مؤقتة." };

function example(id: string, label: DesignExample["label"], language: "en" | "ar", pattern: PatternId, b: { direction: string; hierarchy: string[]; responsive: string }, screens: Screen[], flow: [string, string][]): DesignExample {
  return {
    id,
    label,
    design: {
      format: "pack-design",
      v: PACK_FORMAT_VERSION,
      language,
      blueprint: { pattern, direction: b.direction, hierarchy: b.hierarchy, responsive_notes: b.responsive, brand_context: NO_BRAND[language] },
      screens,
      user_flow: flow.map(([step, screen]) => ({ step, screen })),
    },
  };
}

const sc = (id: string, template: TemplateId, title: string, purpose: string, headline: string, items: [string, string][] = [], extra: Partial<Screen> = {}): Screen => ({ id, template, title, purpose, headline, items: items.map(([t, x]) => ({ title: t, text: x })), ...extra });

export const DESIGN_EXAMPLES: DesignExample[] = [
  example(
    "service-website",
    { en: "Service website", ar: "موقع شركة خدمات" },
    "en",
    "studio_site",
    { direction: "A calm studio website that explains the services plainly and turns visits into consultation requests.", hierarchy: ["What the studio does", "Services", "How a project runs", "Request a consultation"], responsive: "Phone first: services stack and the request button stays reachable; desktop shows services three across." },
    [
      sc("s1", "hero", "Home", "Say what the studio does and invite a request.", "Interiors planned around how you live", [], { supporting_text: "Design and renovation for homes and small offices.", primary_action: "Request a consultation", secondary_action: "See services" }),
      sc("s2", "services", "Services", "Show the main services at a glance.", "What we do", [["Space planning", "Layouts that fit the way rooms are used."], ["Renovation", "Coordinating trades from start to handover."], ["Furnishing", "Selecting pieces that suit the space."]]),
      sc("s3", "how_it_works", "How it works", "Set expectations for a project.", "From first visit to handover", [["Visit", "We see the space and listen."], ["Plan", "A first direction to discuss."], ["Build", "Work coordinated and reviewed."]]),
      sc("s4", "contact_cta", "Request", "Collect a consultation request.", "Tell us about your space", [], { primary_action: "Request a consultation" }),
    ],
    [["Visitor reads what the studio does", "s1"], ["Compares services", "s2"], ["Understands how a project runs", "s3"], ["Sends a consultation request", "s4"]],
  ),
  example(
    "saas-marketing",
    { en: "SaaS marketing website", ar: "موقع تسويقي لمنتج برمجي" },
    "en",
    "saas_marketing",
    { direction: "A product website that explains one clear benefit, shows how it works and leads to a trial.", hierarchy: ["The benefit", "How it works", "Questions", "Start a trial"], responsive: "Short sections that stack on phones; the trial button repeats at the end." },
    [
      sc("s1", "hero", "Home", "State the benefit and start a trial.", "Rotas your team can actually follow", [["Shift swaps", "Staff swap shifts with approval."], ["One view", "Every location on one rota."]], { supporting_text: "Scheduling for restaurants with more than one location.", primary_action: "Start a trial" }),
      sc("s2", "value_points", "Why", "Show the main benefits.", "Built for busy kitchens", [["Fewer gaps", "See uncovered shifts early."], ["Less messaging", "Changes reach the right people."], ["Clear hours", "Hours ready for payroll."]]),
      sc("s3", "how_it_works", "How it works", "Explain the first week.", "Up and running in three steps", [["Add your team", "Import or invite staff."], ["Build the rota", "Drag shifts into place."], ["Publish", "Everyone sees their week."]]),
      sc("s4", "faq", "Questions", "Answer doubts before a trial.", "Common questions", [["Can staff use their phones?", "Yes, on any phone."], ["Can I cancel?", "Yes, at any time."]]),
    ],
    [["Reads the benefit", "s1"], ["Compares the benefits", "s2"], ["Sees how it works", "s3"], ["Checks questions and starts a trial", "s4"]],
  ),
  example(
    "marketplace",
    { en: "Marketplace website", ar: "سوق إلكتروني" },
    "en",
    "marketplace_site",
    { direction: "A marketplace that starts from a search, shows comparable providers and confirms a request clearly.", hierarchy: ["Search for a service", "Browse providers", "Confirm the request", "Questions"], responsive: "Listings become a single column on phones; the request confirmation is a full-screen sheet." },
    [
      sc("s1", "hero", "Home", "Start a search.", "Trusted help for your home", [["Checked", "Every provider is checked before listing."], ["Clear", "Requests and replies in one place."]], { supporting_text: "Cleaning, repairs and maintenance from local providers.", primary_action: "Find a provider" }),
      sc("s2", "catalogue", "Providers", "Browse and compare providers.", "Providers near you", [["Electrical repairs", "Small fixes and safety checks."], ["Deep cleaning", "Homes and offices."], ["Plumbing", "Leaks, fittings and installs."]], { primary_action: "Request a visit" }),
      sc("s3", "confirmation", "Confirm", "Confirm before sending.", "Send this request?", [["Service", "Deep cleaning"], ["When", "The date you choose"]], { supporting_text: "The provider replies before anything is booked.", primary_action: "Send request", secondary_action: "Edit details" }),
      sc("s4", "faq", "Questions", "Answer common doubts.", "Common questions", [["How are providers checked?", "Identity and references, before listing."], ["Can I change a visit?", "Yes, from your request page."]]),
    ],
    [["Visitor starts a search", "s1"], ["Compares providers", "s2"], ["Confirms the request", "s3"], ["Checks questions", "s4"]],
  ),
  example(
    "academy-website",
    { en: "Arabic academy website (right to left)", ar: "موقع أكاديمية عربي (من اليمين إلى اليسار)" },
    "ar",
    "academy_site",
    { direction: "موقع هادئ يعرّف بالمدرسة ويقود وليّ الأمر إلى التقديم أونلاين بدل الاتصال الهاتفي.", hierarchy: ["تعريف المدرسة", "المراحل الدراسية", "الأسئلة الشائعة", "التقديم أونلاين"], responsive: "الجوال أولًا، وزر التقديم ظاهر دائمًا؛ وعلى الحاسوب تظهر المراحل جنبًا إلى جنب." },
    [
      sc("s1", "hero", "الرئيسية", "تعريف المدرسة ودعوة للتقديم.", "مدرسة تهتم بكل طالب", [], { supporting_text: "كل ما يحتاجه أولياء الأمور في مكان واحد.", primary_action: "قدّم الآن", secondary_action: "تعرّف على المراحل" }),
      sc("s2", "course_list", "المراحل", "عرض المراحل الدراسية.", "المراحل الدراسية", [["رياض الأطفال", "بداية هادئة للتعلّم."], ["المرحلة الابتدائية", "أساس متين في المواد الأساسية."], ["المرحلة الإعدادية", "استعداد للمراحل التالية."]]),
      sc("s3", "faq", "الأسئلة", "الإجابة عن أكثر الأسئلة تكرارًا.", "أسئلة شائعة", [["ما مواعيد الدراسة؟", "تُعرض هنا بعد تأكيدها من المدرسة."], ["كيف أقدّم؟", "من صفحة التقديم أونلاين."]]),
      sc("s4", "contact_cta", "التقديم", "بدء طلب التقديم.", "ابدأ طلب التقديم", [], { primary_action: "قدّم الآن" }),
    ],
    [["وليّ الأمر يتعرّف على المدرسة", "s1"], ["يستعرض المراحل", "s2"], ["يقرأ الأسئلة الشائعة", "s3"], ["يبدأ التقديم أونلاين", "s4"]],
  ),
  example(
    "booking-website",
    { en: "Booking website", ar: "موقع حجز لنشاط خدمي" },
    "en",
    "booking_site",
    { direction: "A small service business site where choosing a service and a time is the main path, confirmed before booking.", hierarchy: ["Services", "Book a time", "Confirm", "Questions"], responsive: "The booking form is one column on phones with the time picker first." },
    [
      sc("s1", "services", "Services", "Choose a service.", "Treatments", [["Classic massage", "A full-body session."], ["Sports massage", "For training and recovery."], ["Facial", "A calm skin treatment."]], { primary_action: "Book" }),
      sc("s2", "booking_form", "Book", "Choose a time.", "Book your visit", [["Service", "Classic massage"], ["Day", "Choose a day"], ["Time", "Choose a time"]], { primary_action: "Continue" }),
      sc("s3", "confirmation", "Confirm", "Confirm the booking.", "Book this visit?", [["Service", "Classic massage"], ["When", "Your chosen day and time"]], { primary_action: "Confirm booking", secondary_action: "Change time" }),
    ],
    [["Chooses a service", "s1"], ["Picks a time", "s2"], ["Confirms the booking", "s3"]],
  ),
  example(
    "operational-dashboard",
    { en: "Operational dashboard", ar: "لوحة متابعة تشغيلية" },
    "en",
    "dashboard_app",
    { direction: "A dashboard that opens on what needs attention, with the trend behind it and the records one click away.", hierarchy: ["Needs attention", "Trend over time", "All records", "One record"], responsive: "Desktop first for the team; on phones the tiles stack and the chart becomes a list of measures." },
    [
      sc("s1", "overview_dashboard", "Overview", "Show what needs attention today.", "Today", [["Waiting for a driver", "Jobs not yet assigned."], ["Delayed", "Jobs past their window."], ["Delivered", "Closed today."]]),
      sc("s2", "trend_report", "Trends", "Show how delivery times change.", "Delivery times", [["On time", "Jobs delivered in their window."], ["Late", "Jobs past their window."]], { supporting_text: "Measures to watch each week; values come from your own data." }),
      sc("s3", "record_table", "Jobs", "Find any job.", "All jobs", [["Pharmacy order", "Assigned · north route"], ["Grocery order", "On the way · east route"]], { primary_action: "New job" }),
      sc("s4", "record_detail", "Job", "See one job and act on it.", "Pharmacy order", [["Pickup", "Shop on the main street"], ["Drop-off", "Customer address"], ["Driver", "Assigned"]], { primary_action: "Mark delivered", secondary_action: "Reassign" }),
    ],
    [["Team lead checks what needs attention", "s1"], ["Reviews the weekly trend", "s2"], ["Searches the list for one job", "s3"], ["Opens the job and acts", "s4"]],
  ),
  example(
    "crm-workflow",
    { en: "CRM or workflow system", ar: "نظام علاقات عملاء أو سير عمل" },
    "en",
    "crm_app",
    { direction: "A workflow system where each case has one owner and one next action, moved across clear stages.", hierarchy: ["Cases by stage", "Case list", "One case", "First use"], responsive: "On phones the board shows one stage at a time; the case page is one column." },
    [
      sc("s1", "workflow_board", "Board", "Move cases through their stages.", "Cases by stage", [["New", "Request received"], ["In review", "Owner assigned"], ["Waiting", "Client to reply"], ["Closed", "Resolved"]]),
      sc("s2", "record_table", "Cases", "Find a case.", "All cases", [["Warranty claim", "In review · owner assigned"], ["Return request", "Waiting · client to reply"]], { primary_action: "New case" }),
      sc("s3", "data_form", "New case", "Record a request.", "New case", [["Customer", "Choose or add"], ["Request", "What they need"], ["Owner", "Who takes it"]], { primary_action: "Save case" }),
      sc("s4", "empty_state", "First use", "Start an empty board.", "No cases yet", [["Add a case", "Record the first request."], ["Invite the team", "Give each case an owner."]], { supporting_text: "Cases you add appear here by stage.", primary_action: "Add a case" }),
    ],
    [["Team sees cases by stage", "s1"], ["Searches for one case", "s2"], ["Records a new request", "s3"], ["A new team starts from an empty board", "s4"]],
  ),
  example(
    "marketplace-admin",
    { en: "Marketplace administration", ar: "إدارة سوق إلكتروني" },
    "en",
    "marketplace_admin",
    { direction: "An operator back office for approving providers and keeping listings and orders healthy.", hierarchy: ["Attention", "Providers to review", "One provider", "Approve"], responsive: "Desktop first; phones show the review queue as a list." },
    [
      sc("s1", "overview_dashboard", "Overview", "What operators must act on.", "Today", [["Providers to review", "New applications"], ["Listings flagged", "Reported by customers"], ["Orders on hold", "Waiting for a provider"]]),
      sc("s2", "record_table", "Providers", "Review applications.", "Provider applications", [["Electrical repairs", "Documents received"], ["Deep cleaning", "Waiting for references"]]),
      sc("s3", "record_detail", "Provider", "Check one application.", "Electrical repairs", [["Documents", "Received"], ["References", "Checked"], ["Area", "North district"]], { primary_action: "Approve", secondary_action: "Ask for more" }),
      sc("s4", "confirmation", "Approve", "Confirm the approval.", "Approve this provider?", [["Provider", "Electrical repairs"], ["Listing", "Goes live after approval"]], { primary_action: "Approve provider", secondary_action: "Go back" }),
    ],
    [["Operator sees what needs action", "s1"], ["Opens the review queue", "s2"], ["Checks one application", "s3"], ["Approves it", "s4"]],
  ),
  example(
    "scheduling-system",
    { en: "Scheduling system", ar: "نظام مواعيد وجدولة" },
    "en",
    "scheduling_app",
    { direction: "Patients book a time in a few steps; reception runs the day from one schedule.", hierarchy: ["Pick a time", "Confirm", "The day's schedule", "One appointment"], responsive: "Patients book on phones; reception uses a desktop schedule." },
    [
      sc("s1", "booking_form", "Book", "Collect a booking.", "Book an appointment", [["Service", "Choose a service"], ["Therapist", "Any therapist"], ["Time", "Choose a time"]], { primary_action: "Continue" }),
      sc("s2", "confirmation", "Confirm", "Confirm before booking.", "Book this appointment?", [["Therapist", "Any therapist"], ["Time", "Your chosen time"]], { primary_action: "Confirm booking", secondary_action: "Change" }),
      sc("s3", "schedule_calendar", "Schedule", "Show reception the day.", "Today's schedule", [["Morning", "Booked and waiting"], ["Cancelled", "Freed slots to refill"]], { primary_action: "Add a booking" }),
      sc("s4", "record_detail", "Appointment", "Manage one appointment.", "Appointment", [["Patient", "Name and contact"], ["Status", "Confirmed"]], { primary_action: "Reschedule", secondary_action: "Cancel" }),
    ],
    [["Patient picks a time", "s1"], ["Confirms the booking", "s2"], ["Reception sees the day", "s3"], ["Reception manages one appointment", "s4"]],
  ),
  example(
    "mobile-onboarding",
    { en: "Mobile onboarding", ar: "تطبيق جوّال: البدء" },
    "en",
    "mobile_onboarding",
    { direction: "An app that gets a new member started in one screen and makes an empty start useful.", hierarchy: ["Welcome", "First steps", "Profile"], responsive: "Phone only; one task per screen with the main action at the bottom." },
    [
      sc("s1", "onboarding", "Welcome", "Explain the app in one screen.", "Your classes in one place", [["Book", "Reserve a class"], ["Follow", "See your week"]], { primary_action: "Get started" }),
      sc("s2", "empty_state", "First use", "Guide the first action.", "No classes booked yet", [["Find a class", "Browse this week's timetable."]], { supporting_text: "Classes you book appear here.", primary_action: "Find a class" }),
      sc("s3", "profile", "Profile", "Manage the member's details.", "Your profile", [["Membership", "Active"], ["Notifications", "Class reminders"]], { primary_action: "Edit profile" }),
    ],
    [["New member learns what the app does", "s1"], ["Starts from an empty week", "s2"], ["Sets up the profile", "s3"]],
  ),
  example(
    "mobile-discovery",
    { en: "Mobile discovery", ar: "تطبيق جوّال: البحث والتفاصيل" },
    "en",
    "mobile_discovery",
    { direction: "An app for finding a nearby place quickly: a home, a searchable list and a clear detail page.", hierarchy: ["Home", "Search and filter", "Detail"], responsive: "Phone only; search stays at the top, filters are chips." },
    [
      sc("s1", "home", "Home", "Start finding.", "Find a court near you", [["Near you", "Open now"], ["Favourites", "Courts you saved"]], { primary_action: "Search courts" }),
      sc("s2", "list_search", "Search", "Search and compare.", "Courts", [["Riverside courts", "Indoor · open now"], ["Park courts", "Outdoor · opens later"]], { primary_action: "Show on map" }),
      sc("s3", "detail", "Court", "See one place.", "Riverside courts", [["Opening hours", "Shown by the venue"], ["Facilities", "Changing rooms"]], { primary_action: "Get directions" }),
    ],
    [["Opens the app", "s1"], ["Searches and filters", "s2"], ["Opens a court", "s3"]],
  ),
  example(
    "mobile-transactions",
    { en: "Mobile booking and tracking", ar: "تطبيق جوّال: الحجز والمتابعة" },
    "en",
    "mobile_transactions",
    { direction: "An app to book a car wash in a few taps, confirm it and follow it until the car is ready.", hierarchy: ["Book", "Confirm", "Track", "Profile"], responsive: "Phone only; one task per screen, the main action at the bottom." },
    [
      sc("s1", "booking_order", "Book", "Choose and confirm.", "Your booking", [["Branch", "Choose a branch"], ["Service", "Exterior or full"], ["Time", "Choose a time"]], { primary_action: "Continue" }),
      sc("s2", "confirmation", "Confirm", "Confirm the booking.", "Book this wash?", [["Branch", "Your chosen branch"], ["Time", "Your chosen time"]], { primary_action: "Confirm", secondary_action: "Change" }),
      sc("s3", "tracking", "Status", "Follow the wash.", "In progress", [["Checked in", "Your car is in the queue"], ["Washing", "Being cleaned"], ["Ready", "We will let you know"]]),
      sc("s4", "profile", "Profile", "Manage cars and points.", "Your account", [["Cars", "Your saved cars"], ["Points", "Rewards waiting"]]),
    ],
    [["Books a wash", "s1"], ["Confirms it", "s2"], ["Follows it until ready", "s3"], ["Manages the account", "s4"]],
  ),
];
