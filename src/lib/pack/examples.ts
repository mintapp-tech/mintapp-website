import type { DesignArtifact } from "./schema";
import { PACK_FORMAT_VERSION } from "./schema";

// SYNTHETIC example designs for the internal design library page: invented
// businesses, written by hand, drawn by the same trusted templates as a real
// initial design. They show reviewers what each kind of pattern looks like
// without any client data or any AI call. Checked by src/lib/pack/examples.test.ts.

export interface DesignExample {
  id: string;
  label: { en: string; ar: string };
  design: DesignArtifact;
}

const design = (language: "en" | "ar", d: Omit<DesignArtifact, "format" | "v" | "language">): DesignArtifact => ({ format: "pack-design", v: PACK_FORMAT_VERSION, language, ...d });

export const DESIGN_EXAMPLES: DesignExample[] = [
  {
    id: "service-website",
    label: { en: "Service website", ar: "موقع شركة خدمات" },
    design: design("en", {
      blueprint: {
        pattern: "studio_site",
        audience: "Homeowners and small offices planning a renovation",
        primary_goal: "Explain the studio's services and turn visits into consultation requests",
        hierarchy: ["What the studio does", "Services", "How a project runs", "Request a consultation"],
        responsive_notes: "Phone first: services stack, the request button stays reachable.",
        brand_context: "Synthetic example: no brand material; neutral placeholders only.",
      },
      screens: [
        { id: "s1", template: "hero", title: "Home", purpose: "Say what the studio does and invite a request.", headline: "Interiors planned around how you live", supporting_text: "Design and renovation for homes and small offices.", items: [], primary_action: "Request a consultation", secondary_action: "See services" },
        { id: "s2", template: "services", title: "Services", purpose: "Show the main services at a glance.", headline: "What we do", items: [{ title: "Space planning", text: "Layouts that fit the way rooms are used." }, { title: "Renovation", text: "Coordinating trades from start to handover." }, { title: "Furnishing", text: "Selecting pieces that suit the space." }] },
        { id: "s3", template: "how_it_works", title: "How it works", purpose: "Set expectations for a project.", headline: "From first visit to handover", items: [{ title: "Visit", text: "We see the space and listen." }, { title: "Plan", text: "A first direction to discuss." }, { title: "Build", text: "Work coordinated and reviewed." }] },
        { id: "s4", template: "contact_cta", title: "Request", purpose: "Collect a consultation request.", headline: "Tell us about your space", items: [], primary_action: "Request a consultation" },
      ],
      user_flow: [
        { step: "Visitor reads what the studio does", screen: "s1" },
        { step: "Compares services", screen: "s2" },
        { step: "Understands how a project runs", screen: "s3" },
        { step: "Sends a consultation request", screen: "s4" },
      ],
    }),
  },
  {
    id: "marketplace",
    label: { en: "Marketplace", ar: "سوق إلكتروني" },
    design: design("en", {
      blueprint: {
        pattern: "marketplace_site",
        audience: "Households looking for trusted home-service providers",
        primary_goal: "Help visitors find a provider and request a visit",
        hierarchy: ["Search for a service", "Browse providers", "How booking works", "Questions"],
        responsive_notes: "Listings become a single column on phones.",
        brand_context: "Synthetic example: no brand material; neutral placeholders only.",
      },
      screens: [
        { id: "s1", template: "hero", title: "Home", purpose: "Start a search.", headline: "Trusted help for your home", supporting_text: "Cleaning, repairs and maintenance from vetted providers.", items: [{ title: "Vetted", text: "Every provider is checked." }, { title: "Clear", text: "Requests and replies in one place." }], primary_action: "Find a provider" },
        { id: "s2", template: "catalogue", title: "Providers", purpose: "Browse and compare providers.", headline: "Providers near you", items: [{ title: "Electrical repairs", text: "Small fixes and safety checks." }, { title: "Deep cleaning", text: "Homes and offices." }, { title: "Plumbing", text: "Leaks, fittings and installs." }], primary_action: "Request a visit" },
        { id: "s3", template: "how_it_works", title: "How it works", purpose: "Explain the request flow.", headline: "Book in three steps", items: [{ title: "Choose", text: "Pick a service and provider." }, { title: "Request", text: "Describe the job." }, { title: "Confirm", text: "Agree a visit time." }] },
        { id: "s4", template: "faq", title: "Questions", purpose: "Answer common doubts.", headline: "Common questions", items: [{ title: "How are providers checked?", text: "Identity and references, before listing." }, { title: "Can I change a visit?", text: "Yes, from your request page." }] },
      ],
      user_flow: [
        { step: "Visitor starts a search", screen: "s1" },
        { step: "Compares providers", screen: "s2" },
        { step: "Learns how requests work", screen: "s3" },
        { step: "Checks questions before requesting", screen: "s4" },
      ],
    }),
  },
  {
    id: "operations-dashboard",
    label: { en: "Operations dashboard", ar: "لوحة تشغيل" },
    design: design("en", {
      blueprint: {
        pattern: "operations_app",
        audience: "A dispatch team moving delivery jobs through their stages",
        primary_goal: "See what needs attention and move each job to its next stage",
        hierarchy: ["Today's attention points", "Jobs by stage", "All jobs", "One job in detail"],
        responsive_notes: "Desktop first for the team; phones show one stage at a time.",
        brand_context: "Synthetic example: no brand material; neutral placeholders only.",
      },
      screens: [
        { id: "s1", template: "overview_dashboard", title: "Overview", purpose: "Show what needs attention today.", headline: "Today", items: [{ title: "Waiting for a driver", text: "Jobs not yet assigned." }, { title: "Delayed", text: "Jobs past their window." }, { title: "Delivered", text: "Closed today." }] },
        { id: "s2", template: "workflow_board", title: "Board", purpose: "Move jobs through their stages.", headline: "Jobs by stage", items: [{ title: "New", text: "Order from a shop" }, { title: "Assigned", text: "Driver confirmed" }, { title: "On the way", text: "Picked up" }, { title: "Delivered", text: "Signed for" }] },
        { id: "s3", template: "record_table", title: "Jobs", purpose: "Find any job.", headline: "All jobs", items: [{ title: "Pharmacy order", text: "Assigned · north route" }, { title: "Grocery order", text: "On the way · east route" }], primary_action: "New job" },
        { id: "s4", template: "record_detail", title: "Job", purpose: "See one job and act on it.", headline: "Pharmacy order", items: [{ title: "Pickup", text: "Shop on the main street" }, { title: "Drop-off", text: "Customer address" }, { title: "Driver", text: "Assigned" }], primary_action: "Mark delivered", secondary_action: "Reassign" },
      ],
      user_flow: [
        { step: "Team lead checks what needs attention", screen: "s1" },
        { step: "Moves jobs on the board", screen: "s2" },
        { step: "Searches the list for one job", screen: "s3" },
        { step: "Opens the job and acts", screen: "s4" },
      ],
    }),
  },
  {
    id: "booking-application",
    label: { en: "Booking application", ar: "تطبيق حجز مواعيد" },
    design: design("en", {
      blueprint: {
        pattern: "scheduling_app",
        audience: "Clinic patients and the receptionists who manage the day",
        primary_goal: "Let patients book a time and give reception a clear daily schedule",
        hierarchy: ["Pick a time", "Patient details", "The day's schedule", "One appointment"],
        responsive_notes: "Patients book on phones; reception uses a desktop schedule.",
        brand_context: "Synthetic example: no brand material; neutral placeholders only.",
      },
      screens: [
        { id: "s1", template: "booking_form", title: "Book", purpose: "Collect a booking.", headline: "Book an appointment", items: [{ title: "Service", text: "Choose a service" }, { title: "Therapist", text: "Any therapist" }, { title: "Time", text: "Choose a time" }], primary_action: "Confirm booking" },
        { id: "s2", template: "schedule_calendar", title: "Schedule", purpose: "Show reception the day.", headline: "Today's schedule", items: [{ title: "Morning", text: "Booked and waiting" }, { title: "Cancelled", text: "Freed slots to refill" }], primary_action: "Add a booking" },
        { id: "s3", template: "record_detail", title: "Appointment", purpose: "Manage one appointment.", headline: "Appointment", items: [{ title: "Patient", text: "Name and phone" }, { title: "Status", text: "Confirmed" }], primary_action: "Reschedule", secondary_action: "Cancel" },
      ],
      user_flow: [
        { step: "Patient books a time", screen: "s1" },
        { step: "Reception sees the day", screen: "s2" },
        { step: "Reception manages one appointment", screen: "s3" },
      ],
    }),
  },
  {
    id: "mobile-application",
    label: { en: "Mobile application", ar: "تطبيق جوّال" },
    design: design("en", {
      blueprint: {
        pattern: "mobile_app",
        audience: "Car owners booking washes and collecting loyalty rewards",
        primary_goal: "Book a wash in a few taps and follow it until it is ready",
        hierarchy: ["Welcome", "Nearby branches", "Book", "Track"],
        responsive_notes: "Phone only; one task per screen, the main action at the bottom.",
        brand_context: "Synthetic example: no brand material; neutral placeholders only.",
      },
      screens: [
        { id: "s1", template: "onboarding", title: "Welcome", purpose: "Explain the app in one screen.", headline: "Book a wash in seconds", items: [{ title: "Book", text: "Pick a branch and time" }, { title: "Earn", text: "Points on every visit" }], primary_action: "Get started" },
        { id: "s2", template: "home", title: "Home", purpose: "Start a booking.", headline: "Hello", items: [{ title: "Nearest branch", text: "Open now" }, { title: "Your points", text: "Rewards waiting" }], primary_action: "Book a wash" },
        { id: "s3", template: "booking_order", title: "Book", purpose: "Choose and confirm.", headline: "Your booking", items: [{ title: "Branch", text: "Choose a branch" }, { title: "Service", text: "Exterior or full" }, { title: "Time", text: "Choose a time" }], primary_action: "Confirm" },
        { id: "s4", template: "tracking", title: "Status", purpose: "Follow the wash.", headline: "In progress", items: [{ title: "Checked in", text: "Your car is in the queue" }, { title: "Washing", text: "Being cleaned" }, { title: "Ready", text: "We will let you know" }] },
      ],
      user_flow: [
        { step: "New user learns what the app does", screen: "s1" },
        { step: "Starts from home", screen: "s2" },
        { step: "Books a wash", screen: "s3" },
        { step: "Follows it until ready", screen: "s4" },
      ],
    }),
  },
  {
    id: "arabic-website",
    label: { en: "Arabic website (right to left)", ar: "موقع عربي (من اليمين إلى اليسار)" },
    design: design("ar", {
      blueprint: {
        pattern: "academy_site",
        audience: "أولياء الأمور الباحثون عن مدرسة خاصة",
        primary_goal: "عرض معلومات المدرسة وإتاحة التقديم أونلاين بدل الاستفسارات الهاتفية",
        hierarchy: ["تعريف المدرسة", "المراحل الدراسية", "الأسئلة الشائعة", "التقديم أونلاين"],
        responsive_notes: "الجوال أولًا؛ زر التقديم ظاهر دائمًا.",
        brand_context: "مثال تجريبي: لا توجد هوية بصرية، وكل الصور مؤقتة.",
      },
      screens: [
        { id: "s1", template: "hero", title: "الرئيسية", purpose: "تعريف المدرسة ودعوة للتقديم.", headline: "مدرسة تهتم بكل طالب", supporting_text: "كل ما يحتاجه أولياء الأمور في مكان واحد.", items: [], primary_action: "قدّم الآن", secondary_action: "تعرّف على المراحل" },
        { id: "s2", template: "course_list", title: "المراحل", purpose: "عرض المراحل الدراسية.", headline: "المراحل الدراسية", items: [{ title: "رياض الأطفال", text: "بداية هادئة للتعلّم." }, { title: "المرحلة الابتدائية", text: "أساس متين في المواد الأساسية." }, { title: "المرحلة الإعدادية", text: "استعداد للمراحل التالية." }] },
        { id: "s3", template: "faq", title: "الأسئلة", purpose: "الإجابة عن أكثر الأسئلة تكرارًا.", headline: "أسئلة شائعة", items: [{ title: "ما مواعيد الدراسة؟", text: "تُعرض هنا بعد تأكيدها من المدرسة." }, { title: "كيف أقدّم؟", text: "من صفحة التقديم أونلاين." }] },
        { id: "s4", template: "contact_cta", title: "التقديم", purpose: "بدء طلب التقديم.", headline: "ابدأ طلب التقديم", items: [], primary_action: "قدّم الآن" },
      ],
      user_flow: [
        { step: "وليّ الأمر يتعرّف على المدرسة", screen: "s1" },
        { step: "يستعرض المراحل", screen: "s2" },
        { step: "يقرأ الأسئلة الشائعة", screen: "s3" },
        { step: "يبدأ التقديم أونلاين", screen: "s4" },
      ],
    }),
  },
];
