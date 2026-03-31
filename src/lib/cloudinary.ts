import { v2 as cloudinary } from "cloudinary";
import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";

const proxy =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// プロキシがある場合はagentを設定
if (proxy) {
  console.info("Cloudinary: using proxy:", proxy);
  const agent = new HttpsProxyAgent(proxy);
  https.globalAgent = agent as any;
}
/**
 * FileオブジェクトをBufferに変換
 */
async function fileToBuffer(file: File | Blob): Promise<Buffer> {
  try {
    // Blobとして扱い、arrayBufferを取得
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("arrayBuffer failed:", error);

    // 代替方法: streamを使用
    try {
      if ("stream" in file && typeof file.stream === "function") {
        const stream = file.stream();
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        return Buffer.concat(chunks);
      }
    } catch (streamError) {
      console.error("stream failed:", streamError);
    }

    // 最後の手段: textとして読み込む
    try {
      const text = await file.text();
      return Buffer.from(text, "latin1");
    } catch (textError) {
      console.error("text failed:", textError);
      throw new Error("Unable to convert file to buffer");
    }
  }
}

/**
 * 画像をCloudinaryにアップロード
 */
export async function uploadImage(
  file: File,
  folder: string = "bewtopia/apps",
): Promise<string> {
  const buffer = await fileToBuffer(file);

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new Error("Upload failed"));
          }
        },
      )
      .end(buffer);
  });
}

/**
 * ZIPファイルをCloudinaryにアップロード
 */
export async function uploadZipFile(
  file: File,
  folder: string = "bewtopia/apps",
): Promise<string> {
  const buffer = await fileToBuffer(file);

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "raw",
          format: "zip",
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new Error("Upload failed"));
          }
        },
      )
      .end(buffer);
  });
}

/**
 * 汎用ファイルをCloudinaryにアップロード
 */
export async function uploadFile(
  file: File,
  folder: string = "bewtopia/chat",
): Promise<{ url: string; resourceType: string }> {
  const buffer = await fileToBuffer(file);
  const resourceType = file.type.startsWith("image/") ? "image" : "raw";

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: resourceType,
          // rawの場合、ファイル名を維持するためにuse_filenameなどを検討できるが、
          // ここではシンプルに任せる。元の名前が欲しければ別途保存しているはず。
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              url: result.secure_url,
              resourceType: result.resource_type,
            });
          } else {
            reject(new Error("Upload failed"));
          }
        },
      )
      .end(buffer);
  });
}

export { cloudinary };
