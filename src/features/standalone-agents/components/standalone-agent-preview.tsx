"use client";

import { getStandaloneAgentEditor } from "../lib/get-standalone-agent-editor";
import { cn } from "@/lib/utils";

interface StandaloneAgentPreviewProps {
  agentType: string;
  agentId?: string;
  className?: string;
  fullSize?: boolean;
}

export const StandaloneAgentPreview = ({
  agentType,
  agentId,
  className,
  fullSize = false,
}: StandaloneAgentPreviewProps) => {
  // Get the editor component for this agent type
  const EditorComponent = getStandaloneAgentEditor(agentType);

  // Use actual agentId if provided, otherwise use "preview" for placeholder
  const actualAgentId = agentId || "preview";

  // For modal (full-size preview)
  if (fullSize) {
    return (
      <div
        className={cn("relative bg-background min-h-0 overflow-auto", className)}
        style={{ width: "100%", height: "100%" }}
      >
        <div className="preview-mode" style={{ pointerEvents: "auto" }}>
          <EditorComponent agentId={actualAgentId} isPreview={true} />
        </div>
        <style jsx global>{`
          .preview-mode button:not(.pagination-button),
          .preview-mode [role="button"]:not(.pagination-button) {
            pointer-events: none !important;
            cursor: default !important;
          }
          /* Disable all input fields, textareas, and selects */
          .preview-mode input,
          .preview-mode textarea,
          .preview-mode select {
            pointer-events: none !important;
            cursor: default !important;
          }
          /* Allow pagination buttons */
          .preview-mode button.pagination-button {
            pointer-events: auto !important;
          }
        `}</style>
      </div>
    );
  }

  // For card preview (scaled down)
  return (
    <div
      className={cn("relative bg-background/95 min-h-0", className)}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    >
      <div className="absolute inset-0">
        <div
          style={{
            width: "400%",
            height: "400%",
            transform: "scale(0.25)",
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        >
          <EditorComponent agentId={actualAgentId} isPreview={true} />
        </div>
      </div>
    </div>
  );
};
