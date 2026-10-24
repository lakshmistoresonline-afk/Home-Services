import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTaskSnapshot
} from "firebase/storage";
import { storage } from "@/src/config/firebase";
import { type TimelineAttachment, type User } from "./client";

/**
 * DEPRECATED/LEGACY: This module was used for Firebase Storage uploads.
 * Currently, the project uses "Plan B" (Base64 in Firestore) to bypass CORS issues.
 *
 * Uploads a file to Firebase Storage with progress tracking.
 * Path pattern: complaints/{complaintId}/{filename} or profiles/{uid}/{filename}
 */
export const uploadFile = async (params: {
  path: string;
  fileUri: string;
  filename: string;
  user: User;
  onProgress?: (progress: number) => void;
}): Promise<TimelineAttachment> => {
  try {
    // 1. Prepare reference
    const storageRef = ref(storage, `${params.path}/${params.filename}`);

    // 2. Fetch the file blob (React Native specific fetch for local files)
    const response = await fetch(params.fileUri);
    if (!response.ok) throw new Error(`Failed to fetch local file: ${response.statusText}`);
    const blob = await response.blob();

    // 3. Start resumable upload
    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot: UploadTaskSnapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          params.onProgress?.(progress);
        },
        (error) => {
          console.error("Firebase Storage Upload Error:", error.code, error.message);
          if (error.code === 'storage/unauthorized') {
            reject(new Error("Storage permission denied. Check security rules."));
          } else if (error.code === 'storage/retry-limit-exceeded') {
            reject(new Error("Upload timed out. Check your connection or CORS settings."));
          } else {
            reject(error);
          }
        },
        async () => {
          // 4. Handle completion
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              id: Math.random().toString(36).substring(7),
              filename: params.filename,
              url: downloadURL,
              size: blob.size,
              contentType: blob.type,
              uploadedBy: params.user.uid,
              uploadedAt: new Date().toISOString(),
            });
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      );
    });
  } catch (err: any) {
    console.error("Initial Upload Setup Error:", err);
    throw err;
  }
};

export const deleteFile = async (fullPath: string) => {
  const storageRef = ref(storage, fullPath);
  await deleteObject(storageRef);
};
