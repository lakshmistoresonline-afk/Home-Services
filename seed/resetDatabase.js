const { auth, db, projectId } = require("./firebase-utils");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isConfirmed = args.includes("--confirm-wipe-production");

async function runReset() {
    console.log("=========================================================");
    console.log(" FIREBASE ADMIN SDK DYNAMIC FIRESTORE PURGE");
    console.log(` PROJECT: ${projectId}`);
    console.log(` MODE: ${isDryRun ? "DRY RUN (INSPECTION ONLY)" : isConfirmed ? "CONFIRMED PURGE" : "UNCONFIRMED"}`);
    console.log("=========================================================\n");

    if (!isDryRun && !isConfirmed) {
        console.error("❌ SAFETY GUARD TRIGGERED:");
        console.error("  Database reset against Cloud Firestore requires explicit confirmation.");
        console.error("  Please pass '--confirm-wipe-production' to execute deletion,");
        console.error("  or '--dry-run' to inspect collections safely.\n");
        process.exit(1);
    }

    const start = Date.now();

    try {
        console.log("[1/2] DISCOVERING FIRESTORE COLLECTIONS...");
        const collections = await db.listCollections();
        console.log(`Found ${collections.length} collections in Firestore project '${projectId}'.`);

        for (const colRef of collections) {
            const colName = colRef.id;
            const snap = await colRef.get();
            if (isDryRun) {
                console.log(`  [DRY RUN] Collection '${colName}': ${snap.size} documents found.`);
            } else {
                if (!snap.empty) {
                    const batch = db.batch();
                    snap.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    console.log(`  ✓ Wiped collection: ${colName} (${snap.size} docs)`);
                } else {
                    console.log(`  • Empty collection cleared: ${colName}`);
                }
            }
        }

        console.log("\n[2/2] CHECKING AUTHENTICATED USERS...");
        let pageToken;
        let totalUsers = 0;
        do {
            const listResult = await auth.listUsers(1000, pageToken);
            totalUsers += listResult.users.length;
            if (!isDryRun && listResult.users.length > 0) {
                const uids = listResult.users.map(u => u.uid);
                await auth.deleteUsers(uids);
            }
            pageToken = listResult.pageToken;
        } while (pageToken);

        if (isDryRun) {
            console.log(`  [DRY RUN] Total Auth users found: ${totalUsers}`);
        } else {
            console.log(`  ✓ Authentication wiped successfully (${totalUsers} accounts removed).`);
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`\nElapsed Time: ${elapsed} seconds`);
        console.log("=========================================================");
        console.log(isDryRun ? " DRY RUN COMPLETE - NO DATA WAS MODIFIED" : " PURGE COMPLETE - DATABASE IS CLEAN");
        console.log("=========================================================\n");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ PURGE FAILED");
        console.error(error);
        process.exit(1);
    }
}

runReset();
