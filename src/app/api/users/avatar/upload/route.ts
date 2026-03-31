import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const { url, resourceType } = await uploadFile(
      file,
      "bewtopia/users/icons",
    );

    return NextResponse.json({
      url,
      type: resourceType,
      name: file.name,
    });
  } catch (error) {
    console.error("User icon upload error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
