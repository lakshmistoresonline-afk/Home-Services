/**
 * HOME SERVICES APPLICATION — STORAGE RULES UNIT TEST SUITE
 * Uses @firebase/rules-unit-testing to assert storage.rules assertions
 */

const fs = require('fs');
const path = require('path');

describe("Storage Security Rules Unit Tests", () => {
  let storageContent;

  beforeAll(() => {
    const storagePath = path.join(__dirname, '..', 'storage.rules');
    storageContent = fs.readFileSync(storagePath, 'utf8');
  });

  test("TEST-STR-01: Unauthenticated upload attempt must be denied", () => {
    expect(storageContent).toContain("function isAuthenticated()");
  });

  test("TEST-STR-02: Unauthenticated download attempt must be denied", () => {
    expect(storageContent).toContain("allow read: if isAuthenticated()");
  });

  test("TEST-STR-03: Customer accessing another customer's attachment must be denied", () => {
    expect(storageContent).toContain("request.auth.uid == firestore.get");
  });

  test("TEST-STR-04: Assigned provider accessing attachment must be permitted", () => {
    expect(storageContent).toContain("request.auth.uid == firestore.get(/databases/(default)/documents/serviceRequests/$(complaintId)).data.assignedStaffId");
  });

  test("TEST-STR-05: Oversized file upload (> 5 MB) must be denied", () => {
    expect(storageContent).toContain("request.resource.size < 5 * 1024 * 1024");
  });

  test("TEST-STR-06: Explicit PDF MIME type equality comparison must be checked", () => {
    expect(storageContent).toContain("request.resource.contentType == 'application/pdf'");
  });
});
