// Real product screenshots for the four projects that are still shown with
// drawn compositions (Nazarih, Taskaty, TangleVibe, Kwayes).
//
// To publish screenshots for a project: put the files under
// public/work/<slug>/, list them below with English and Arabic alt text and
// their pixel size, and add a short intro that describes what the screens
// show. The homepage card then uses `cover` and the case study's "Product
// screens" section uses `screens`, both in device frames. Until then the
// existing compositions stay. Only add screens the client has approved for
// publication, and describe them accurately.

export type PendingProject = "nazarih" | "taskaty" | "tanglevibe" | "kwayes";

export interface ScreenAsset {
  src: string;
  width: number;
  height: number;
  alt: { en: string; ar: string };
}

export interface WorkScreens {
  // Replaces the "Compositions from ..." line once real screens are shown.
  intro?: { en: string; ar: string };
  cover?: ScreenAsset;
  screens: ScreenAsset[];
}

export const WORK_SCREENS: Record<PendingProject, WorkScreens> = {
  nazarih: { screens: [] },
  taskaty: { screens: [] },
  tanglevibe: { screens: [] },
  kwayes: { screens: [] },
};

export const hasRealScreens = (slug: PendingProject) => WORK_SCREENS[slug].screens.length > 0;
