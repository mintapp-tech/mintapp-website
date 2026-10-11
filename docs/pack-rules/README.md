# Pack rules for manual preparation with Claude

The canonical rules Claude Code reads before creating or changing a Mintapp
Pre-meeting Pack by hand. Automated preparation and manual preparation produce the
same Pack format and pass the same validator; the Direction Pack (the client
presentation) is drawn only from approved versions of it.

## Read in this order

1. **This file**: the workflow, client-data handling and the approval rules.
2. **`library.md`**: the Pack's seventeen sections and their bases, what the validator
   refuses, the design library (foundations, components, product patterns, templates),
   proposal patterns, discovery banks, quality rules, the review rubric and the approval
   checklist. *Generated from `src/lib/pack`; do not edit.*
3. **`instructions.md`**: the exact instructions automation uses, in English and Arabic.
   *Generated; do not edit.*
4. **`pack.schema.json`**: the exact JSON shape. *Generated; do not edit.*

`library.md`, `instructions.md` and `pack.schema.json` are produced by
`npm run pack:rules` from the application's own modules, and a test fails if they are
out of date, so the code is the one source of truth. To change a rule, change the code
(`src/lib/pack/library/*`, `src/lib/pack/schema.ts`, `src/lib/pack/prompt.ts`), then
regenerate.

## The workflow

1. **Start a private workspace** outside the repository (never in it):

   ```text
   npm run pack:workspace -- --id <lead id> --client "<ascii label>" --project "<ascii label>"
   ```

   It creates `C:\Journey\Mint\mintapp-client-work\<internal-id>-<client-slug>-<project-slug>\`
   with `source/brief.md`, `source/assets/`, `working/`, `approved/`, `exports/` and
   `notes/`. The internal id is the first 8 characters of the lead's id. Labels are
   lowercase ASCII words a founder chooses: a company or a neutral label, never a
   person's name, email or phone. `--dry-run` shows the folder without creating it.

2. **Copy the brief**: on the lead's Pre-meeting Pack tab, copy the prompt and paste only
   its "Client brief" text into `source/brief.md`. Contact details are already removed.

3. **Prepare** `working/pack-draft.json` (and, if useful, `working/analysis.json`)
   following `instructions.md` and `library.md`: one JSON object, in the brief's
   language, every client fact with an exact quote from the brief, every other statement
   an assumption, a recommendation or a question, library ids only, no figure the client
   did not state, no promise, no invented proof, no placeholder text.

4. **Check** it with the application's validator before importing:

   ```text
   npm run pack:check -- "<workspace folder>"
   ```

   It prints only the kind of each problem, never the content.

5. **Import**: when it passes and both founders agree, copy it to `approved/pack.json`
   and paste it on the Pack tab ("Paste Claude's reply"). The application checks it
   again and saves the three working areas as new versions.

6. **Review and approve** in the application: each part is approved by the founder who
   did not write it, after confirming the approval checklist. Edits are made in the
   Pack tab's editor, always as a new version.

7. **Present and export**: once all three parts are approved, open the Direction Pack,
   present it, and export the PDF (16:9 or A4) from the browser's print dialog into the
   workspace's `exports/`.

## Client-data handling

- Client workspaces never enter the repository, a shared drive, an issue tracker or a
  chat other than the founders' own Claude session. `.gitignore` also ignores any
  `mintapp-client-work/` folder as a second safeguard.
- No passwords, API keys or tokens in any workspace file.
- Never add the client's email address, phone number or other contact details to a
  working file or the Pack; the copied brief already has them removed.
- Real client briefs are not sent to an automated AI service until the founders have
  explicitly approved that service for client data.
- The Pack is internal until approved; the Direction Pack is the only thing a client
  sees, and only in the meeting or as the exported PDF.

## What stays out of a Pack

The final proposal and Scope of Work. Price, timeline and commitments depend on
discovery: they are written after the meeting on the lead's Deal tab, versioned and
approved separately. The Pack's proposal direction is always indicative.

## A Claude command or skill

A Claude Code command could run this workflow, but it would only call the scripts above
and point at these files. It must not copy any rule into itself.
