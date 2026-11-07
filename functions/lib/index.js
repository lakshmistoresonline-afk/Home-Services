"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledAutoClose = exports.scheduledAutoAssign = exports.setUserRole = exports.assignComplaint = exports.updateComplaintStatus = exports.createServiceRequest = void 0;
const app_1 = require("firebase-admin/app");
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
var requests_1 = require("./requests");
Object.defineProperty(exports, "createServiceRequest", { enumerable: true, get: function () { return requests_1.createServiceRequest; } });
Object.defineProperty(exports, "updateComplaintStatus", { enumerable: true, get: function () { return requests_1.updateComplaintStatus; } });
var assignment_1 = require("./assignment");
Object.defineProperty(exports, "assignComplaint", { enumerable: true, get: function () { return assignment_1.assignComplaint; } });
var roles_1 = require("./roles");
Object.defineProperty(exports, "setUserRole", { enumerable: true, get: function () { return roles_1.setUserRole; } });
var maintenance_1 = require("./maintenance");
Object.defineProperty(exports, "scheduledAutoAssign", { enumerable: true, get: function () { return maintenance_1.scheduledAutoAssign; } });
Object.defineProperty(exports, "scheduledAutoClose", { enumerable: true, get: function () { return maintenance_1.scheduledAutoClose; } });
//# sourceMappingURL=index.js.map