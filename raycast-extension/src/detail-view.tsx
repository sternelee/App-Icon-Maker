import { Detail, ActionPanel, Action, Icon } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { showToast, Toast } from "@raycast/api";

interface DetailViewProps {
  imagePath: string;
  title?: string;
}

export function DetailView({ imagePath, title }: DetailViewProps) {
  async function saveToDownloads() {
    const downloads = path.join(os.homedir(), "Downloads");
    const dest = path.join(downloads, path.basename(imagePath));
    fs.copyFileSync(imagePath, dest);
    await showToast({
      style: Toast.Style.Success,
      title: "Saved",
      message: dest,
    });
  }

  async function copyToClipboard() {
    try {
      await runAppleScript(`
        set theImage to read (POSIX file "${imagePath}") as «class PNGf»
        set the clipboard to theImage
      `);
      await showToast({
        style: Toast.Style.Success,
        title: "Copied to Clipboard",
      });
    } catch {
      await runAppleScript(`set the clipboard to "${imagePath}"`);
      await showToast({
        style: Toast.Style.Success,
        title: "File path copied",
      });
    }
  }

  async function revealInFinder() {
    await runAppleScript(
      `tell application "Finder" to reveal POSIX file "${imagePath}"`,
    );
    await runAppleScript(`tell application "Finder" to activate`);
  }

  const markdown = `![${title || "Generated Icon"}](file://${imagePath})`;

  return (
    <Detail
      navigationTitle={title || "Icon Preview"}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Save to Downloads"
            icon={Icon.Download}
            onAction={saveToDownloads}
          />
          <Action
            title="Copy to Clipboard"
            icon={Icon.Clipboard}
            onAction={copyToClipboard}
          />
          <Action
            title="Reveal in Finder"
            icon={Icon.Finder}
            onAction={revealInFinder}
          />
        </ActionPanel>
      }
    />
  );
}
