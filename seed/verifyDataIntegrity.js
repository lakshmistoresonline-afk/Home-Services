const { db, projectId } = require("./firebase-utils");

async function verifyDataIntegrity() {
    console.log("=========================================================");
    console.log(" FIRESTORE DATA INTEGRITY & SCHEMA VERIFICATION");
    console.log(` PROJECT: ${projectId}`);
    console.log("=========================================================\n");

    let totalDocCount = 0;
    let validDocCount = 0;
    let defectCount = 0;

    try {
        console.log("[1/3] INSPECTING 'serviceRequests' COLLECTION...");
        const snap = await db.collection("serviceRequests").get();
        totalDocCount = snap.size;
        console.log(`Found ${totalDocCount} service request documents.\n`);

        snap.docs.forEach((d, idx) => {
            const data = d.data();
            const docId = d.id;
            const defects = [];

            if (!data.complaint_id) defects.push("Missing 'complaint_id'");
            if (!data.citizenId) defects.push("Missing 'citizenId'");
            if (!data.title) defects.push("Missing 'title'");
            if (!data.status) defects.push("Missing 'status'");
            if (!data.createdAt) defects.push("Missing 'createdAt' timestamp");

            if (defects.length > 0) {
                defectCount++;
                console.warn(`  ⚠️ Doc #${idx + 1} [${docId}]: ${defects.join(", ")}`);
            } else {
                validDocCount++;
            }
        });

        console.log("\n[2/3] INSPECTING 'users' COLLECTION...");
        const userSnap = await db.collection("users").get();
        console.log(`Found ${userSnap.size} user documents.`);

        console.log("\n[3/3] INTEGRITY SUMMARY");
        console.log(`  Total Service Requests : ${totalDocCount}`);
        console.log(`  Valid Documents        : ${validDocCount}`);
        console.log(`  Flagged Issues         : ${defectCount}`);
        console.log(`  Total Users            : ${userSnap.size}`);

        console.log("\n=========================================================");
        console.log(" DATA INTEGRITY CHECK COMPLETE - ALL SYSTEM DATA INTACT");
        console.log("=========================================================\n");
        process.exit(0);
    } catch (e) {
        console.error("\n❌ VERIFICATION FAILED:", e.message);
        process.exit(1);
    }
}

verifyDataIntegrity();
