const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getSecurityRules } = require("firebase-admin/security-rules");
const fs = require("fs");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
const serviceAccount = require(serviceAccountPath);

if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

async function deployRules() {
    console.log("=================================================");
    console.log(" DEPLOYING FIRESTORE SECURITY RULES VIA ADMIN SDK");
    console.log(" PROJECT:", serviceAccount.project_id);
    console.log("=================================================\n");

    const rulesPath = path.join(__dirname, "..", "firestore.rules");
    const rulesContent = fs.readFileSync(rulesPath, "utf8");

    try {
        const securityRules = getSecurityRules();
        const firestoreFile = securityRules.createRulesFileFromSource("firestore.rules", rulesContent);

        console.log("Creating new ruleset from firestore.rules...");
        const ruleset = await securityRules.createRuleset(firestoreFile);
        console.log(`✓ Ruleset created: ${ruleset.name}`);

        console.log("Releasing ruleset to Cloud Firestore backend...");
        await securityRules.releaseFirestoreRuleset(ruleset.name);
        console.log("=================================================");
        console.log(" ✓ FIRESTORE SECURITY RULES DEPLOYED SUCCESSFULLY!");
        console.log("=================================================");
    } catch (e) {
        console.error("❌ Failed to deploy Firestore rules:", e);
        process.exit(1);
    }
}

deployRules();
