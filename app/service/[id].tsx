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
import { getComplaint, getProfile, listCorporationStaff, listCategories, adminUpdateStatus, assignComplaint, updateComplaintFields, deleteComplaint as deleteComplaintApi, reopenComplaint, addComment, assignmentUtils, type Complaint, type Staff, type User, workflowApi } from '@/src/api';
import { StatusBadge } from '@/src/components/StatusBadge';
import { PickerSheet } from '@/src/components/PickerSheet';
import { Timeline } from '@/src/components/Timeline';
import { showToast } from '@/src/components/Toast';
import { auth } from '@/src/config/firebase';

const { width } = Dimensions.get('window');

function roleLabel(role: string): string {
  switch (role) {
    case 'citizen': return 'Citizen';
    case 'staff': return 'Field Staff';
    case 'taluk_admin': return 'Taluk Admin';
    case 'super_admin': return 'Super Admin';
    case 'system': return 'System';
    default: return role;
  }
}

export default function ServiceRequestDetail() {
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

  const [pendingWorkflowAction, setPendingWorkflowAction] = useState<{ type: 'STATUS_CHANGE', status: string } | { type: 'REOPEN' } | { type: 'ASSIGNMENT', staffId: string | null } | null>(null);

  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [allWards, setAllWards] = useState<any[]>([]);

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideWard, setOverrideWard] = useState<number | null>(null);
  const [overrideCat, setOverrideCat] = useState<string | null>(null);
  const [showOverrideWardPicker, setShowOverrideWardPicker] = useState(false);
  const [showOverrideCatPicker, setShowOverrideCatPicker] = useState(false);

  const isSuper = user?.role === 'super_admin' || user?.role === 'readonly_super_admin';
  const isTalukAdmin = user?.role === 'taluk_admin';
  const isStaff = user?.role === 'staff';

  const isSuperOrAdmin = isSuper || isTalukAdmin;
  const isAdminSide = isSuperOrAdmin || isStaff;

  const isOwner = !!(user && item && item.citizenId === user.uid);
  const canReopen = !!(item && user && workflowApi.canReopen(user, item));

  const load = useCallback(async () => {
    if (!id || isLoggingOut) return;
    try {
      const c = await getComplaint(id);
      if (isLoggingOut) return;
      setItem(c);
      setRemarks(c.remarks || '');
      setOverrideWard(c.wardNumber);
      setOverrideCat(c.categoryName);
      setLoadError(null);

      if (user) {
        const transitions = workflowApi.getAllowedTransitions(user, c);
        setAllowedNextStatuses(transitions);
      }

      if (isAdminSide && c.citizenId) {
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
          if (isLoggingOut) return;
          setStaffList(s.filter((x) => x.isActive));
        } catch (e: any) {
          console.error("Failed to load staff directory:", e);
        }
      }

      if (isSuper) {
         listCategories().then(list => setAllCategories(list));
      }
    } catch (e: any) {
      if (!isLoggingOut) {
        const msg = String(e?.message || '');
        if (/Unauthorized|Access Denied/i.test(msg)) {
          setLoadError('forbidden');
        } else {
          setLoadError('notfound');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, user, isLoggingOut, isAdminSide, isSuperOrAdmin, isSuper]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const setStatus = async (status: string) => {
    if (!item) return;
    if (status === 'Cancelled' || status === 'Rejected' || status === 'Resolved') {
      setPendingWorkflowAction({ type: 'STATUS_CHANGE', status });
      setRemarks('');
      setRemarksModal(true);
      return;
    }

    setSaving(true);
    try {
      const updated = await adminUpdateStatus(item.complaint_id, { status });
      setItem(updated);
      const transitions = workflowApi.getAllowedTransitions(user!, updated);
      setAllowedNextStatuses(transitions);
      setStatusSheet(false);
      showToast(`Status updated to ${status}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to update status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const assignTo = async (staffId: string | null) => {
    if (!item) return;
    setSaving(true);
    try {
      const updated = await assignComplaint(item.complaint_id, staffId);
      setItem(updated);
      showToast(staffId ? 'Service provider assigned successfully' : 'Assignment cleared', 'success');
      setAssignSheet(false);
    } catch (e: any) {
      showToast(e.message || 'Assignment failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveRemarks = async () => {
    if (!item) return;
    setSaving(true);
    try {
      let updated;
      if (pendingWorkflowAction?.type === 'STATUS_CHANGE') {
        updated = await adminUpdateStatus(item.complaint_id, { status: pendingWorkflowAction.status, remarks: remarks.trim() });
      } else if (pendingWorkflowAction?.type === 'REOPEN') {
        updated = await reopenComplaint(item.complaint_id, remarks.trim());
      } else if (pendingWorkflowAction?.type === 'ASSIGNMENT') {
        updated = await assignComplaint(item.complaint_id, pendingWorkflowAction.staffId, remarks.trim());
      } else {
        updated = await adminUpdateStatus(item.complaint_id, { status: item.status, remarks: remarks.trim() });
      }
      setItem(updated);
      setRemarksModal(false);
      setPendingWorkflowAction(null);
      showToast('Service request updated', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyOverride = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const updates: any = {};
      if (overrideWard !== item.wardNumber) updates.wardNumber = overrideWard;
      if (overrideCat !== item.categoryName) updates.categoryName = overrideCat;

      const updated = await updateComplaintFields(item.complaint_id, updates);
      setItem(updated);
      setShowOverrideModal(false);
      showToast('Service request data overridden', 'success');
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
       'Delete Service Request',
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

  const filteredTimeline = useMemo(() => {
    if (!item?.timeline) return [];
    let list = item.timeline;
    if (timelineFilter === 'COMMENTS') list = list.filter(t => t.type.includes('COMMENT'));
    else if (timelineFilter === 'STATUS') list = list.filter(t => t.type.includes('STATUS') || t.type.includes('CREATED'));
    else if (timelineFilter === 'ASSIGNMENTS') list = list.filter(t => t.type.includes('ASSIGN'));

    if (timelineSearch.trim()) {
       const q = timelineSearch.toLowerCase();
       list = list.filter(t => t.title.toLowerCase().includes(q) || t.performedByName.toLowerCase().includes(q));
    }
    return list;
  }, [item?.timeline, timelineFilter, timelineSearch]);

  const recommendedStaff = useMemo(() => {
    if (!item || !staffList.length) return [];
    return assignmentUtils.getRecommendedStaff(staffList, item);
  }, [item, staffList]);

  const otherEligible = useMemo(() => {
    if (!item || !staffList.length) return [];
    const recIds = new Set(recommendedStaff.map(s => s.uid));
    return staffList.filter(s => !recIds.has(s.uid) && (
      !staffSearch || s.fullName.toLowerCase().includes(staffSearch.toLowerCase()) || s.employeeId?.toLowerCase().includes(staffSearch.toLowerCase())
    ));
  }, [item, staffList, recommendedStaff, staffSearch]);

  const goHome = () => {
    if (user?.role === 'super_admin' || user?.role === 'readonly_super_admin') {
      router.replace('/admin/super');
    } else if (user?.role === 'taluk_admin' || user?.role === 'staff') {
      router.replace('/admin');
    } else {
      router.replace('/(tabs)/home');
    }
  };

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Service Request</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ padding: 40, alignItems: 'center', marginTop: 40 }}>
          <Ionicons name={loadError === 'forbidden' ? 'lock-closed' : 'document-outline'} size={56} color={colors.textSecondary} />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 16 }}>
            {loadError === 'forbidden' ? 'Access Denied' : 'Not Found'}
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
            {loadError === 'forbidden' ? 'Unauthorized to view this service request.' : "Couldn't find this service request."}
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
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.district} · {item.taluk} Taluk</Text>
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
            <Text style={[styles.section, { color: colors.textSecondary }]}>PROVIDER CONTACT INFO</Text>
            <AppCard padding="none">
              <MetaRow label="Provider Name" value={staff.fullName} color={colors} />
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
            <Text style={[styles.section, { color: colors.textSecondary }]}>ASSIGNED SERVICE PROVIDER</Text>
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
              {(isSuperOrAdmin || canAssign()) && item && (
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
              title="Reopen Service Request"
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
                  title="Soft Delete Service Request"
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
               <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 16 }}>Force update service request properties.</Text>

               <Text style={styles.label}>SERVICE CATEGORY</Text>
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
            <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center', marginBottom: 8 }]}>{item.assignedStaffId ? 'Reassign Provider' : 'Assign Provider'}</Text>

            <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput placeholder="Search service provider pool..." placeholderTextColor={colors.textSecondary} value={staffSearch} onChangeText={setStaffSearch} style={{ flex: 1, color: colors.text, fontSize: 14 }} />
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
                    No eligible service providers available for this taluk and department.
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                    Providers must be active and verified in the {item.departmentName} department.
                  </Text>
                </View>
              )}

              {recommendedStaff.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.sectionText}>RECOMMENDED PROVIDERS</Text>
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
                <Text style={styles.sectionText}>OTHER ELIGIBLE PROVIDERS</Text>
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
                    ? 'Reopen Service Request'
                    : pendingWorkflowAction?.type === 'ASSIGNMENT'
                      ? (pendingWorkflowAction.staffId ? 'Assign Provider' : 'Clear Assignment')
                      : 'Edit Remarks'}
              </Text>
              <TextInput value={remarks} onChangeText={setRemarks} autoFocus multiline numberOfLines={5} placeholder={pendingWorkflowAction ? "Why are you making this change?" : "Internal or customer-facing updates..."} placeholderTextColor={colors.textSecondary} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginTop: 12, minHeight: 120, color: colors.text, textAlignVertical: 'top' }} />
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
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{staff.designation || 'Service Provider'}</Text>

        <View style={styles.metricsRow}>
          <MetricBox label="LOAD" value={staff.activeComplaintCount} color={colors.text} />
          <MetricBox label="DONE" value={staff.completedComplaintCount} color="#10B981" />
          <MetricBox label="SPEED" value={`${Math.round(staff.averageResolutionTime || 0)}h`} color={colors.primary} />
          <MetricBox label="RATING" value={staff.rating?.toFixed(1)} color="#F59E0B" />
        </View>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
    </TouchableOpacity>
  );
}

function MetricBox({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={{ fontSize: 9, color: '#64748B', fontWeight: '800' }}>{label}</Text>
      <Text style={{ fontSize: 13, color, fontWeight: '800', marginTop: 1 }}>{value ?? 0}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 64 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cid: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '800', marginTop: 4, lineHeight: 28 },
  date: { fontSize: 12, marginTop: 8 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  divider: { height: 1 },
  assignIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  desc: { fontSize: 15, lineHeight: 22 },
  thumb: { width: 80, height: 80 },
  historyToggle: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: 16, gap: 10 },
  ahRow: { padding: 12 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, gap: 12 },
  commentSend: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  filterBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  timelineSearch: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, gap: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  viewerClose: { position: 'absolute', top: 40, right: 20, padding: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6, color: '#64748B' },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48 },
  modalBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  assignSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  assignHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46, marginBottom: 16, gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 8 },
  sectionText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#64748B' },
  assignRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, gap: 12 },
  assignRowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  metricBox: { backgroundColor: '#F8FAFC', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
});
