import { type User, type ServiceRequest } from "./client";

/**
 * Checks if a service provider is eligible to handle a specific request.
 */
export const isProviderEligible = (provider: User, request: ServiceRequest): boolean => {
  if (!provider || !request || !provider.isActive || provider.role !== 'staff') return false;

  const hasDeptMatch =
    provider.departmentIds?.includes(request.departmentId) ||
    provider.departments?.includes(request.departmentId) ||
    provider.departments?.some(
      (d) => d.toLowerCase() === request.departmentName?.toLowerCase()
    );

  return !!hasDeptMatch;
};
export const isStaffEligible = isProviderEligible;

/**
 * Ranks a list of service providers for a specific request.
 * Accepts flexible parameter order (providerList, request) or (request, providerList).
 */
export const rankProviders = <T extends User>(arg1: any, arg2: any): T[] => {
  let providerList: T[] = [];
  let request: ServiceRequest | null = null;

  if (Array.isArray(arg1)) {
    providerList = arg1;
    request = arg2;
  } else if (Array.isArray(arg2)) {
    providerList = arg2;
    request = arg1;
  }

  if (!Array.isArray(providerList) || providerList.length === 0 || !request) {
    return Array.isArray(providerList) ? providerList : [];
  }

  const scoreProvider = (s: T) => {
    let score = 0;
    if (request?.categoryName && s.categories?.includes(request.categoryName)) {
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
    const countA = (a as any).activeServiceCount ?? (a as any).activeComplaintCount ?? 0;
    const countB = (b as any).activeServiceCount ?? (b as any).activeComplaintCount ?? 0;
    if (countA !== countB) {
      return countA - countB;
    }
    return (b.rating || 0) - (a.rating || 0);
  });
};
export const rankStaff = rankProviders;

export const assignmentUtils = {
  isProviderEligible, isStaffEligible, rankProviders, rankStaff, getRecommendedStaff: rankProviders
};
