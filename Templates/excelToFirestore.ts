import * as XLSX from 'xlsx';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin (Assumes key is in seed folder)
const serviceAccount = require('../seed/serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const auth = admin.auth();

async function importWards(filePath: string) {
    console.log(`\n--- Importing Wards from ${path.basename(filePath)} ---`);
    if (!fs.existsSync(filePath)) return console.warn("File not found, skipping.");
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let count = 0;
    for (const row of data) {
        if (!row.wardNumber) continue;
        const ref = db.collection('wards').doc(row.wardNumber.toString());
        await ref.set({
            ...row,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        count++;
    }
    console.log(`Success: Imported ${count} wards.`);
}

async function importDepartments(filePath: string) {
    console.log(`\n--- Importing Departments from ${path.basename(filePath)} ---`);
    if (!fs.existsSync(filePath)) return console.warn("File not found, skipping.");
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let count = 0;
    for (const row of data) {
        if (!row.name) continue;
        const id = row.name.toLowerCase().replace(/\s+/g, '_');
        const ref = db.collection('departments').doc(id);
        await ref.set({
            ...row,
            id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        count++;
    }
    console.log(`Success: Imported ${count} departments.`);
}

async function importCategories(filePath: string) {
    console.log(`\n--- Importing Categories from ${path.basename(filePath)} ---`);
    if (!fs.existsSync(filePath)) return console.warn("File not found, skipping.");
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Pre-fetch departments for lookup
    const deptSnap = await db.collection('departments').get();
    const depts = new Map(deptSnap.docs.map(d => [d.data().name, d.id]));

    let count = 0;
    for (const row of data) {
        if (!row.name || !row.departmentName) continue;
        const deptId = depts.get(row.departmentName);
        if (!deptId) {
            console.error(`Error: Department "${row.departmentName}" not found for category "${row.name}". skipping.`);
            continue;
        }

        const id = row.name.toLowerCase().replace(/\s+/g, '_');
        const ref = db.collection('complaintCategories').doc(id);
        await ref.set({
            ...row,
            id,
            departmentId: deptId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        count++;
    }
    console.log(`Success: Imported ${count} categories.`);
}

async function importUsers(filePath: string, defaultRole: string | null = null) {
    const label = defaultRole ? defaultRole : "Super Admins";
    console.log(`\n--- Importing ${label} from ${path.basename(filePath)} ---`);
    if (!fs.existsSync(filePath)) return console.warn("File not found, skipping.");

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let count = 0;
    for (const row of data) {
        if (!row.email || !row.fullName) continue;

        try {
            let userRecord;
            try {
                userRecord = await auth.getUserByEmail(row.email);
            } catch (e: any) {
                if (e.code === 'auth/user-not-found') {
                    userRecord = await auth.createUser({
                        email: row.email,
                        password: row.password || `${(row.role || defaultRole).charAt(0).toUpperCase()}${(row.role || defaultRole).slice(1)}@123`,
                        displayName: row.fullName
                    });
                } else throw e;
            }

            const uid = userRecord.uid;
            const role = row.role || defaultRole;
            const userDoc: any = {
                ...row,
                uid,
                role,
                isActive: row.isActive === true || row.isActive === 'true' || row.isActive === 'TRUE',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Handle multi-select fields for Staff
            if (role === 'staff') {
                if (row.departmentNames) userDoc.departments = row.departmentNames.split(',').map((s: string) => s.trim());
                if (row.categoryNames) userDoc.categories = row.categoryNames.split(',').map((s: string) => s.trim());
                if (row.assignedWardNumbers) userDoc.assignedWardNumbers = row.assignedWardNumbers.toString().split(',').map((s: string) => parseInt(s.trim()));

                // Initialize performance stats if not existing
                userDoc.activeComplaintCount = userDoc.activeComplaintCount ?? 0;
                userDoc.completedComplaintCount = userDoc.completedComplaintCount ?? 0;
                userDoc.rating = userDoc.rating ?? 5.0;
            }

            await db.collection('users').doc(uid).set(userDoc, { merge: true });
            count++;
        } catch (e: any) {
            console.error(`Failed to import ${row.email}: ${e.message}`);
        }
    }
    console.log(`Success: Imported ${count} records.`);
}

async function run() {
    console.log("=========================================================");
    console.log(" MCMS PRODUCTION DATA IMPORT");
    console.log("=========================================================\n");

    try {
        const base = __dirname;
        await importWards(path.join(base, "01_Wards.xlsx"));
        await importDepartments(path.join(base, "02_Departments.xlsx"));
        await importCategories(path.join(base, "03_ComplaintCategories.xlsx"));
        await importUsers(path.join(base, "06_SuperAdmins.xlsx"));
        await importUsers(path.join(base, "05_WardAdmins.xlsx"), 'ward_admin');
        await importUsers(path.join(base, "04_Staff.xlsx"), 'staff');

        console.log("\n=========================================================");
        console.log(" IMPORT COMPLETED SUCCESSFULLY");
        console.log("=========================================================");
    } catch (error) {
        console.error("\n❌ CRITICAL IMPORT ERROR");
        console.error(error);
        process.exit(1);
    }
}

run();
