import { NextResponse } from "next/server";
import { unipileMultipartRequest } from "@/lib/unipile";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type SocialPlatform = "instagram" | "linkedin" | "twitter";

function normalizePlatform(platform: string): SocialPlatform | null {
  const normalized = platform.toLowerCase();
  if (normalized === "instagram" || normalized === "linkedin" || normalized === "twitter") {
    return normalized;
  }
  return null;
}

function parseMediaUrls(value: string | undefined) {
  if (!value) return [];
  return value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function filenameFromUrl(urlString: string, index: number, contentType: string | null) {
  const fallbackExt = contentType?.includes("png")
    ? "png"
    : contentType?.includes("webp")
      ? "webp"
      : contentType?.includes("gif")
        ? "gif"
        : "jpg";

  try {
    const parsed = new URL(urlString);
    const pathName = parsed.pathname.split("/").pop() || "";
    if (pathName.includes(".")) return pathName;
  } catch {
    // Ignore URL parsing issues and fallback to generated name.
  }

  return `image-${index + 1}.${fallbackExt}`;
}

async function fetchImageAsFile(urlString: string, index: number) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new Error(`Invalid media URL: ${urlString}`);
  }

  const response = await fetch(parsedUrl.toString());
  if (!response.ok) {
    throw new Error(`Failed to download media URL (${response.status}): ${urlString}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error(`Media URL is not an image: ${urlString}`);
  }

  const blob = await response.blob();
  const fileName = filenameFromUrl(parsedUrl.toString(), index, contentType);
  return new File([blob], fileName, { type: contentType || "image/jpeg" });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let platform = "";
    let accountId = "";
    let text = "";
    let mode = "post";
    let mediaUrlInput = "";
    const uploadedFiles: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      platform = String(formData.get("platform") || "");
      accountId = String(formData.get("accountId") || "").trim();
      text = String(formData.get("text") || "").trim();
      mode = String(formData.get("mode") || "post").trim() || "post";
      mediaUrlInput = String(formData.get("mediaUrl") || "").trim();

      formData.getAll("attachments").forEach((item) => {
        if (item instanceof File && item.size > 0) {
          uploadedFiles.push(item);
        }
      });
    } else {
      const payload = await request.json();
      platform = String(payload?.platform || "");
      accountId = String(payload?.accountId || "").trim();
      text = String(payload?.text || "").trim();
      mode = String(payload?.mode || "post").trim() || "post";
      mediaUrlInput = String(payload?.mediaUrl || "").trim();
    }

    const normalizedPlatform = normalizePlatform(platform);
    if (!normalizedPlatform) {
      return NextResponse.json({ error: "platform must be instagram, linkedin, or twitter" }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const mediaUrls = parseMediaUrls(mediaUrlInput);
    const downloadedFiles: File[] = [];
    for (let index = 0; index < mediaUrls.length; index += 1) {
      const fileFromUrl = await fetchImageAsFile(mediaUrls[index], index);
      downloadedFiles.push(fileFromUrl);
    }

    if (normalizedPlatform === "instagram" && uploadedFiles.length + downloadedFiles.length === 0) {
      return NextResponse.json(
        { error: "Instagram posts require at least one image (upload or valid image URL)." },
        { status: 400 },
      );
    }

    const outbound = new FormData();
    outbound.append("account_id", accountId);
    outbound.append("text", text);

    [...uploadedFiles, ...downloadedFiles].forEach((file) => {
      outbound.append("attachments", file, file.name || "attachment");
    });

    if (normalizedPlatform === "linkedin" && mediaUrls.length > 0 && uploadedFiles.length + downloadedFiles.length === 0) {
      outbound.append("external_link", mediaUrls[0]);
    }

    const response = await unipileMultipartRequest("/posts", {
      method: "POST",
      body: outbound,
    });

    try {
      const user = await getCurrentUser();
      if (user?.id) {
        const responseData = response && typeof response === "object" ? (response as Record<string, unknown>) : {};
        const postIdentifier =
          readString(responseData.id) ||
          readString(responseData.post_id) ||
          readString(responseData.urn) ||
          readString(responseData.uuid);

        const metadata = JSON.parse(
          JSON.stringify({
            title: `${normalizedPlatform.toUpperCase()} ${mode === "reel" ? "Reel" : "Post"}`,
            status: "PUBLISHED",
            postMode: mode,
            accountId,
            mediaUrl: mediaUrls[0] || null,
            mediaUrls,
            uploadedFileCount: uploadedFiles.length,
            downloadedFileCount: downloadedFiles.length,
            unipilePostId: postIdentifier || null,
            unipileResponse: responseData,
          }),
        );

        await prisma.unifiedMessage.create({
          data: {
            userId: user.id,
            platform: normalizedPlatform,
            contactId: accountId,
            contactName: normalizedPlatform,
            content: text,
            direction: "OUTBOUND",
            metadata,
          },
        });
      }
    } catch (error) {
      console.error("Failed to save post history", error);
    }

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish via Unipile" },
      { status: 500 },
    );
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}
