import EmailClassifierEditor from "../agents/gmail-classifier/editor";
import { BotIcon } from "lucide-react";

// Future imports:
// import { LinkedInAutomationEditor } from "../agents/linkedin-automation";

// Type for all standalone agent editor props
export interface StandaloneAgentEditorProps {
  agentId: string;
  isPreview?: boolean;
}

// Default fallback editor for unknown types
const DefaultStandaloneAgentEditor = ({ agentId }: StandaloneAgentEditorProps) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
          <BotIcon className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Standalone Agent</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Editor for this agent type is not yet configured
        </p>
      </div>
    </div>
  );
};

// Registry mapping agent types to their editor components
const EDITOR_COMPONENTS: Record<string, React.ComponentType<StandaloneAgentEditorProps>> = {
  GMAIL_CLASSIFIER: EmailClassifierEditor,
  // Future agents:
  // Add more as you create them...
};


/**
 * Get the appropriate editor component for a standalone agent type.
 * Returns a fallback component if the type is not found.
 */
export function getStandaloneAgentEditor(
  agentType: string
): React.ComponentType<StandaloneAgentEditorProps> {
  return EDITOR_COMPONENTS[agentType] || DefaultStandaloneAgentEditor;
}
