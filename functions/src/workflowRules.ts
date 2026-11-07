export const WORKFLOW_MAP: Record<string, string[]> = {
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

export function isValidTransition(currentStatus: string, nextStatus: string): boolean {
  const allowed = WORKFLOW_MAP[currentStatus] || [];
  return allowed.includes(nextStatus);
}
