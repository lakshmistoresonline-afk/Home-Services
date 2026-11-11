import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '@/src/theme';
import { useAuth } from '@/src/context/auth';
import { listCategories, listDepartments, uploadFile, createServiceRequest, type ComplaintCategory, type Department, type TimelineAttachment } from '@/src/api';
import { uploadComplaintPhoto } from '@/src/api/storageService';
import { showToast } from '@/src/components/Toast';
import { PickerSheet } from '@/src/components/PickerSheet';
import { AppInput } from '@/src/components/AppInput';
import { AppButton } from '@/src/components/AppButton';
import { AppCard } from '@/src/components/AppCard';

type PendingFile = {
  uri: string;
  name: string;
  type: string;
  progress: number;
  base64?: string;
  error?: string;
  uploaded?: TimelineAttachment;
};

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB for Plan B stability
const MAX_PHOTOS = 3;

export default function NewServiceRequestScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ departmentName?: string; departmentId?: string }>();

  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [showDept, setShowDept] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<ComplaintCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<any | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showCat, setShowCat] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleAddOn = (addonId: string) => {
    setSelectedAddOns(prev =>
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  const calculatedTotal = useMemo(() => {
    const base = selectedSubCategory?.basePrice || selectedCategory?.basePrice || 0;
    const coating = selectedAddOns.includes('addon_coating') ? 250 : 0;
    const warranty = selectedAddOns.includes('addon_warranty') ? 199 : 0;
    return base + coating + warranty;
  }, [selectedSubCategory, selectedCategory, selectedAddOns]);

  useEffect(() => {
    if (user && !user.mobile) {
      if (Platform.OS === 'web') {
        router.replace('/(tabs)/profile');
        return;
      }
      Alert.alert(
        'Update Profile',
        'A mobile number is required to file a service request. Please update your profile.',
        [{ text: 'Go to Profile', onPress: () => router.replace('/(tabs)/profile') }],
        { cancelable: false }
      );
      return;
    }

    Promise.all([listDepartments(), listCategories()]).then(([deptList, catList]) => {
      const activeDepts = deptList.filter(d => d.isActive);
      const activeCats = catList.filter(c => c.isActive);
      setDepartments(activeDepts);
      setCategories(activeCats);

      if (params.departmentName || params.departmentId) {
        const found = activeDepts.find(d =>
          (params.departmentName && d.name.toLowerCase() === params.departmentName.toLowerCase()) ||
          (params.departmentId && d.id === params.departmentId)
        );
        if (found) {
          setSelectedDepartment(found);
          setDepartmentName(found.name);
        }
      }
    });
  }, [user, router, params.departmentName, params.departmentId]);

  const onSelectDepartment = (name: string) => {
    const dept = departments.find(d => d.name === name);
    setSelectedDepartment(dept || null);
    setDepartmentName(name);
    setCategory('');
    setSelectedCategory(null);
  };

  const onSelectCategory = (name: string) => {
     const cat = categories.find(c => c.name === name);
     setSelectedCategory(cat || null);
     setCategory(name);
     if (cat && cat.subCategories && cat.subCategories.length > 0) {
       setSelectedSubCategory(cat.subCategories[0]);
     } else {
       setSelectedSubCategory(null);
     }
  };

  const filteredCategories = selectedDepartment
    ? categories.filter(c => c.departmentId === selectedDepartment.id)
    : categories;

  const departmentOptions = departments.map(d => ({ label: d.name, value: d.name }));
  const categoryOptions = filteredCategories.map(c => ({ label: c.name, value: c.name }));

  const pickImage = async () => {
    if (pendingFiles.length >= MAX_PHOTOS) {
      showToast(`Maximum ${MAX_PHOTOS} photos allowed`, 'error');
      return;
    }

    if (Platform.OS === 'web') {
      return openPicker('gallery');
    }

    Alert.alert(
      'Add Attachment',
      'Choose a source',
      [
        {
          text: 'Camera',
          onPress: () => openPicker('camera'),
        },
        {
          text: 'Gallery',
          onPress: () => openPicker('gallery'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const openPicker = async (mode: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;

    if (mode === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showToast('Permission to access camera is required', 'error');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast('Permission to access photos is required', 'error');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS - pendingFiles.length,
      });
    }

    if (result.canceled || !result.assets?.length) return;

    const assets = result.assets;
    const invalidTypes = assets.filter(a => a.mimeType && !a.mimeType.startsWith('image/'));
    if (invalidTypes.length > 0) {
      showToast(`${invalidTypes.length} file(s) are not supported image types.`, 'error');
    }

    const validByTypes = assets.filter(a => !a.mimeType || a.mimeType.startsWith('image/'));

    const processedFiles: PendingFile[] = [];
    for (const asset of validByTypes) {
      const processed = await processImage(asset.uri);
      processedFiles.push({
        uri: processed.uri,
        name: asset.fileName || `upload_${Date.now()}_${Math.floor(Math.random()*1000)}.jpg`,
        type: asset.mimeType || 'image/jpeg',
        base64: processed.base64 || undefined,
        progress: 0
      });
    }

    if (processedFiles.length === 0) return;
    setPendingFiles(prev => [...prev, ...processedFiles]);
  };

  const removeFile = (idx: number) => {
    setPendingFiles((p) => p.filter((_, i) => i !== idx));
  };

  const processImage = async (uri: string) => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return { uri: result.uri, base64: result.base64 };
    } catch (e) {
      console.error("Image manipulation failed:", e);
      return { uri, base64: undefined };
    }
  };

  const submit = async () => {
    if (!departmentName) return showToast('Select a department', 'error');
    if (!category) return showToast('Select a category', 'error');
    if (!title.trim()) return showToast('Enter a title', 'error');
    if (!description.trim()) return showToast('Enter a description', 'error');

    setBusy(true);
    try {
      const uploadedAttachments: TimelineAttachment[] = [];
      const tempId = `TEMP_${user!.uid}_${Date.now()}`;

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        let downloadUrl = '';

        try {
          // Upload to Firebase Cloud Storage
          downloadUrl = await uploadComplaintPhoto(tempId, file.uri || `data:${file.type};base64,${file.base64}`, file.name);
        } catch (storageErr) {
          console.warn('Cloud Storage upload notice (fallback to inline data):', storageErr);
          if (file.base64) {
            downloadUrl = `data:${file.type};base64,${file.base64}`;
          }
        }

        if (downloadUrl) {
          uploadedAttachments.push({
            id: `att-${Date.now()}-${i}`,
            filename: file.name,
            url: downloadUrl,
            size: file.base64?.length || 1024,
            contentType: file.type,
            uploadedBy: user!.uid,
            uploadedAt: new Date().toISOString(),
          });
        }

        setPendingFiles(prev => {
          const next = [...prev];
          next[i].progress = 100;
          return next;
        });
      }

      const c = await createServiceRequest({
        category,
        subCategoryId: selectedSubCategory?.id,
        subCategoryName: selectedSubCategory?.name,
        basePrice: selectedSubCategory?.basePrice || selectedCategory?.basePrice || 0,
        slaHours: selectedSubCategory?.slaHours || selectedCategory?.slaHours || 24,
        title: title.trim(),
        description: description.trim(),
        attachments: uploadedAttachments,
      });

      showToast(`Service request submitted: ${c.complaint_id}`, 'success');
      router.replace(`/service/${c.complaint_id}`);
    } catch (e: any) {
      console.error("Submission failed:", e);
      showToast(e.message || 'Failed to submit', 'error');
    } finally {
      setBusy(false);
    }
  };

  const goHome = () => {
    if (user?.role === 'super_admin' || user?.role === 'readonly_super_admin') {
      router.replace('/admin/super');
    } else if (user?.role === 'ward_admin' || user?.role === 'staff') {
      router.replace('/admin');
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      goHome();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} testID="new-service-back" style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.title.large, { color: colors.text, fontWeight: '800', flex: 1 }]}>Raise Service Request</Text>
        <TouchableOpacity onPress={goHome} style={styles.homeBtn}>
          <Ionicons name="home-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.label.medium, { color: colors.textSecondary, marginBottom: spacing.sm }]}>SERVICE DEPARTMENT</Text>
            <TouchableOpacity
              testID="department-picker"
              onPress={() => setShowDept(true)}
              style={[styles.selector, { backgroundColor: colors.surfaceTint, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: departmentName ? colors.text : colors.textSecondary, fontSize: 16 }}>
                {departmentName || 'Select department first...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.label.medium, { color: colors.textSecondary, marginBottom: spacing.sm }]}>SERVICE CATEGORY</Text>
            <TouchableOpacity
              testID="category-picker"
              onPress={() => {
                if (!selectedDepartment) {
                  showToast('Please select a department first', 'error');
                  return;
                }
                setShowCat(true);
              }}
              style={[styles.selector, { backgroundColor: selectedDepartment ? colors.surfaceTint : colors.background, borderColor: colors.border, opacity: selectedDepartment ? 1 : 0.6 }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: category ? colors.text : colors.textSecondary, fontSize: 16 }}>
                {category || (selectedDepartment ? 'Select service category...' : 'Select department first...')}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {selectedCategory && selectedCategory.subCategories && selectedCategory.subCategories.length > 0 && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.label.medium, { color: colors.textSecondary, marginBottom: spacing.sm }]}>SELECT SERVICE VARIANT</Text>
              <View style={{ gap: spacing.sm }}>
                {selectedCategory.subCategories.map((sub: any) => {
                  const isSelected = selectedSubCategory?.id === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => setSelectedSubCategory(sub)}
                      activeOpacity={0.8}
                      style={{
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary + '0D' : colors.surface,
                        borderRadius: radius.md,
                        padding: spacing.md,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[typography.title.small, { color: colors.text, fontWeight: '700', flex: 1 }]}>
                          {sub.name}
                        </Text>
                        <View style={{ backgroundColor: colors.primary + '1A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>₹{sub.basePrice}</Text>
                        </View>
                      </View>

                      <Text style={[typography.body.small, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={2}>
                        {sub.description}
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                          ⏱️ {sub.estimatedMinutes || 60} mins
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                          ⚡ {sub.slaHours || 24}h SLA ({sub.priority})
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Optional Add-Ons Checklist */}
          {selectedCategory && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.label.medium, { color: colors.textSecondary, marginBottom: spacing.sm }]}>OPTIONAL SERVICE ADD-ONS</Text>
              <View style={{ gap: spacing.xs }}>
                <TouchableOpacity
                  onPress={() => toggleAddOn('addon_coating')}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: selectedAddOns.includes('addon_coating') ? colors.primary : colors.border,
                    backgroundColor: selectedAddOns.includes('addon_coating') ? colors.primary + '0A' : colors.surface,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons
                      name={selectedAddOns.includes('addon_coating') ? "checkbox" : "square-outline"}
                      size={22}
                      color={selectedAddOns.includes('addon_coating') ? colors.primary : colors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.title.small, { color: colors.text, fontWeight: '700' }]}>Anti-Rust Coil Protective Coating</Text>
                      <Text style={[typography.body.small, { color: colors.textSecondary }]}>High-grade anti-corrosive spray for outdoor unit coils</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>+ ₹250</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => toggleAddOn('addon_warranty')}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: selectedAddOns.includes('addon_warranty') ? colors.primary : colors.border,
                    backgroundColor: selectedAddOns.includes('addon_warranty') ? colors.primary + '0A' : colors.surface,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons
                      name={selectedAddOns.includes('addon_warranty') ? "checkbox" : "square-outline"}
                      size={22}
                      color={selectedAddOns.includes('addon_warranty') ? colors.primary : colors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.title.small, { color: colors.text, fontWeight: '700' }]}>Extended 90-Day Service Warranty</Text>
                      <Text style={[typography.body.small, { color: colors.textSecondary }]}>Guaranteed free revisit & labor protection for 90 days</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>+ ₹199</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Dynamic Order Total Summary Card */}
          {selectedCategory && (
            <AppCard elevation="sm" padding="md" style={{ marginBottom: spacing.lg, backgroundColor: colors.surfaceTint }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[typography.label.small, { color: colors.textSecondary, letterSpacing: 1 }]}>ESTIMATED ORDER TOTAL</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 2 }}>₹{calculatedTotal}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>TARGET COMPLETION</Text>
                  <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700', marginTop: 2 }}>
                    ⚡ {selectedSubCategory?.slaHours || selectedCategory?.slaHours || 24} Hours
                  </Text>
                </View>
              </View>
            </AppCard>
          )}

          <AppInput
            label="SERVICE TITLE"
            testID="service-title-input"
            value={title}
            onChangeText={setTitle}
            placeholder="Brief summary of the service needed"
            containerStyle={{ marginBottom: spacing.lg }}
          />

          <AppInput
            label="DETAILED DESCRIPTION"
            testID="service-description-input"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            placeholder="Provide exact address and service details..."
            textAlignVertical="top"
            inputStyle={{ height: 120, paddingTop: 12 }}
            containerStyle={{ marginBottom: spacing.lg }}
          />

          <View style={{ marginBottom: spacing.xl }}>
            <View style={styles.attachmentHeader}>
              <Text style={[typography.label.medium, { color: colors.textSecondary }]}>
                ATTACHMENTS ({pendingFiles.length}/5)
              </Text>
              <Text style={[typography.label.small, { color: colors.textSecondary }]}>Max 5MB each</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {pendingFiles.length < 5 && (
                <TouchableOpacity
                  testID="add-photo-button"
                  onPress={pickImage}
                  style={[styles.addPhoto, { borderColor: colors.primary, backgroundColor: colors.surfaceTint }]}
                >
                  <Ionicons name="camera-outline" size={28} color={colors.primary} />
                  <Text style={[typography.label.small, { color: colors.primary, marginTop: 4 }]}>ADD PHOTO</Text>
                </TouchableOpacity>
              )}
              {pendingFiles.map((file, idx) => (
                <View key={idx} style={styles.photoTile} testID={`photo-preview-${idx}`}>
                  <Image source={{ uri: file.uri }} style={styles.photoImg} />
                  {file.progress > 0 && file.progress < 100 && (
                     <View style={styles.progressOverlay}>
                        <View style={[styles.progressBar, { width: `${file.progress}%`, backgroundColor: colors.primary }]} />
                     </View>
                  )}
                  <TouchableOpacity
                    onPress={() => removeFile(idx)}
                    style={[styles.removePhoto, { backgroundColor: colors.danger }]}
                    testID={`remove-photo-${idx}`}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>

          <AppButton
            title={busy ? "Submitting..." : "Submit Service Request"}
            onPress={submit}
            loading={busy}
            testID="submit-service-button"
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={showDept}
        title="Select Department"
        options={departmentOptions}
        value={departmentName}
        onSelect={onSelectDepartment}
        onClose={() => setShowDept(false)}
        testIDPrefix="department"
      />

      <PickerSheet
        visible={showCat}
        title="Select Category"
        options={categoryOptions}
        value={category}
        onSelect={onSelectCategory}
        onClose={() => setShowCat(false)}
        testIDPrefix="category"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  homeBtn: { marginLeft: 16 },
  body: { paddingHorizontal: 20, paddingBottom: 60 },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 52 },
  attachmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  photoRow: { gap: 12 },
  addPhoto: { width: 90, height: 90, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoTile: { width: 90, height: 90, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  progressOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(0,0,0,0.3)' },
  progressBar: { height: '100%' },
  photoImg: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
