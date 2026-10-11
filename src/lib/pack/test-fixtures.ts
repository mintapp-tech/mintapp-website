import type { Pack } from "./schema";

// A valid Pre-meeting Pack for the synthetic clinic brief (SYNTHETIC_BRIEFS[0]),
// for tests only. Synthetic content; no real client.
export const clinicPack = (over: Partial<Pack> = {}): Pack => ({
  language: "en",
  client_facts: [
    { text: "Bookings happen by phone.", evidence: "Patients book by phone" },
    { text: "Schedules are kept in Google Sheets.", evidence: "We already use Google Sheets for schedules." },
    { text: "The system must work in Arabic.", evidence: "It must work in Arabic." },
  ],
  assumptions: [{ text: "Receptionists will manage the schedule.", reason: "They see the day's schedule today." }],
  missing_information: ["How cancellations are handled today"],
  business_context: [
    { text: "Three physiotherapy clinics in Cairo.", basis: "client_fact", evidence: "We run three physiotherapy clinics in Cairo." },
    { text: "The clinics share their receptionists' scheduling work.", basis: "assumption" },
  ],
  users: [
    { group: "Patients", needs: "Pick a therapist and a time without calling.", basis: "client_fact", evidence: "patients pick a therapist and time" },
    { group: "Receptionists", needs: "See the day's schedule across the clinics.", basis: "client_fact", evidence: "our receptionists see the day's schedule" },
  ],
  problem: [{ text: "Cancellations get lost because bookings happen by phone.", basis: "client_fact", evidence: "we lose track of cancellations" }],
  goals: [{ text: "An online booking system for patients.", basis: "client_fact", evidence: "We want an online booking system" }],
  design_blueprint: {
    pattern: "scheduling_app",
    direction: "A booking flow for patients on phones and one shared daily schedule for receptionists.",
    hierarchy: ["Available times first", "Therapist choice second", "Clinic information last"],
    responsive_notes: "Patients book on phones; receptionists use a desktop schedule.",
    brand_context: "No brand material is mentioned in the brief.",
  },
  screens: [
    { id: "s1", template: "booking_form", title: "Book a session", purpose: "A patient picks a therapist and a time.", headline: "Book your next session", items: [{ title: "Therapist", text: "Choose who you will see." }, { title: "Time", text: "Pick an open slot." }], primary_action: "Confirm booking" },
    { id: "s2", template: "schedule_calendar", title: "Today's schedule", purpose: "Receptionists see and adjust the day.", headline: "Today across the clinics", items: [{ title: "Morning", text: "Booked and open sessions." }], primary_action: "Add a booking" },
  ],
  user_flow: [
    { step: "A patient chooses a therapist and a time.", screen: "s1" },
    { step: "The receptionist sees the booking on the day's schedule.", screen: "s2" },
  ],
  scope_direction: {
    first_release: ["Patient booking by therapist and time", "A daily schedule for receptionists", "Arabic interface"],
    later: ["Reminders before a session"],
    not_included: ["Payments", "Medical records"],
  },
  proposal_direction: {
    pattern: "web_app",
    approach: "Start with booking and the shared schedule, the two places where cancellations get lost today.",
    phases: [{ name: "First release", summary: "Booking and the daily schedule." }],
    deliverables: ["Designs for the booking and schedule screens", "A working web application"],
    cost_schedule_factors: ["How cancellations and reminders should work", "Whether the Google Sheets data must be imported"],
  },
  discovery_questions: [
    { question: "How are cancellations handled today?", purpose: "Design the cancellation flow.", bank: "operations" },
    { question: "Should therapists see their own schedules?", purpose: "Decide the roles.", bank: "roles_permissions" },
    { question: "Is the Google Sheets data needed in the new system?", purpose: "Scope any import.", bank: "integrations" },
  ],
  decisions_needed: ["Who can cancel a booking"],
  risks: [{ risk: "Receptionists may keep the spreadsheet in parallel.", why: "The current habit is the spreadsheet." }],
  meeting_agenda: [
    { item: "How booking works today", purpose: "Confirm the problem." },
    { item: "The first release", purpose: "Agree the next step." },
  ],
  next_steps: ["Confirm the booking rules after the meeting."],
  ...over,
});
