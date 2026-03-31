import { fetcher } from "@/utils/fetcher";
/**
 * サーバー経由でCloudinaryにアップロード（安全）
 */

export async function uploadToServer(
  file: File,
  type: "image" | "zip",
  folder: string,
): Promise<{ url: string; bytes: number }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  formData.append("folder", folder);

  return fetcher<{ url: string; bytes: number }>("/api/bewt/files", {
    method: "POST",
    body: formData,
  });
}

export async function uploadImage(file: File, folder: string): Promise<string> {
  const { url } = await uploadToServer(file, "image", folder);
  return url;
}

export async function uploadZipFile(
  file: File,
  folder: string,
): Promise<{ url: string; bytes: number; key: string }> {
  return uploadToServer(file, "zip", folder) as Promise<{
    url: string;
    bytes: number;
    key: string;
  }>;
}

export async function uploadImages(
  files: File[],
  folder: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const url = await uploadImage(file, folder);
    urls.push(url);
  }
  return urls;
}
