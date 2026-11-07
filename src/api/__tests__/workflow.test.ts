import { isValidTransition, WORKFLOW_MAP } from "../workflowApi";

describe("Workflow State Machine Tests", () => {
  test("Valid transition: Submitted -> Assigned", () => {
    expect(isValidTransition("Submitted", "Assigned")).toBe(true);
  });

  test("Valid transition: Assigned -> Accepted", () => {
    expect(isValidTransition("Assigned", "Accepted")).toBe(true);
  });

  test("Valid transition: In Progress -> Resolved", () => {
    expect(isValidTransition("In Progress", "Resolved")).toBe(true);
  });

  test("Valid transition: Resolved -> Closed", () => {
    expect(isValidTransition("Resolved", "Closed")).toBe(true);
  });

  test("Invalid transition: Submitted -> Resolved directly", () => {
    expect(isValidTransition("Submitted", "Resolved")).toBe(false);
  });

  test("Closed status is terminal with no next transitions", () => {
    expect(WORKFLOW_MAP["Closed"]).toEqual([]);
  });
});
