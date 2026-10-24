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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '@/src/theme';
import { useAuth } from '@/src/context/auth';
import { listCategories, uploadFile, createComplaint, type ComplaintCategory, type TimelineAttachment } from '@/src/api';
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

export default function NewComplaintScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ComplaintCategory | null>(null);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showCat, setShowCat] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !user.mobile) {
      if (Platform.OS === 'web') {
        router.replace('/(tabs)/profile');
        return;
      }
      Alert.alert(
        'Update Profile',
        'A mobile number is required to file a complaint. Please update your profile.',
        [{ text: 'Go to Profile', onPress: () => router.replace('/(tabs)/profile') }],
        { cancelable: false }
      );
      return;
    }

    listCategories().then((list) => {
      setCategories(list.filter(c => c.isActive));
    });
  }, [user, router]);

  const onSelectCategory = (name: string) => {
     const cat = categories.find(c => c.name === name);
     setSelectedCategory(cat || null);
     setCategory(name);
  };

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
        quality: 0.8, // Higher initial quality, manipulator will compress
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

    // Process images through the Rescaling Engine
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
        [{ resize: { width: 1200 } }], // Resize to professional standard
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return { uri: result.uri, base64: result.base64 };
    } catch (e) {
      console.error("Image manipulation failed:", e);
      return { uri, base64: undefined };
    }
  };

  const submit = async () => {
    if (!category) return showToast('Select a category', 'error');
    if (!title.trim()) return showToast('Enter a title', 'error');
    if (!description.trim()) return showToast('Enter a description', 'error');

    setBusy(true);
    try {
      const uploadedAttachments: TimelineAttachment[] = [];

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        if (!file.base64) {
          console.warn(`File ${file.name} missing base64 data`);
          continue;
        }

        // Plan B: Convert local base64 to attachment format
        uploadedAttachments.push({
          id: `b64-${Date.now()}-${i}`,
          filename: file.name,
          url: `data:${file.type};base64,${file.base64}`,
          size: file.base64.length, // approximation
          contentType: file.type,
          uploadedBy: user!.uid,
          uploadedAt: new Date().toISOString(),
        });

        setPendingFiles(prev => {
          const next = [...prev];
          next[i].progress = 100;
          return next;
        });
      }

      const c = await createComplaint({
        category,
        title: title.trim(),
        description: description.trim(),
        attachments: uploadedAttachments,
      });

      showToast(`Complaint filed: ${c.complaint_id}`, 'success');
      router.replace(`/complaint/${c.complaint_id}`);
    } catch (e: any) {
      console.error("Submission failed:", e);
      showToast(e.message || 'Failed to submit', 'error');
    } finally {
      setBusy(false);
    }
  };

  const categoryOptions = categories.map(c => c.name);

  const goHome = () => {
    if (user?.role === 'super_admin' || user?.role === 'readonly_super_admin') {
      router.replace('/admin/super');
    } else if (user?.role === 'ward_admin' || user?.role === 'staff') {
      router.replace('/admin');
    } else {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="new-complaint-back" style={styles.backBtn}>
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
            <Text style={[typography.label.medium, { color: colors.textSecondary, marginBottom: spacing.sm }]}>SERVICE CATEGORY</Text>
            <TouchableOpacity
              testID="category-picker"
              onPress={() => setShowCat(true)}
              style={[styles.selector, { backgroundColor: colors.surfaceTint, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: category ? colors.text : colors.textSecondary, fontSize: 16 }}>
                {category || 'Select service category...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <AppInput
            label="SERVICE TITLE"
            testID="complaint-title-input"
            value={title}
            onChangeText={setTitle}
            placeholder="Brief summary of the service needed"
            containerStyle={{ marginBottom: spacing.lg }}
          />

          <AppInput
            label="DETAILED DESCRIPTION"
            testID="complaint-description-input"
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
            title={busy ? "Submitting..." : "File Official Complaint"}
            onPress={submit}
            loading={busy}
            testID="submit-complaint-button"
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

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

