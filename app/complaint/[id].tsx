import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/src/theme';
import { useAuth } from '../../src/context/auth';
import { AppCard } from '@/src/components/AppCard';
import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { getComplaint, getProfile, listCorporationStaff, listCategories, listWards, adminUpdateStatus, assignComplaint, updateComplaintFields, deleteComplaint as deleteComplaintApi, reopenComplaint, addComment, assignmentUtils, type Complaint, type Staff, type User, workflowApi } from '@/src/api';
import { StatusBadge } from '@/src/components/StatusBadge';
import { PickerSheet } from '@/src/components/PickerSheet';
import { Timeline } from '@/src/components/Timeline';
import { SLAInfoPanel } from '@/src/components/SLAInfoPanel';
import { showToast } from '@/src/components/Toast';
import { auth } from '@/src/config/firebase';

const { width } = Dimensions.get('window');

function roleLabel(role: string): string {
  switch (role) {
    case 'citizen': return 'Citizen';
    case 'staff': return 'Field Staff';
    case 'ward_admin': return 'Ward Admin';
    case 'super_admin': return 'Super Admin';
    case 'system': return 'System';
    default: return role;
  }
}

export default function ComplaintDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, hasPermission, isLoggingOut, canModify, canAssign, canComment } = useAuth();
  const router = useRouter();

  const [item, setItem] = useState<Complaint | null>(null);
  const [citizen, setCitizen] = useState<User | null>(null);
  const [staff, setStaff] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'forbidden' | 'notfound' | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [assignSheet, setAssignSheet] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');

  const [allowedNextStatuses, setAllowedNextStatuses] = useState<string[]>([]);

  const [statusSheet, setStatusSheet] = useState(false);
  const [remarksModal, setRemarksModal] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<string>('ALL');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [assignmentHistoryOpen, setAssignmentHistoryOpen] = useState(false);

  // Workflow Helper State
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState<{ type: 'STATUS_CHANGE', status: string } | { type: 'REOPEN' } | { type: 'ASSIGNMENT', staffId: string | null } | null>(null);

  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [allWards, setAllWards] = useState<any[]>([]);

  // Super Admin Overrides
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideWard, setOverrideWard] = useState<number | null>(null);
  const [overrideCat, setOverrideCat] = useState<string | null>(null);
  const [showOverrideWardPicker, setShowOverrideWardPicker] = useState(false);
  const [showOverrideCatPicker, setShowOverrideCatPicker] = useState(false);

  const isSuper = user?.role === 'super_admin' || user?.role === 'readonly_super_admin';
  const isWardAdmin = user?.role === 'ward_admin';
  const isStaff = user?.role === 'staff';

  const isSuperOrAdmin = isSuper || isWardAdmin;
  const isAdminSide = isSuperOrAdmin || isStaff;

  const isOwner = !!(user && item && item.citizenId === user.uid);
  const canReopen = !!(item && user && workflowApi.canReopen(user, item));

  const load = useCallback(async () => {
    if (!id || !user || isLoggingOut) return;
    try {
      const c = await getComplaint(id);
      if (!auth.currentUser || isLoggingOut) return;
      setItem(c);
      setRemarks(c.remarks || '');
      setOverrideWard(c.wardNumber);
      setOverrideCat(c.categoryName);
      setLoadError(null);

      const transitions = workflowApi.getAllowedTransitions(user!, c);
      setAllowedNextStatuses(transitions);

      if (isAdminSide) {
         getProfile(c.citizenId)
           .then(p => setCitizen(p))
           .catch(e => console.warn("Citizen profile fetch failed:", e.message));
      }

      if (c.assignedStaffId) {
         getProfile(c.assignedStaffId)
           .then(p => setStaff(p))
           .catch(e => console.warn("Staff profile fetch failed:", e.message));
      }

      if (isSuperOrAdmin) {
        try {
          const s = await listCorporationStaff();
          if (!auth.currentUser || isLoggingOut) return;
          setStaffList(s.filter((x) => x.isActive));
        } catch (e: any) {
          console.error("Failed to load staff directory:", e);
        }
      }

      if (isSuper) {
         listCategories().then(list => setAllCategories(list));
      }
    } catch (e: any) {
      if (!isLoggingOut && auth.currentUser) {
        const msg = String(e.message || '');
        if (/Unauthorized|Access Denied/i.test(msg)) {
          setLoadError('forbidden');
        } else {
          setLoadError('notfound');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, isSuperOrAdmin, user, isLoggingOut, isSuper]);

  useFocusEffect(
    useCallback(() => {
      load();
      listWards().then(list => setAllWards(list));
    }, [load]),
  );

  const { recommendedStaff, otherEligible } = useMemo(() => {
    if (!item) return { recommendedStaff: [], otherEligible: [] };

    const lowSearch = staffSearch.toLowerCase();

    const eligiblePool = staffList.filter(s => {
      const isEligible = assignmentUtils.isStaffEligible(s, item!);
      const matchesSearch = !staffSearch || (
        s.fullName.toLowerCase().includes(lowSearch) ||
        s.employeeId?.toLowerCase().includes(lowSearch)
      );
      return isEligible && matchesSearch;
    });

    const ranked = assignmentUtils.rankStaff(eligiblePool, item!);

    const rec = ranked.filter(s => s.categories?.includes(item.categoryName));
    const others = ranked.filter(s => !s.categories?.includes(item.categoryName));

    return { recommendedStaff: rec, otherEligible: others };
  }, [staffList, item, staffSearch]);

  const filteredTimeline = useMemo(() => {
    if (!item?.timeline) return [];
    let list = [...item.timeline];

    if (timelineFilter !== 'ALL') {
      if (timelineFilter === 'COMMENTS') list = list.filter(t => t.type === 'COMMENT_ADDED');
      else if (timelineFilter === 'STATUS') list = list.filter(t => t.type.includes('STATUS') || t.type.includes('COMPLAINT_'));
      else if (timelineFilter === 'ASSIGNMENTS') list = list.filter(t => t.type.includes('ASSIGNED') || t.type.includes('ASSIGNMENT'));
      else if (timelineFilter === 'UPLOADS') list = list.filter(t => t.type.includes('UPLOADED'));
    }

    if (timelineSearch.trim()) {
      const q = timelineSearch.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.remarks?.toLowerCase().includes(q) ||
        t.performedByName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [item?.timeline, timelineFilter, timelineSearch]);

  const goHome = () => {
    if (isSuper) {
      router.replace('/admin/super');
    } else if (isAdminSide) {
      router.replace('/admin');
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const setStatus = (newStatus: string) => {
    if (!item) return;
    setPendingWorkflowAction({ type: 'STATUS_CHANGE', status: newStatus });
    setRemarks(''); // Clear previous remarks for the new action
    setRemarksModal(true);
  };

  const assignTo = (staffId: string | null) => {
    if (!item) return;
    setPendingWorkflowAction({ type: 'ASSIGNMENT', staffId });
    setRemarks('');
    setRemarksModal(true);
  };

  const saveRemarks = async () => {
    if (!item) return;

    if (pendingWorkflowAction && !remarks.trim()) {
      return showToast('Remarks are mandatory when changing the complaint status.', 'error');
    }

    setSaving(true);
    try {
      let updated;
      if (pendingWorkflowAction?.type === 'STATUS_CHANGE') {
        updated = await adminUpdateStatus(item.complaint_id, {
          status: pendingWorkflowAction.status,
          remarks: remarks.trim()
        });
        showToast('Status updated', 'success');
      } else if (pendingWorkflowAction?.type === 'REOPEN') {
        updated = await reopenComplaint(item.complaint_id, remarks.trim());
        showToast('Reopened', 'success');
      } else if (pendingWorkflowAction?.type === 'ASSIGNMENT') {
        updated = await assignComplaint(item.complaint_id, pendingWorkflowAction.staffId, remarks.trim());
        showToast(pendingWorkflowAction.staffId ? 'Staff assigned' : 'Assignment cleared', 'success');
      } else {
        // Standard remarks update (existing functionality)
        updated = await adminUpdateStatus(item.complaint_id, {
          status: item.status,
          remarks: remarks.trim(),
        });
        showToast('Remarks saved', 'success');
      }

      setItem(updated);
      setRemarksModal(false);
      setPendingWorkflowAction(null);
      setRemarks('');
      if (pendingWorkflowAction) load(); // Refresh lists if status changed
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyOverride = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const updates: any = {};
      if (overrideWard && overrideWard !== item.wardNumber) {
         updates.wardNumber = overrideWard;
         const w = allWards.find(x => x.wardNumber === overrideWard);
         if (w) updates.wardName = w.name;
      }
      if (overrideCat && overrideCat !== item.categoryName) {
         updates.categoryName = overrideCat;
      }

      if (Object.keys(updates).length > 0) {
        const updated = await updateComplaintFields(item.complaint_id, updates);
        setItem(updated);
        showToast('Complaint data overridden', 'success');
      }
      setShowOverrideModal(false);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteComplaint = () => {
     if (!item) return;

     const performDelete = async () => {
       setSaving(true);
       try {
         // Note: Use local name to avoid collision if necessary, but here it's fine
         await deleteComplaintApi(item.complaint_id);
         showToast('Deleted', 'success');
         router.back();
       } catch (e:any) { showToast(e.message, 'error'); }
       finally { setSaving(false); }
     };

     if (Platform.OS === 'web') {
       if (window.confirm('Are you sure? This will soft-delete the record.')) {
         performDelete();
       }
       return;
     }

     Alert.alert(
       'Delete Complaint',
       'Are you sure? This will soft-delete the record.',
       [
         { text: 'Cancel', style: 'cancel' },
         { text: 'Delete', style: 'destructive', onPress: performDelete }
       ]
     );
  };

  const MetaRow = ({ label, value, color }: { label: string; value: string; color: any }) => (
    <View style={styles.metaRow}>
      <Text style={{ color: color.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: color.text, fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }
  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Complaint</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ padding: 40, alignItems: 'center', marginTop: 40 }}>
          <Ionicons name={loadError === 'forbidden' ? 'lock-closed' : 'document-outline'} size={56} color={colors.textSecondary} />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 16 }}>
            {loadError === 'forbidden' ? 'Access Denied' : 'Not Found'}
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
            {loadError === 'forbidden' ? 'Unauthorized to view this complaint.' : "Couldn't find this complaint."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Service Request Details</Text>
        <TouchableOpacity onPress={goHome} style={styles.headerIconBtn}>
          <Ionicons name="home-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.cid, { color: colors.textSecondary }]}>#{item.complaint_id.toUpperCase()}</Text>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <Text style={[styles.date, { color: colors.textSecondary }]}>
          Filed on {dayjs(item.created_at).format('MMM D, YYYY · h:mm A')}
        </Text>

        {isAdminSide && (
          <AppCard style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }} elevation="sm" padding="sm">
            <View style={[styles.userAvatar, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="person" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{item.citizenName}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Ward {item.wardNumber} · {item.wardName}</Text>
            </View>
          </AppCard>
        )}

        {isAdminSide && citizen && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>CITIZEN CONTACT INFO</Text>
            <AppCard padding="none">
              <MetaRow label="Citizen Name" value={citizen.fullName} color={colors} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <MetaRow label="Mobile Number" value={citizen.mobile || 'Not Provided'} color={colors} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <MetaRow label="Email Address" value={citizen.email} color={colors} />
            </AppCard>
          </View>
        )}

        {(isOwner || isSuperOrAdmin) && staff && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>STAFF CONTACT INFO</Text>
            <AppCard padding="none">
              <MetaRow label="Staff Name" value={staff.fullName} color={colors} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <MetaRow label="Mobile Number" value={staff.mobile || 'Not Provided'} color={colors} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <MetaRow label="Designation" value={staff.designation || 'Field Resource'} color={colors} />
              {staff.categories && staff.categories.length > 0 && (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MetaRow label="Expertise" value={staff.categories.join(', ')} color={colors} />
                </>
              )}
            </AppCard>
          </View>
        )}

        {/* Assignment card */}
        {(isSuperOrAdmin || (isOwner && item.assignedStaffName) || isStaff) && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>ASSIGNED STAFF</Text>
            <AppCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} elevation="sm" padding="md">
              <View style={[styles.assignIcon, { backgroundColor: item.assignedStaffName ? colors.primary + '15' : colors.danger + '15' }]}>
                <Ionicons name={item.assignedStaffName ? 'person' : 'alert-circle'} size={20} color={item.assignedStaffName ? colors.primary : colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{item.assignedStaffName || 'Not Assigned'}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                  {item.assignedDepartment || (item.assignedStaffName ? 'Field Resource' : 'Awaiting assignment')}
                </Text>
              </View>
              {hasPermission('assign_complaints') && item && workflowApi.canAssign(user!, item) && canAssign() && (
                <AppButton
                  title={item.assignedStaffId ? 'CHANGE' : 'ASSIGN'}
                  variant="outline"
                  onPress={() => setAssignSheet(true)}
                  style={{ minHeight: 36, paddingHorizontal: 16 }}
                  textStyle={{ fontSize: 12 }}
                />
              )}
            </AppCard>
          </View>
        )}

        <AppCard style={{ marginTop: 24 }} padding="none">
          <MetaRow label="Department" value={item.departmentName} color={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <MetaRow label="Category" value={item.categoryName} color={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <MetaRow label="Last update" value={dayjs(item.updatedAtDate || item.updatedAt).format('MMM D · h:mm A')} color={colors} />
        </AppCard>

        {isAdminSide && <SLAInfoPanel complaint={item} />}

        <View style={{ marginTop: 24 }}>
          <Text style={[styles.section, { color: colors.textSecondary }]}>DESCRIPTION</Text>
          <AppCard padding="md">
            <Text style={[styles.desc, { color: colors.text }]}>{item.description}</Text>
          </AppCard>
        </View>

        {item.photos?.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>PHOTOS ({item.photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {item.photos.map((uri, idx) => (
                <TouchableOpacity key={idx} onPress={() => setViewer(uri)}>
                  <Image source={{ uri }} style={[styles.thumb, { borderRadius: 12, borderWidth: 1, borderColor: colors.border }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          <Text style={[styles.section, { color: colors.textSecondary }]}>REMARKS</Text>
          <AppCard style={{ backgroundColor: colors.surfaceTint }} padding="md" elevation="none">
            <Text style={{ color: item.remarks ? colors.text : colors.textSecondary, fontStyle: item.remarks ? 'normal' : 'italic', lineHeight: 20 }}>
              {item.remarks || 'No remarks provided.'}
            </Text>
          </AppCard>
        </View>

        <View style={{ marginTop: 32, gap: 12 }}>
          {allowedNextStatuses.length > 0 && canModify() && (
            <AppButton
              title="Update Workflow Status"
              onPress={() => setStatusSheet(true)}
              loading={saving}
              variant="primary"
            />
          )}

          {item.status === 'Submitted' && isOwner && workflowApi.canCancel(user!, item) && canModify() && (
            <AppButton
              title="Cancel Service Request"
              onPress={() => setStatus('Cancelled')}
              loading={saving}
              variant="outline"
              style={{ borderColor: colors.danger }}
              textStyle={{ color: colors.danger }}
            />
          )}

          {isAdminSide && item && workflowApi.canComment(user!, item) && canModify() && (
            <AppButton
              title={item.remarks ? 'Edit Remarks' : 'Add Remarks'}
              onPress={() => {
                setPendingWorkflowAction(null);
                setRemarks(item.remarks || '');
                setRemarksModal(true);
              }}
              variant="secondary"
            />
          )}

          {canReopen && canModify() && (
            <AppButton
              title="Reopen Complaint"
              onPress={() => {
                setPendingWorkflowAction({ type: 'REOPEN' });
                setRemarks('');
                setRemarksModal(true);
              }}
              style={{ backgroundColor: colors.warning }}
            />
          )}
        </View>

        {/* Admin manual override tools */}
        {(isSuper || user?.role === 'readonly_super_admin') && (
          <View style={{ marginTop: 32 }}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>ADMINISTRATIVE CONTROLS</Text>
            {canModify() ? (
              <View style={{ gap: 12 }}>
                <AppButton
                  title="Administrative Override"
                  onPress={() => setShowOverrideModal(true)}
                  variant="outline"
                  style={{ borderStyle: 'dashed' }}
                />
                <AppButton
                  title="Soft Delete Complaint"
                  onPress={deleteComplaint}
                  variant="outline"
                  style={{ borderColor: colors.danger, borderStyle: 'dashed' }}
                  textStyle={{ color: colors.danger }}
                />
              </View>
            ) : (
              <AppCard style={{ borderStyle: 'dashed', backgroundColor: colors.surfaceTint }} padding="md">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Read-Only Administrative Context</Text>
                </View>
              </AppCard>
            )}
          </View>
        )}

        {/* Assignment History */}
        {item.assignmentHistory && item.assignmentHistory.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <TouchableOpacity
              onPress={() => setAssignmentHistoryOpen(v => !v)}
              style={[styles.historyToggle, { borderColor: colors.border, backgroundColor: colors.surface }]}
              activeOpacity={0.7}
            >
              <Ionicons name="people" size={18} color={colors.primary} />
              <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>Assignment History ({item.assignmentHistory.length})</Text>
              <Ionicons name={assignmentHistoryOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {assignmentHistoryOpen && (
              <AppCard style={{ marginTop: 8 }} padding="none">
                {item.assignmentHistory.map((ah, i) => (
                  <View key={i} style={[styles.ahRow, i !== 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                      {ah.newStaffName ? `Assigned to ${ah.newStaffName}` : 'Assignment Cleared'}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      By {ah.assignedByName} · {dayjs(ah.timestamp).format('MMM D, h:mm A')}
                    </Text>
                  </View>
                ))}
              </AppCard>
            )}
          </View>
        )}

        {/* Comments section */}
        <View style={{ marginTop: 32 }}>
          <Text style={[styles.section, { color: colors.textSecondary }]}>COMMENTS ({item.comments?.length || 0})</Text>
          {item.comments?.map((cm) => (
            <AppCard
              key={cm.id}
              style={{
                marginTop: 12,
                backgroundColor: cm.author_role === 'citizen' ? colors.primary + '05' : colors.surface
              }}
              elevation="sm"
              padding="md"
            >
              <View style={styles.commentHead}>
                <View style={[styles.commentAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{cm.author_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{cm.author_name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    {roleLabel(cm.author_role)} · {dayjs(cm.created_at).format('MMM D, h:mm A')}
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.text, fontSize: 14, marginTop: 10, lineHeight: 20 }}>{cm.text}</Text>
            </AppCard>
          ))}

          {item.status !== 'Closed' && workflowApi.canComment(user!, item) && canComment() && (
            <View style={[styles.commentInputRow, { borderColor: colors.border, backgroundColor: colors.surface, marginTop: 20 }]}>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textSecondary}
                multiline
                style={{ flex: 1, color: colors.text, fontSize: 14, paddingVertical: 8, minHeight: 40 }}
              />
              <TouchableOpacity
                disabled={postingComment || !comment.trim()}
                onPress={async () => {
                  if (!comment.trim()) return;
                  setPostingComment(true);
                  try {
                    await addComment(item.complaint_id, comment.trim());
                    setComment('');
                    await load();
                    showToast('Comment posted', 'success');
                  } catch(e:any){showToast(e.message,'error');}
                  finally {setPostingComment(false);}
                }}
                style={[styles.commentSend, { backgroundColor: comment.trim() ? colors.primary : colors.border }]}
              >
                {postingComment ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Status Activity timeline */}
        {item.timeline && (
          <View style={{ marginTop: 32 }}>
            <View style={styles.timelineHeader}>
              <Text style={[styles.section, { marginTop: 0, flex: 1, color: colors.textSecondary }]}>ACTIVITY LOG</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                {['ALL', 'COMMENTS', 'STATUS', 'ASSIGNMENTS'].map(f => (
                  <TouchableOpacity key={f} onPress={() => setTimelineFilter(f)} style={styles.filterBtn}>
                    <Text style={{
                      color: timelineFilter === f ? colors.primary : colors.textSecondary,
                      fontSize: 10,
                      fontWeight: '800',
                      textDecorationLine: timelineFilter === f ? 'underline' : 'none'
                    }}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={[styles.timelineSearch, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <Ionicons name="search" size={16} color={colors.textSecondary} />
               <TextInput
                  placeholder="Filter activity log..."
                  placeholderTextColor={colors.textSecondary}
                  value={timelineSearch}
                  onChangeText={setTimelineSearch}
                  style={{ flex: 1, fontSize: 13, color: colors.text, paddingVertical: 8 }}
               />
               {timelineSearch.length > 0 && (
                 <TouchableOpacity onPress={() => setTimelineSearch('')}>
                   <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                 </TouchableOpacity>
               )}
            </View>

            <Timeline
              timeline={filteredTimeline}
              onAttachmentPress={(att) => setViewer(att.url)}
            />
          </View>
        )}
      </ScrollView>

      {/* Image viewer */}
      <Modal transparent visible={!!viewer} onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.backdrop} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer }} style={{ width, height: width, resizeMode: 'contain' }} />}
          <TouchableOpacity onPress={() => setViewer(null)} style={styles.viewerClose}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
        </Pressable>
      </Modal>

      <PickerSheet visible={statusSheet} title="Update Status" options={allowedNextStatuses} value={item.status} onSelect={setStatus} onClose={() => setStatusSheet(false)} />

      {/* Manual Override Modal */}
      <Modal transparent visible={showOverrideModal} animationType="fade" onRequestClose={() => setShowOverrideModal(false)}>
         <Pressable style={styles.modalBackdrop} onPress={() => setShowOverrideModal(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
               <Text style={[styles.modalTitle, { color: colors.text }]}>Administrative Override</Text>
               <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 16 }}>Force update basic complaint properties.</Text>

               <Text style={styles.label}>WARD JURISDICTION</Text>
               <TouchableOpacity onPress={() => setShowOverrideWardPicker(true)} style={[styles.selector, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text }}>Ward {overrideWard} - {allWards.find(x => x.wardNumber === overrideWard)?.name}</Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
               </TouchableOpacity>

               <Text style={[styles.label, { marginTop: 12 }]}>SERVICE CATEGORY</Text>
               <TouchableOpacity onPress={() => setShowOverrideCatPicker(true)} style={[styles.selector, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text }}>{overrideCat}</Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
               </TouchableOpacity>

               <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                  <TouchableOpacity onPress={() => setShowOverrideModal(false)} style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}><Text style={{ fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={applyOverride} disabled={saving} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '800', color: '#fff' }}>Apply Overrides</Text>}
                  </TouchableOpacity>
               </View>
            </Pressable>
         </Pressable>
      </Modal>

      <PickerSheet
         visible={showOverrideWardPicker}
         title="Select Ward"
         options={(allWards || []).map(w => `Ward ${w.wardNumber} - ${w.name}`)}
         onSelect={(val) => {
            const num = parseInt(val.split(' ')[1]);
            setOverrideWard(num);
            setShowOverrideWardPicker(false);
         }}
         onClose={() => setShowOverrideWardPicker(false)}
      />

      <PickerSheet
         visible={showOverrideCatPicker}
         title="Select Category"
         options={(allCategories || []).map(c => c.name)}
         onSelect={(val) => {
            setOverrideCat(val);
            setShowOverrideCatPicker(false);
         }}
         onClose={() => setShowOverrideCatPicker(false)}
      />

      {/* Smart Assign sheet */}
      <Modal transparent visible={assignSheet} animationType="fade" onRequestClose={() => setAssignSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAssignSheet(false)}>
          <Pressable style={[styles.assignSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.assignHandle} />
            <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center', marginBottom: 8 }]}>{item.assignedStaffId ? 'Reassign Resource' : 'Assign Resource'}</Text>

            <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput placeholder="Search global staff pool..." placeholderTextColor={colors.textSecondary} value={staffSearch} onChangeText={setStaffSearch} style={{ flex: 1, color: colors.text, fontSize: 14 }} />
              {staffSearch.length > 0 && (
                <TouchableOpacity onPress={() => setStaffSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
              {recommendedStaff.length === 0 && otherEligible.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                  <Text style={{ color: colors.text, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
                    No eligible staff available for this ward and department.
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                    Staff must be active and assigned to Ward {item.wardNumber} in the {item.departmentName} department.
                  </Text>
                </View>
              )}

              {recommendedStaff.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.sectionText}>RECOMMENDED RESOURCES</Text>
                </View>
              )}
              {recommendedStaff.map((s, idx) => (
                <StaffRow
                  key={s.uid}
                  staff={s}
                  isBestMatch={idx === 0}
                  selected={item.assignedStaffId === s.uid}
                  onSelect={() => { assignTo(s.uid); setAssignSheet(false); }}
                />
              ))}

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionText}>OTHER ELIGIBLE STAFF</Text>
              </View>
              {otherEligible.map(s => (
                <StaffRow
                  key={s.uid}
                  staff={s}
                  selected={item.assignedStaffId === s.uid}
                  onSelect={() => { assignTo(s.uid); setAssignSheet(false); }}
                />
              ))}

              {item.assignedStaffId && (
                <TouchableOpacity onPress={async () => { await assignTo(null); setAssignSheet(false); }} style={[styles.assignRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={[styles.assignRowIcon, { backgroundColor: '#EF444415' }]}><Ionicons name="close-circle" size={20} color="#EF4444" /></View>
                  <Text style={{ color: '#EF4444', fontWeight: '700' }}>Clear Assignment</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Remarks modal */}
      <Modal transparent visible={remarksModal} animationType="fade" onRequestClose={() => { setRemarksModal(false); setPendingWorkflowAction(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.modalBackdrop} onPress={() => { setRemarksModal(false); setPendingWorkflowAction(null); }}>
            <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {pendingWorkflowAction?.type === 'STATUS_CHANGE'
                  ? `Update Status: ${pendingWorkflowAction.status}`
                  : pendingWorkflowAction?.type === 'REOPEN'
                    ? 'Reopen Complaint'
                    : pendingWorkflowAction?.type === 'ASSIGNMENT'
                      ? (pendingWorkflowAction.staffId ? 'Assign Resource' : 'Clear Assignment')
                      : 'Edit Remarks'}
              </Text>
              <TextInput value={remarks} onChangeText={setRemarks} autoFocus multiline numberOfLines={5} placeholder={pendingWorkflowAction ? "Why are you making this change?" : "Internal or citizen-facing updates..."} placeholderTextColor={colors.textSecondary} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginTop: 12, minHeight: 120, color: colors.text, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity onPress={() => { setRemarksModal(false); setPendingWorkflowAction(null); }} style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}><Text style={{ fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveRemarks} disabled={saving} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '800', color: '#fff' }}>Confirm</Text>}</TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function StaffRow({ staff, isBestMatch, selected, onSelect }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onSelect} style={[styles.assignRow, { borderBottomColor: colors.border }, selected && { backgroundColor: colors.surfaceTint }]}>
      <View style={[styles.assignRowIcon, { backgroundColor: colors.primary + '15' }]}>
        <Text style={{ color: colors.primary, fontWeight: '800' }}>{staff.fullName?.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{staff.fullName}</Text>
          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>{staff.employeeId}</Text>
          {isBestMatch && (
            <View style={{ backgroundColor: '#F59E0B20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ color: '#D97706', fontSize: 8, fontWeight: '800' }}>⭐ BEST MATCH</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{staff.designation || 'Field Staff'}</Text>

        <View style={styles.metricsRow}>
          <MetricBox label="LOAD" value={staff.activeComplaintCount} color={colors.text} />
          <MetricBox label="DONE" value={staff.completedComplaintCount} color="#10B981" />
          <MetricBox label="SPEED" value={`${Math.round(staff.averageResolutionTime || 0)}h`} color={colors.primary} />
          <MetricBox label="RATING" value={staff.rating?.toFixed(1)} color="#F59E0B" />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {staff.hasAllWardAccess ? (
            <View style={{ backgroundColor: colors.primary + '10', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, color: colors.primary, fontWeight: '800' }}>ALL WARDS</Text>
            </View>
          ) : (
            (staff.assignedWardNumbers || []).map((n: number) => (
              <View key={n} style={{ backgroundColor: colors.surfaceTint, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 0.5, borderColor: colors.border }}>
                <Text style={{ fontSize: 8, color: colors.textSecondary, fontWeight: '700' }}>W{n}</Text>
              </View>
            ))
          )}
          {staff.departments?.slice(0, 2).map((d: string) => (
            <View key={d} style={{ backgroundColor: colors.surfaceTint, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 0.5, borderColor: colors.border }}>
              <Text style={{ fontSize: 8, color: colors.textSecondary, fontWeight: '700' }}>{d.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
    </TouchableOpacity>
  );
}

function MetricBox({ label, value, color }: any) {
  return (
    <View style={{ alignItems: 'flex-start', minWidth: 40 }}>
      <Text style={{ fontSize: 7, fontWeight: '800', color: '#94A3B8' }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '800', color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cid: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  date: {
    fontSize: 12,
    marginTop: 8,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  desc: {
    fontSize: 15,
    lineHeight: 24,
  },
  thumb: {
    width: 100,
    height: 100,
  },
  assignIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  ahRow: {
    padding: 14,
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 12,
  },
  commentSend: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timelineSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 60,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 28,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalBtn: {
    flex: 1,
  },
  assignSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '85%',
  },
  assignHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  assignRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  selector: {
    height: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
