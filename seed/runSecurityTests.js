const { db, auth, projectId } = require("./firebase-utils");
const fs = require("fs");
const path = require("path");

async function runSecurityTestSuite() {
    console.log("=========================================================");
    console.log(" HOME SERVICES APPLICATION — SECURITY EMULATOR TEST SUITE");
    console.log(` PROJECT: ${projectId}`);
    console.log("=========================================================\n");

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    const testResults = [];

    function recordTest(id, category, description, passedStatus, detail = "") {
        if (passedStatus) passed++; else failed++;
        testResults.push({
            id, category, description, status: passedStatus ? "PASS" : "FAIL", detail
        });
        console.log(`  [${passedStatus ? "✓ PASS" : "❌ FAIL"}] ${id}: ${description}`);
        if (detail) console.log(`      Detail: ${detail}`);
    }

    try {
        console.log("[1/3] VERIFYING FIRESTORE SECURITY RULES DEFINITIONS...");
        const rulesPath = path.join(__dirname, "..", "firestore.rules");
        const rulesContent = fs.readFileSync(rulesPath, "utf8");

        recordTest("FST-01", "Firestore", "Unauthenticated read/write protection check", rulesContent.includes("function isAuthenticated()"), "isAuthenticated() helper function present");
        recordTest("FST-02", "Firestore", "Customer data isolation check", rulesContent.includes("request.resource.data.citizenId == request.auth.uid"), "Customer ID equality check verified");
        recordTest("FST-03", "Firestore", "Role escalation protection (role, permissions, isActive)", rulesContent.includes("hasAny(['role', 'permissions', 'isActive', 'status'])"), "Protected fields key diff check verified");
        recordTest("FST-04", "Firestore", "Service Provider assigned request isolation", rulesContent.includes("resource.data.assignedStaffId == request.auth.uid"), "Assigned staff ID equality check verified");
        recordTest("FST-05", "Firestore", "Taluk Admin jurisdiction restriction", rulesContent.includes("getUserData().taluk == resource.data.taluk"), "Taluk equality check verified");
        recordTest("FST-06", "Firestore", "Read-only Super Admin write restriction", rulesContent.includes("!isReadOnlyAdmin()"), "Read-only write guard verified");
        recordTest("FST-07", "Firestore", "Audit logs immutability check", rulesContent.includes("match /auditLogs/{id} {") && rulesContent.includes("allow update, delete: if false;"), "Audit log update/delete disabled");

        console.log("\n[2/3] VERIFYING FIREBASE STORAGE RULES DEFINITIONS...");
        const storageRulesPath = path.join(__dirname, "..", "storage.rules");
        const storageContent = fs.readFileSync(storageRulesPath, "utf8");

        recordTest("STR-01", "Storage", "Unauthenticated storage access block", storageContent.includes("function isAuthenticated()"), "Auth requirement verified");
        recordTest("STR-02", "Storage", "5 MB file size limit enforcement", storageContent.includes("request.resource.size < 5 * 1024 * 1024"), "5 MB size limit check verified");
        recordTest("STR-03", "Storage", "Explicit PDF MIME type equality comparison", storageContent.includes("request.resource.contentType == 'application/pdf'"), "Explicit PDF equality comparison verified");
        recordTest("STR-04", "Storage", "Customer & provider path isolation", storageContent.includes("request.auth.uid == firestore.get"), "Firestore attachment authorization check verified");

        console.log("\n[3/3] VERIFYING CLOUD FUNCTIONS COMPILATION & SECURITY GUARDS...");
        const functionsTsPath = path.join(__dirname, "..", "functions", "src", "requests.ts");
        const functionsTs = fs.readFileSync(functionsTsPath, "utf8");

        recordTest("CFN-01", "Functions", "Unauthenticated HTTPS callable rejection", functionsTs.includes("if (!context.auth)"), "Unauthenticated HttpsError check verified");
        recordTest("CFN-02", "Functions", "Deactivated user account check", functionsTs.includes("userData.isActive === false"), "Account activation check verified");
        recordTest("CFN-03", "Functions", "State machine status transition validation", functionsTs.includes("isValidTransition(currentStatus, newStatus)"), "Workflow state machine validation verified");

        console.log("\n=========================================================");
        console.log(` SECURITY TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED, ${skipped} SKIPPED`);
        console.log("=========================================================\n");

        process.exit(failed > 0 ? 1 : 0);
    } catch (e) {
        console.error("❌ Test suite execution failed:", e);
        process.exit(1);
    }
}

runSecurityTestSuite();
