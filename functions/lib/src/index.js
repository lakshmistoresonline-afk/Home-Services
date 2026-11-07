"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledAutoClose = exports.scheduledAutoAssign = exports.setUserRole = exports.assignComplaint = exports.updateComplaintStatus = exports.createServiceRequest = void 0;
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
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