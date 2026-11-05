const { auth, db, projectId } = require("./firebase-utils");

async function deleteAllCollections() {
    console.log("\n[1/2] DYNAMICALLY DISCOVERING & WIPING ALL FIRESTORE COLLECTIONS...");
    try {
        const collections = await db.listCollections();
        console.log(`Found ${collections.length} collections in Firestore project '${projectId}'.`);

        for (const colRef of collections) {
            const colName = colRef.id;
            try {
                const snap = await colRef.get();
                if (!snap.empty) {
                    const batch = db.batch();
                    snap.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    console.log(`  ✓ Wiped collection: ${colName} (${snap.size} docs)`);
                } else {
                    console.log(`  • Empty collection cleared: ${colName}`);
                }
            } catch (e) {
                console.warn(`  ! Could not clear collection ${colName}:`, e.message);
            }
        }
    } catch (e) {
        console.error("  ❌ Failed to list collections:", e.message);
        throw e;
    }
}

async function deleteAllUsers() {
    console.log("\n[2/2] DELETING ALL AUTHENTICATED USERS...");
    let totalDeleted = 0;
    try {
        let pageToken;
        do {
            const listResult = await auth.listUsers(1000, pageToken);
            if (listResult.users.length > 0) {
                const uids = listResult.users.map(u => u.uid);
                const deleteResult = await auth.deleteUsers(uids);
                totalDeleted += deleteResult.successCount;
                process.stdout.write(`  ... Deleted ${totalDeleted} users\r`);
            }
            pageToken = listResult.pageToken;
        } while (pageToken);

        console.log(`\n✓ Authentication wiped successfully (${totalDeleted} accounts removed).`);
    } catch (error) {
        console.error("\n❌ Failed to delete users:", error.message);
        throw error;
    }
}

async function runReset() {
    const start = Date.now();
    console.log("=========================================================");
    console.log(" FIREBASE ADMIN SDK DYNAMIC FIRESTORE PURGE");
    console.log(` PROJECT: ${projectId}`);
    console.log("=========================================================");

    try {
        await deleteAllCollections();
        await deleteAllUsers();

        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`\nElapsed Time: ${elapsed} seconds`);
        console.log("=========================================================");
        console.log(" PURGE COMPLETE - DATABASE IS NOW CLEAN");
        console.log("=========================================================\n");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ PURGE FAILED");
        console.error(error);
        process.exit(1);
    }
}

runReset();
