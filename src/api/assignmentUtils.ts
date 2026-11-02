import { type User, type ServiceRequest } from "./client";

/**
 * Checks if a service provider is eligible to handle a specific request.
 */
export const isProviderEligible = (provider: User, request: ServiceRequest): boolean => {
  if (!provider.isActive || provider.role !== 'staff') return false;

  const hasDeptMatch =
    provider.departmentIds?.includes(request.departmentId) ||
    provider.departments?.includes(request.departmentId) ||
    provider.departments?.some(
      (d) => d.toLowerCase() === request.departmentName.toLowerCase()
    );

  return !!hasDeptMatch;
};
export const isStaffEligible = isProviderEligible;

/**
 * Ranks a list of service providers for a specific request.
 */
export const rankProviders = <T extends User>(providerList: T[], request: ServiceRequest): T[] => {
  const scoreProvider = (s: T) => {
    let score = 0;
    if (s.categories?.includes(request.categoryName)) {
      score += 100;
    }
    return score;
  };

  const poolWithScores = providerList.map((s) => ({
    ...s,
    recommendationScore: scoreProvider(s),
  }));

  return poolWithScores.sort((a, b) => {
    if (a.recommendationScore !== b.recommendationScore) {
      return b.recommendationScore - a.recommendationScore;
    }
    if (a.activeComplaintCount !== b.activeComplaintCount) {
      return a.activeComplaintCount - b.activeComplaintCount;
    }
    if (a.averageResolutionTime !== b.averageResolutionTime) {
      return a.averageResolutionTime - b.averageResolutionTime;
    }
    return (b.rating || 0) - (a.rating || 0);
  });
};
export const rankStaff = rankProviders;

export const assignmentUtils = {
  isProviderEligible, isStaffEligible, rankProviders, rankStaff, getRecommendedStaff: rankProviders
};
