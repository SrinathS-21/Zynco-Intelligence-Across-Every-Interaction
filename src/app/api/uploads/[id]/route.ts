import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteContext = {
    params: Promise<{ id: string }>;
};

type UploadedAssetDataRecord = {
    data: Buffer;
    mimeType: string;
    name: string;
    updatedAt: Date;
};

type UploadedAssetReadDelegate = {
    findFirst(args: {
        where: {
            id: string;
            userId: string;
        };
        select: {
            data: true;
            mimeType: true;
            name: true;
            updatedAt: true;
        };
    }): Promise<UploadedAssetDataRecord | null>;
};

function getUploadedAssetDelegate(): UploadedAssetReadDelegate {
    return (prisma as unknown as { uploadedAsset: UploadedAssetReadDelegate }).uploadedAsset;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const user = await requireUser(request);
        const uploadedAsset = getUploadedAssetDelegate();
        const { id } = await params;
        const uploadId = String(id || "").trim();

        if (!uploadId) {
            return NextResponse.json({ error: "Invalid upload id" }, { status: 400 });
        }

        const asset = await uploadedAsset.findFirst({
            where: {
                id: uploadId,
                userId: user.id,
            },
            select: {
                data: true,
                mimeType: true,
                name: true,
                updatedAt: true,
            },
        });

        if (!asset) {
            return NextResponse.json({ error: "Upload not found" }, { status: 404 });
        }

        const bytes = Buffer.from(asset.data);

        return new NextResponse(bytes, {
            status: 200,
            headers: {
                "Content-Type": asset.mimeType || "application/octet-stream",
                "Content-Length": String(bytes.length),
                "Content-Disposition": `inline; filename="${asset.name.replace(/\"/g, "")}"`,
                "Cache-Control": "private, max-age=3600",
                "Last-Modified": asset.updatedAt.toUTCString(),
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({ error: "Failed to load upload" }, { status: 500 });
    }
}
