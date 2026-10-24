/**
 * Utility to generate official Production Excel Templates.
 * Updated to match the latest design (Mandatory Mobile, isActive status).
 * Requires: npm install xlsx
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const templatesDir = __dirname;

const createTemplate = (filename, importData, instructions) => {
    const wb = XLSX.utils.book_new();

    // 1. Import Template Sheet
    const wsImport = XLSX.utils.json_to_sheet(importData);
    XLSX.utils.book_append_sheet(wb, wsImport, "Import Template");

    // 2. Instructions Sheet
    const wsInstruct = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsInstruct, "Instructions");

    // Enable auto-filters and freeze header for the import sheet
    wsImport['!autofter'] = { ref: "A1:" + XLSX.utils.encode_col(Object.keys(importData[0]).length - 1) + "1" };
    wsImport['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.writeFile(wb, path.join(templatesDir, filename));
    console.log(`Generated: ${filename}`);
};

// 01_Wards
createTemplate("01_Wards.xlsx", [
    { wardNumber: 1, name: "Poonkunnam", isActive: true }
], [
    ["FIELD", "REQUIRED", "DESCRIPTION", "DATA TYPE"],
    ["wardNumber", "YES", "Unique identifier for the ward", "Number"],
    ["name", "YES", "Official name of the ward", "Text"],
    ["isActive", "YES", "Whether the ward is active", "Boolean (TRUE/FALSE)"]
]);

// 02_Departments
createTemplate("02_Departments.xlsx", [
    { name: "Health", description: "Public health and sanitation", icon: "medkit", displayOrder: 1, isActive: true }
], [
    ["FIELD", "REQUIRED", "DESCRIPTION", "DATA TYPE"],
    ["name", "YES", "Department name", "Text"],
    ["description", "NO", "Short description", "Text"],
    ["icon", "NO", "Ionicons icon name", "Text"],
    ["displayOrder", "YES", "Sort order in dashboard", "Number"],
    ["isActive", "YES", "Active status", "Boolean"]
]);

// 03_ComplaintCategories
createTemplate("03_ComplaintCategories.xlsx", [
    { name: "Illegal Dumping", departmentName: "Health", priority: "High", slaHours: 48, icon: "trash", isActive: true }
], [
    ["FIELD", "REQUIRED", "DESCRIPTION", "DATA TYPE"],
    ["name", "YES", "Category name", "Text"],
    ["departmentName", "YES", "Must match a name in 02_Departments", "Text (Lookup)"],
    ["priority", "YES", "Default priority", "Low, Medium, High"],
    ["slaHours", "YES", "Resolution deadline in hours", "Number"],
    ["isActive", "YES", "Active status", "Boolean"]
]);

// 04_Staff
createTemplate("04_Staff.xlsx", [
    { fullName: "Ramesh Kumar", email: "ramesh@mcms.gov.in", mobile: "9000000011", designation: "Sanitation worker", departmentNames: "Health", categoryNames: "Illegal Dumping", hasAllWardAccess: true, assignedWardNumbers: "", isActive: true }
], [
    ["FIELD", "REQUIRED", "DESCRIPTION", "DATA TYPE"],
    ["fullName", "YES", "Full name of the staff", "Text"],
    ["email", "YES", "Work email address", "Text (Unique)"],
    ["mobile", "YES", "10-digit mobile number", "Text (Mandatory)"],
    ["designation", "NO", "Staff job title", "Text"],
    ["departmentNames", "YES", "Comma separated list of depts", "Text"],
    ["categoryNames", "YES", "Comma separated list of categories", "Text"],
    ["hasAllWardAccess", "YES", "Can work in all wards", "Boolean"],
    ["assignedWardNumbers", "NO", "Comma separated ward IDs if restricted", "Text"],
    ["isActive", "YES", "Account status", "Boolean"]
]);

// 05_WardAdmins
createTemplate("05_WardAdmins.xlsx", [
    { fullName: "Sita Devi", email: "sita@mcms.gov.in", mobile: "9000000012", wardNumber: 1, isActive: true }
], [
    ["FIELD", "REQUIRED", "DESCRIPTION", "DATA TYPE"],
    ["fullName", "YES", "Full name", "Text"],
    ["email", "YES", "Official email", "Text"],
    ["mobile", "YES", "10-digit mobile number", "Text (Mandatory)"],
    ["wardNumber", "YES", "Assigned ward", "Number"],
    ["isActive", "YES", "Status", "Boolean"]
]);

// 06_SuperAdmins (New)
createTemplate("06_SuperAdmins.xlsx", [
    { fullName: "Super Admin", email: "admin@mcms.gov.in", mobile: "9000000001", role: "super_admin", isActive: true }
], [
    ["FIELD", "REQUIRED", "DESCRIPTION", "DATA TYPE"],
    ["fullName", "YES", "Full name", "Text"],
    ["email", "YES", "Official email", "Text"],
    ["mobile", "YES", "10-digit mobile number", "Text"],
    ["role", "YES", "super_admin OR readonly_super_admin", "Text"],
    ["isActive", "YES", "Status", "Boolean"]
]);
