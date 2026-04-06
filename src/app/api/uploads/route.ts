import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

type UploadAsset = {
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    createdAt: string;
};

type UploadedAssetRecord = {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    createdAt: Date;
};

type UploadedAssetDelegate = {
    findMany(args: {
        where: { userId: string };
        orderBy: { createdAt: "desc" };
        select: {
            id: true;
            name: true;
            size: true;
            mimeType: true;
            createdAt: true;
        };
    }): Promise<UploadedAssetRecord[]>;
    create(args: {
        data: {
            userId: string;
            name: string;
            mimeType: string;
            size: number;
            data: Buffer;
        };
        select: {
            id: true;
            name: true;
            size: true;
            mimeType: true;
            createdAt: true;
        };
    }): Promise<UploadedAssetRecord>;
    deleteMany(args: {
        where: {
            id: string;
            userId: string;
        };
    }): Promise<{ count: number }>;
};

function getUploadedAssetDelegate(): UploadedAssetDelegate {
    return (prisma as unknown as { uploadedAsset: UploadedAssetDelegate }).uploadedAsset;
}

function toUploadAsset(item: {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    createdAt: Date;
}): UploadAsset {
    return {
        id: item.id,
        name: item.name,
        url: `/api/uploads/${encodeURIComponent(item.id)}`,
        size: item.size,
        mimeType: item.mimeType,
        createdAt: item.createdAt.toISOString(),
    };
}

export async function GET(request: NextRequest) {
    try {
        const user = await requireUser(request);
        const uploadedAsset = getUploadedAssetDelegate();

        const records = await uploadedAsset.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                size: true,
                mimeType: true,
                createdAt: true,
            },
        });

        const items = records.map((record: UploadedAssetRecord) => toUploadAsset(record));
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
        const uploadedAsset = getUploadedAssetDelegate();
        const formData = await request.formData();

        const candidates = [...formData.getAll("files"), ...formData.getAll("file")];
        const files = candidates.filter((value): value is File => value instanceof File && value.size > 0);

        if (files.length === 0) {
            return NextResponse.json({ error: "No image files were provided" }, { status: 400 });
        }

        const uploadedItems: UploadAsset[] = [];

        for (const file of files) {
            const mimeType = String(file.type || "").toLowerCase();
            if (!mimeType.startsWith("image/")) {
                return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 });
            }

            if (file.size > MAX_UPLOAD_BYTES) {
                return NextResponse.json({ error: `File too large: ${file.name}. Max size is 15 MB.` }, { status: 400 });
            }

            const bytes = Buffer.from(await file.arrayBuffer());

            const created = await uploadedAsset.create({
                data: {
                    userId: user.id,
                    name: file.name,
                    mimeType: mimeType || "image/*",
                    size: file.size,
                    data: bytes,
                },
                select: {
                    id: true,
                    name: true,
                    size: true,
                    mimeType: true,
                    createdAt: true,
                },
            });

            uploadedItems.push(toUploadAsset(created));
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
        const uploadedAsset = getUploadedAssetDelegate();
        const id = request.nextUrl.searchParams.get("id") || "";

        if (!id.trim()) {
            return NextResponse.json({ error: "Invalid upload id" }, { status: 400 });
        }

        const deleted = await uploadedAsset.deleteMany({
            where: {
                id: id.trim(),
                userId: user.id,
            },
        });

        if (deleted.count === 0) {
            return NextResponse.json({ error: "Upload not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({ error: "Failed to delete upload" }, { status: 500 });
    }
}
