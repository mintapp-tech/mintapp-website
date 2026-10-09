import { describe, expect, test } from "vitest";
import { BOARD_COLUMNS, SIMPLE_STAGES, boardColumn, dbStagesOf, isClosed, simpleStage, stageToWrite } from "./simple-stages";
import { STAGES } from "./types";

describe("the simple commercial position", () => {
  test("seven steps, Closed split into Won and Lost; every stored value maps to one of them", () => {
    expect(BOARD_COLUMNS).toEqual(["new", "reviewing", "meeting", "qualified", "proposal", "decision", "closed"]);
    expect(SIMPLE_STAGES).toContain("won");
    for (const s of STAGES) expect(SIMPLE_STAGES).toContain(simpleStage(s));
    expect(simpleStage("meeting_completed")).toBe("meeting");
    expect(simpleStage("negotiation")).toBe("decision");
    expect(simpleStage("paused")).toBe("reviewing");
    expect(simpleStage("garbage")).toBe("new");
    expect(boardColumn("won")).toBe("closed");
    expect(boardColumn("lost")).toBe("closed");
    expect(isClosed("won") && isClosed("lost") && !isClosed("qualified")).toBe(true);
  });

  test("choosing a step writes its stored value, and choosing the current step changes nothing", () => {
    expect(stageToWrite("new", "meeting")).toBe("meeting_booked");
    expect(stageToWrite("meeting_completed", "meeting")).toBeNull();
    expect(stageToWrite("proposal_sent", "proposal")).toBeNull();
    expect(stageToWrite("qualified", "decision")).toBe("negotiation");
    expect(stageToWrite("negotiation", "won")).toBe("won");
    expect(stageToWrite("paused", "reviewing")).toBeNull();
  });

  test("filtering by a step covers every stored value in it, never the legacy pause", () => {
    expect(dbStagesOf("meeting").sort()).toEqual(["meeting_booked", "meeting_completed", "meeting_ready", "preparing"]);
    expect(dbStagesOf("closed").sort()).toEqual(["lost", "won"]);
    expect(dbStagesOf("reviewing")).toEqual(["reviewing"]);
  });
});
