import { useEffect, useRef, useCallback } from "react";
import { useAppStore, type ToolManifest } from "../../stores/appStore";
import "./ToolFrame.css";

interface Props {
  tool: ToolManifest;
}

export function ToolFrame({ tool }: Props) {
  const closeTool = useAppStore((s) => s.closeTool);
  const dataDir = useAppStore((s) => s.dataDir);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        closeTool();
      }
    },
    [closeTool]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Bridge: handle postMessage from iframe for template data sync
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (!dataDir) return;

      if (e.data?.type === "mp-request-templates") {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const raw: string = await invoke("read_msg_templates", {
            dataDir,
          });
          frameRef.current?.contentWindow?.postMessage(
            { type: "mp-templates-data", templates: JSON.parse(raw) },
            "*"
          );
        } catch {
          frameRef.current?.contentWindow?.postMessage(
            { type: "mp-templates-data", templates: [] },
            "*"
          );
        }
      } else if (e.data?.type === "mp-save-templates") {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("write_msg_templates", {
            dataDir,
            json: JSON.stringify(e.data.templates, null, 2),
          });
        } catch {
          /* silent */
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [dataDir]);

  const toolPath = `/custom-tools/${tool.id}/index.html`;

  return (
    <div className="toolframe-shell">
      <div className="toolframe-body">
        <iframe
          ref={frameRef}
          src={toolPath}
          className="toolframe-iframe"
          title={tool.name}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  );
}
