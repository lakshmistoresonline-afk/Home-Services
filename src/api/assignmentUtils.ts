import { type User, type Complaint } from "./client";

/**
 * Checks if a staff member is eligible to handle a specific complaint.
 */
export const isStaffEligible = (staff: User, complaint: Complaint): boolean => {
  if (!staff.isActive || staff.role !== 'staff') return false;

  // Type-resilient ward matching (handles both numbers and strings)
  const targetWard = Number(complaint.wardNumber);
  const hasWardMatch =
    staff.hasAllWardAccess ||
    (staff.assignedWardNumbers && staff.assignedWardNumbers.map(Number).includes(targetWard)) ||
    Number(staff.wardNumber) === targetWard;

  const hasDeptMatch =
    staff.departmentIds?.includes(complaint.departmentId) ||
    staff.departments?.includes(complaint.departmentId) ||
    staff.departments?.some(
      (d) => d.toLowerCase() === complaint.departmentName.toLowerCase()
    );

  return !!(hasWardMatch && hasDeptMatch);
};

/**
 * Ranks a list of staff members for a specific complaint using the system strategy.
 */
export const rankStaff = <T extends User>(staffList: T[], complaint: Complaint): T[] => {
  const scoreStaff = (s: T) => {
    let score = 0;
    // categoryName is used for matching skills
    if (s.categories?.includes(complaint.categoryName)) {
      score += 100; // Major boost for specific skill match
    }
    return score;
  };

  const poolWithScores = staffList.map((s) => ({
    ...s,
    recommendationScore: scoreStaff(s),
  }));

  return poolWithScores.sort((a, b) => {
    // 1. Recommendation Score (DESC)
    if (a.recommendationScore !== b.recommendationScore) {
      return b.recommendationScore - a.recommendationScore;
    }
    // 2. Workload: Active complaint count (ASC)
    if (a.activeComplaintCount !== b.activeComplaintCount) {
      return a.activeComplaintCount - b.activeComplaintCount;
    }
    // 3. Efficiency: Average resolution time (ASC)
    if (a.averageResolutionTime !== b.averageResolutionTime) {
      return a.averageResolutionTime - b.averageResolutionTime;
    }
    // 4. Quality: Rating (DESC)
    return (b.rating || 0) - (a.rating || 0);
  });
};

export const assignmentUtils = {
  isStaffEligible, rankStaff
};
