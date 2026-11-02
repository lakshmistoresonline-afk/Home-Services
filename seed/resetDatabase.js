const { auth, db, projectId } = require("./firebase-utils");

async function deleteAllCollections() {
    console.log("\n[1/2] CLEARING FIRESTORE COLLECTIONS...");
    const collections = [
        'serviceRequests', 'complaints', 'users', 'departments',
        'taluks', 'wards', 'complaintCategories', 'timeline',
        'attachments', 'comments', 'notifications', 'auditLogs',
        'roles', 'permissions', 'slaRules', 'notificationTemplates',
        'dashboardConfigurations', 'reportConfigurations'
    ];

    for (const col of collections) {
        try {
            const snap = await db.collection(col).get();
            if (!snap.empty) {
                const batch = db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`  ✓ Cleared collection: ${col} (${snap.size} docs)`);
            }
        } catch (e) {
            console.warn(`  ! Could not clear ${col}:`, e.message);
        }
    }
}

async function deleteAllUsers() {
    console.log("\n[2/2] DELETING AUTHENTICATED USERS...");
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
    console.log(" FIREBASE ADMIN SDK SYSTEM PURGE");
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
