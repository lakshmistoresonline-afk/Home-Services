const { auth, db, storage, projectId, serviceAccountPath } = require("./firebase-utils");
const firebaseTools = require("firebase-tools");

/**
 * Deep Deletion of Firestore Data
 */
async function deleteAllFirestore() {
    console.log("\n[1/3] DELETING FIRESTORE DATA...");
    try {
        await firebaseTools.firestore.delete(null, {
            project: projectId,
            recursive: true,
            allCollections: true,
            force: true,
            credential: serviceAccountPath
        });
        console.log("✓ All Firestore collections and documents cleared.");
    } catch (error) {
        console.error("❌ Failed to delete Firestore:", error.message);
        throw error;
    }
}

/**
 * Complete Wipe of Firebase Authentication Users
 */
async function deleteAllUsers() {
    console.log("\n[2/3] DELETING AUTHENTICATED USERS...");
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

                if (deleteResult.failureCount > 0) {
                    console.warn(`\n  ! Warning: ${deleteResult.failureCount} users could not be deleted.`);
                }
            }
            pageToken = listResult.pageToken;
        } while (pageToken);

        console.log(`\n✓ Authentication wiped successfully (${totalDeleted} accounts removed).`);
    } catch (error) {
        console.error("\n❌ Failed to delete users:", error.message);
        throw error;
    }
}

/**
 * Empty all files from Firebase Storage
 */
async function deleteAllStorage() {
    console.log("\n[3/3] DELETING STORAGE FILES...");
    try {
        const [buckets] = await storage.getBuckets();
        for (const bucket of buckets) {
            console.log(`  Cleaning bucket: ${bucket.name}...`);
            // deleteFiles deletes all files in the bucket
            await bucket.deleteFiles();
        }
        console.log("✓ All storage buckets emptied.");
    } catch (error) {
        // Storage might not be enabled or initialized, we treat this as a non-fatal warning
        console.warn("  ! Note: Could not clear storage (it might be empty or not enabled).", error.message);
    }
}

async function runReset() {
    const start = Date.now();
    console.log("=========================================================");
    console.log(" FIREBASE FULL SYSTEM PURGE");
    console.log(` PROJECT: ${projectId}`);
    console.log("=========================================================");

    try {
        await deleteAllFirestore();
        await deleteAllUsers();
        await deleteAllStorage();

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
