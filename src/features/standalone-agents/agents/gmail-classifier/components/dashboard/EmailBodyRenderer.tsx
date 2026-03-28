"use client";

import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface EmailBodyRendererProps {
    htmlBody?: string;
    textBody?: string;
}

export function EmailBodyRenderer({ htmlBody, textBody }: EmailBodyRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Prefer HTML body, fallback to text
        const content = htmlBody || textBody;
        if (!content) return;

        if (htmlBody) {
            // Sanitize HTML to prevent XSS attacks
            const clean = DOMPurify.sanitize(htmlBody, {
                ALLOWED_TAGS: [
                    "p", "br", "div", "span", "a", "b", "i", "u", "strong", "em",
                    "h1", "h2", "h3", "h4", "h5", "h6",
                    "ul", "ol", "li",
                    "table", "thead", "tbody", "tr", "td", "th",
                    "img", "blockquote", "pre", "code",
                ],
                ALLOWED_ATTR: [
                    "href", "src", "alt", "title", "class", "style",
                    "target", "rel", "width", "height", "id", "data-*",
                ],
                ALLOW_DATA_ATTR: true,
            });

            containerRef.current.innerHTML = clean;

            // Handle broken images - hide them instead of showing broken icon
            const images = containerRef.current.querySelectorAll("img");
            images.forEach((img) => {
                // Hide broken images
                img.addEventListener("error", () => {
                    img.style.display = "none";
                });

                // For images with cid: or data: URLs that might fail
                if (img.src.startsWith("cid:") || img.src.startsWith("data:")) {
                    // Try to load, but hide if it fails
                    img.addEventListener("error", () => {
                        img.style.display = "none";
                    });
                }
            });
        } else {
            // Render plain text with line breaks preserved
            containerRef.current.textContent = textBody || "";
        }
    }, [htmlBody, textBody]);

    if (!htmlBody && !textBody) {
        return (
            <Card className="p-6 bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">No email content available</span>
                </div>
            </Card>
        );
    }

    return (
        <>
            <style jsx>{`
                .email-body-content img[src^="cid:"] {
                    display: none !important;
                }
                .email-body-content img {
                    max-width: 100%;
                    height: auto;
                }
            `}</style>
            <div
                ref={containerRef}
                className="email-body-content prose prose-sm dark:prose-invert max-w-none"
                style={{
                    // Custom styles for email rendering
                    lineHeight: "1.6",
                    fontSize: "14px",
                    color: "inherit",
                }}
            />
        </>
    );
}
