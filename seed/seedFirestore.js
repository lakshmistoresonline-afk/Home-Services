const { db, auth } = require("./firebase-utils");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");

const applicationSettings = require("./applicationSettings.json");
const systemSettings = require("./systemSettings.json");
const roles = require("./roles.json");
const permissions = require("./permissions.json");
const departments = require("./departments.json");
const taluks = require("./taluks.json");
const categories = require("./complaintCategories.json");
const priorities = require("./complaintPriorities.json");
const statuses = require("./complaintStatuses.json");
const workflowRules = require("./workflowRules.json");
const slaRules = require("./slaRules.json");
const notificationTemplates = require("./notificationTemplates.json");
const superAdmins = require("./superAdmin.json");
const readonlyAdmins = require("./readonlyAdmin.json");
const talukAdmins = require("./talukAdmins.json");
const staff = require("./staff.json");
const citizens = require("./citizens.json");
const serviceRequests = require("./serviceRequests.json");
const timeline = require("./timeline.json");
const attachments = require("./attachments.json");
const comments = require("./comments.json");
const notifications = require("./notifications.json");
const auditLogs = require("./auditLogs.json");
const dashboardConfigs = require("./dashboardConfigurations.json");
const reportConfigs = require("./reportConfigurations.json");
const searchConfigs = require("./searchConfigurations.json");

function getRolePassword(role) {
    switch (role) {
        case 'super_admin': return 'Super@123';
        case 'readonly_super_admin': return 'Audit@123';
        case 'taluk_admin': return 'Admin@123';
        case 'staff': return 'Staff@123';
        case 'citizen': return 'User@123';
        default: return 'User@123';
    }
}

async function seedCollection(collectionName, data, idField = "id", createAuth = false) {
    process.stdout.write(`${collectionName.padEnd(25, ".")} `);
    const bulkWriter = db.bulkWriter();
    let count = 0;

    for (const item of data) {
        count++;
        const id = item[idField]?.toString() || db.collection(collectionName).doc().id;
        const ref = db.collection(collectionName).doc(id);

        if (createAuth && item.email) {
            try {
                const password = getRolePassword(item.role);
                const displayName = item.fullName || item.name;

                try {
                    await auth.createUser({
                        uid: id,
                        email: item.email,
                        password: password,
                        displayName: displayName,
                    });
                } catch (e) {
                    if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
                        await auth.updateUser(id, {
                            displayName: displayName,
                            email: item.email
                        }).catch(() => {});
                    } else {
                        throw e;
                    }
                }
            } catch (error) {
                console.error(`\n  ! Failed to sync auth for ${item.email}:`, error.message);
            }
        }

        const preparedData = {
            ...item,
            createdAt: item.createdAt ? Timestamp.fromDate(new Date(item.createdAt)) : FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (item.resolvedAt) {
            preparedData.resolvedAt = Timestamp.fromDate(new Date(item.resolvedAt));
        }

        if (item.slaDueAt) {
            preparedData.slaDueAt = Timestamp.fromDate(new Date(item.slaDueAt));
        }

        bulkWriter.set(ref, preparedData);
    }

    await bulkWriter.close();
    console.log("Done");
}

async function seedSettings() {
    process.stdout.write("Settings & Metadata ...... ");
    const settingsRef = db.collection("settings");
    await settingsRef.doc("application").set(applicationSettings);
    await settingsRef.doc("system").set(systemSettings);
    await settingsRef.doc("workflow").set(workflowRules);
    await settingsRef.doc("search").set(searchConfigs);

    const metadataRef = db.collection("metadata");
    await metadataRef.doc("app").set({
        ...applicationSettings,
        ...systemSettings,
        departments: departments.map(d => d.name),
        categories: categories.map(c => c.name),
        statuses: statuses.map(s => s.name),
        updatedAt: FieldValue.serverTimestamp()
    });
    await metadataRef.doc("counters").set({
        staffId: staff.length,
        requestId: serviceRequests.length
    });

    console.log("Done");
}

async function runSeeder() {
    console.log("=========================================================");
    console.log(" STARTING DATABASE SEED (KERALA TALUK STRUCTURE)");
    console.log("=========================================================\n");

    try {
        await seedSettings();
        await seedCollection("roles", roles);
        await seedCollection("permissions", permissions);
        await seedCollection("departments", departments);
        await seedCollection("taluks", taluks, "id");
        await seedCollection("complaintCategories", categories);
        await seedCollection("complaintPriorities", priorities);
        await seedCollection("complaintStatuses", statuses);
        await seedCollection("slaRules", slaRules, "categoryId");
        await seedCollection("notificationTemplates", notificationTemplates, "type");

        // Users
        await seedCollection("users", superAdmins, "uid", true);
        await seedCollection("users", readonlyAdmins, "uid", true);
        await seedCollection("users", talukAdmins, "uid", true);
        await seedCollection("users", staff, "uid", true);
        await seedCollection("users", citizens, "uid", true);

        // Service Requests and related
        await seedCollection("serviceRequests", serviceRequests);
        await seedCollection("timeline", timeline);
        await seedCollection("attachments", attachments);
        await seedCollection("comments", comments);
        await seedCollection("notifications", notifications);
        await seedCollection("auditLogs", auditLogs);

        // Configs
        await seedCollection("dashboardConfigurations", dashboardConfigs, "role");
        await seedCollection("reportConfigurations", reportConfigs);

        console.log("\n=========================================================");
        console.log(" KERALA TALUK SEED COMPLETED SUCCESSFULLY");
        console.log("=========================================================\n");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ SEEDING FAILED");
        console.error(error);
        process.exit(1);
    }
}

runSeeder();
