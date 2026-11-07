"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKFLOW_MAP = void 0;
exports.isValidTransition = isValidTransition;
exports.WORKFLOW_MAP = {
    'Submitted': ['Assigned', 'Cancelled'],
    'Assigned': ['Accepted', 'Rejected'],
    'Accepted': ['In Progress'],
    'Rejected': ['Assigned'],
    'In Progress': ['Resolved'],
    'Resolved': ['Closed', 'Reopened'],
    'Closed': [],
    'Cancelled': [],
    'Reopened': ['Assigned', 'Cancelled'],
};
function isValidTransition(currentStatus, nextStatus) {
    const allowed = exports.WORKFLOW_MAP[currentStatus] || [];
    return allowed.includes(nextStatus);
}
//# sourceMappingURL=workflowRules.js.map