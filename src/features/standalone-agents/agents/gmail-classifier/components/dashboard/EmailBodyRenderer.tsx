"use client";

import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface EmailBodyRendererProps {
    htmlBody?: string;
    textBody?: string;
}

function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function looksLikeHtml(value: string): boolean {
    return /<!doctype|<html|<body|<table|<div|<p\b|<a\b|<img\b|<tr\b|<td\b|<style\b|<head\b|<\/\w+/i.test(value);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function shortUrlLabel(url: string): string {
    if (url.length <= 100) return url;
    return `${url.slice(0, 56)}...${url.slice(-24)}`;
}

function formatPlainTextEmail(text: string): string {
    const escaped = escapeHtml(text);
    const urlRegex = /(https?:\/\/[^\s<]+)/g;

    return escaped
        .replace(urlRegex, (url) => {
            const safeHref = escapeHtml(url);
            const label = escapeHtml(shortUrlLabel(url));
            return `<a href="${safeHref}" target="_blank" rel="noreferrer noopener">${label}</a>`;
        })
        .replace(/\n/g, "<br />");
}

export function EmailBodyRenderer({ htmlBody, textBody }: EmailBodyRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const normalizedHtml = String(htmlBody || "").trim();
    const hasRenderableHtml = /<\s*[a-z][\s\S]*>/i.test(normalizedHtml);
    const rawTextBody = String(textBody || htmlBody || "").trim();
    const decodedTextBody = decodeHtmlEntities(rawTextBody);
    const htmlFromTextBody = !hasRenderableHtml
        ? (looksLikeHtml(rawTextBody) ? rawTextBody : (looksLikeHtml(decodedTextBody) ? decodedTextBody : ""))
        : "";
    const htmlToRender = hasRenderableHtml ? normalizedHtml : htmlFromTextBody;
    const shouldRenderHtml = Boolean(htmlToRender);
    const effectiveTextBody = shouldRenderHtml ? "" : rawTextBody;

    useEffect(() => {
        if (!containerRef.current) return;

        // Prefer real HTML body, fallback to plain text.
        const content = shouldRenderHtml ? htmlToRender : effectiveTextBody;
        if (!content) return;

        if (shouldRenderHtml) {
            // Sanitize HTML to prevent XSS attacks
            const clean = DOMPurify.sanitize(htmlToRender.replace(/\{\{[^}]+\}\}/g, ""), {
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

            // Remove hidden/tracking elements that add noise but no user value.
            const hiddenElements = containerRef.current.querySelectorAll(
                '[style*="display:none"], [style*="opacity:0"], [style*="max-height:0"], [style*="font-size:0"], [width="0"], [height="0"]',
            );
            hiddenElements.forEach((node) => {
                node.remove();
            });

            // Handle broken images - hide them instead of showing broken icon
            const images = containerRef.current.querySelectorAll("img");
            images.forEach((img) => {
                const widthAttr = Number(img.getAttribute("width") || "0");
                const heightAttr = Number(img.getAttribute("height") || "0");
                if ((Number.isFinite(widthAttr) && widthAttr <= 1) || (Number.isFinite(heightAttr) && heightAttr <= 1)) {
                    img.style.display = "none";
                }

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
            // Render plain text with preserved lines and shortened clickable URLs.
            containerRef.current.innerHTML = DOMPurify.sanitize(formatPlainTextEmail(effectiveTextBody), {
                ALLOWED_TAGS: ["a", "br"],
                ALLOWED_ATTR: ["href", "target", "rel"],
            });
        }
    }, [effectiveTextBody, htmlToRender, shouldRenderHtml]);

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
                .email-body-content,
                .email-body-content * {
                    overflow-wrap: anywhere;
                    word-break: break-word;
                }
            `}</style>
            <div
                ref={containerRef}
                className={shouldRenderHtml
                    ? "email-body-content prose prose-sm dark:prose-invert max-w-none"
                    : "email-body-content whitespace-pre-wrap wrap-anywhere text-[14px] leading-7 text-foreground/90"}
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
