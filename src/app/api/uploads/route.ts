import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
};

function sanitizeBaseName(input: string) {
    const base = input
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    return base || "image";
}

function normalizeExtension(fileName: string, mimeType: string) {
    const extFromName = path.extname(fileName || "").toLowerCase();
    if (MIME_BY_EXTENSION[extFromName]) {
        return extFromName;
    }

    const byMime = Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType)?.[0];
    return byMime || ".png";
}

function inferMimeType(fileName: string) {
    return MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()] || "image/*";
}

function toPublicUrl(userId: string, fileName: string) {
    return `/uploads/${encodeURIComponent(userId)}/${encodeURIComponent(fileName)}`;
}

function userDirectory(userId: string) {
    return path.join(UPLOADS_ROOT, userId);
}

function toCreatedAt(stats: { birthtime: Date; mtime: Date }) {
    const primary = stats.birthtime instanceof Date && Number.isFinite(stats.birthtime.getTime())
        ? stats.birthtime
        : stats.mtime;
    return primary.toISOString();
}

type UploadAsset = {
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    createdAt: string;
};

async function listUserAssets(userId: string): Promise<UploadAsset[]> {
    const dir = userDirectory(userId);
    await mkdir(dir, { recursive: true });

    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());

    const assets = await Promise.all(files.map(async (file) => {
        const fullPath = path.join(dir, file.name);
        const info = await stat(fullPath);

        return {
            id: file.name,
            name: file.name,
            url: toPublicUrl(userId, file.name),
            size: info.size,
            mimeType: inferMimeType(file.name),
            createdAt: toCreatedAt({ birthtime: info.birthtime, mtime: info.mtime }),
        } satisfies UploadAsset;
    }));

    return assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function GET(request: NextRequest) {
    try {
        const user = await requireUser(request);
        const items = await listUserAssets(user.id);
        return NextResponse.json({ success: true, items });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({ error: "Failed to load uploads" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await requireUser(request);
        const formData = await request.formData();

        const candidates = [...formData.getAll("files"), ...formData.getAll("file")];
        const files = candidates.filter((value): value is File => value instanceof File && value.size > 0);

        if (files.length === 0) {
            return NextResponse.json({ error: "No image files were provided" }, { status: 400 });
        }

        const dir = userDirectory(user.id);
        await mkdir(dir, { recursive: true });

        const uploadedItems: UploadAsset[] = [];

        for (const file of files) {
            const mimeType = String(file.type || "").toLowerCase();
            if (!mimeType.startsWith("image/")) {
                return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 });
            }

            if (file.size > MAX_UPLOAD_BYTES) {
                return NextResponse.json({ error: `File too large: ${file.name}. Max size is 15 MB.` }, { status: 400 });
            }

            const extension = normalizeExtension(file.name, mimeType);
            const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeBaseName(file.name)}${extension}`;
            const fullPath = path.join(dir, safeName);

            const bytes = Buffer.from(await file.arrayBuffer());
            await writeFile(fullPath, bytes);

            const info = await stat(fullPath);
            uploadedItems.push({
                id: safeName,
                name: file.name,
                url: toPublicUrl(user.id, safeName),
                size: info.size,
                mimeType: mimeType || inferMimeType(safeName),
                createdAt: toCreatedAt({ birthtime: info.birthtime, mtime: info.mtime }),
            });
        }

        return NextResponse.json({ success: true, items: uploadedItems });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({ error: "Failed to upload files" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const user = await requireUser(request);
        const id = request.nextUrl.searchParams.get("id") || "";
        const safeId = path.basename(id);

        if (!safeId || safeId !== id) {
            return NextResponse.json({ error: "Invalid upload id" }, { status: 400 });
        }

        const fullPath = path.join(userDirectory(user.id), safeId);
        await unlink(fullPath);

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({ error: "Failed to delete upload" }, { status: 500 });
    }
}
