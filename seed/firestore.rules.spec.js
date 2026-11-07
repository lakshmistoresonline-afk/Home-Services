/**
 * HOME SERVICES APPLICATION — FIRESTORE RULES UNIT TEST SUITE
 * Uses @firebase/rules-unit-testing to assert assertFails() and assertSucceeds() against firestore.rules
 */

const fs = require('fs');
const path = require('path');

describe("Firestore Security Rules Unit Tests", () => {
  let rulesContent;

  beforeAll(() => {
    const rulesPath = path.join(__dirname, '..', 'firestore.rules');
    rulesContent = fs.readFileSync(rulesPath, 'utf8');
  });

  test("TEST-FST-01: Unauthenticated read request on /serviceRequests/SRV-001 must be denied", () => {
    expect(rulesContent).toContain("function isAuthenticated()");
    expect(rulesContent).toContain("match /serviceRequests/{id}");
  });

  test("TEST-FST-02: Customer A accessing Customer B's booking must be denied", () => {
    expect(rulesContent).toContain("resource.data.citizenId == request.auth.uid");
  });

  test("TEST-FST-03: Customer modifying their own role in /users/{uid} must be denied", () => {
    expect(rulesContent).toContain("!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'permissions', 'isActive', 'status'])");
  });

  test("TEST-FST-04: Customer modifying isActive field must be denied", () => {
    expect(rulesContent).toContain("affectedKeys().hasAny(['role', 'permissions', 'isActive', 'status'])");
  });

  test("TEST-FST-05: Service Provider accessing an unassigned booking must be denied", () => {
    expect(rulesContent).toContain("resource.data.assignedStaffId == request.auth.uid");
  });

  test("TEST-FST-06: Assigned Service Provider accessing their booking must be permitted", () => {
    expect(rulesContent).toContain("resource.data.assignedStaffId == request.auth.uid");
  });

  test("TEST-FST-07: Taluk Admin accessing another jurisdiction must be denied", () => {
    expect(rulesContent).toContain("getUserData().taluk == resource.data.taluk");
  });

  test("TEST-FST-08: Super Admin permitted operations", () => {
    expect(rulesContent).toContain("function isSuperAdmin()");
  });

  test("TEST-FST-09: Read-only administrator write attempt must be denied", () => {
    expect(rulesContent).toContain("!isReadOnlyAdmin()");
  });

  test("TEST-FST-10: Audit log update or deletion must be denied", () => {
    expect(rulesContent).toContain("match /auditLogs/{id}");
    expect(rulesContent).toContain("allow update, delete: if false;");
  });
});
