import { ref, uploadBytes, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "@/src/config/firebase";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type UploadResult = {
  url: string;
  filename: string;
  size: number;
  contentType: string;
};

/**
 * Uploads a complaint photo URI or Base64 string directly to Firebase Cloud Storage.
 * Target path: serviceRequests/{complaintId}/photos/{filename}
 */
export const uploadComplaintPhoto = async (
  complaintId: string,
  uriOrBase64: string,
  fileNameCustom?: string
): Promise<string> => {
  if (!uriOrBase64) throw new Error("Image URI or Base64 data required");

  const fileId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const filename = fileNameCustom || `photo_${fileId}.jpg`;
  const storagePath = `serviceRequests/${complaintId}/photos/${filename}`;
  const storageRef = ref(storage, storagePath);

  // If input is Base64 string
  if (uriOrBase64.startsWith("data:")) {
    const format = uriOrBase64.split(";")[0].split(":")[1] || "image/jpeg";
    await uploadString(storageRef, uriOrBase64, "data_url", {
      contentType: format,
    });
    return await getDownloadURL(storageRef);
  }

  // If input is raw Base64 without data URI header
  if (!uriOrBase64.startsWith("http://") && !uriOrBase64.startsWith("https://") && !uriOrBase64.startsWith("file://") && !uriOrBase64.startsWith("blob:")) {
    await uploadString(storageRef, uriOrBase64, "base64", {
      contentType: "image/jpeg",
    });
    return await getDownloadURL(storageRef);
  }

  // Fetch blob for local file://, blob:, or http:// URIs
  const response = await fetch(uriOrBase64);
  const blob = await response.blob();

  if (blob.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds maximum allowed limit of 5 MB (${(blob.size / (1024 * 1024)).toFixed(2)} MB)`);
  }

  const contentType = blob.type || "image/jpeg";
  await uploadBytes(storageRef, blob, { contentType });
  return await getDownloadURL(storageRef);
};

export const storageService = {
  uploadComplaintPhoto,
  MAX_FILE_SIZE_BYTES,
};
