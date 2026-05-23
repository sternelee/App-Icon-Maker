import { useMemo } from "react";
import {
  Grid,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
  getPreferenceValues,
} from "@raycast/api";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runAppleScript } from "@raycast/utils";
import { saveBase64Image } from "./api";

interface ResultsViewProps {
  images: string[];
  prompt: string;
}

interface Preferences {
  saveDirectory: string;
}

export function ResultsView({ images, prompt }: ResultsViewProps) {
  const prefs = getPreferenceValues<Preferences>();
  const items = useMemo(() => {
    return images.map((b64, i) => {
      const filename = `icon-${Date.now()}-${i + 1}.png`;
      const filepath = saveBase64Image(b64, filename);
      return { b64, filepath, filename, index: i + 1 };
    });
  }, [images]);

  async function saveToDirectory(filepath: string, dir: string) {
    const dest = path.join(dir, path.basename(filepath));
    fs.copyFileSync(filepath, dest);
    await showToast({
      style: Toast.Style.Success,
      title: "Saved",
      message: dest,
    });
  }

  async function saveToDownloads(filepath: string) {
    const downloads = path.join(os.homedir(), "Downloads");
    await saveToDirectory(filepath, downloads);
  }

  async function saveToCustom(filepath: string) {
    const dir = prefs.saveDirectory;
    if (dir && fs.existsSync(dir)) {
      await saveToDirectory(filepath, dir);
    } else {
      await saveToDownloads(filepath);
    }
  }

  async function copyToClipboard(filepath: string) {
    try {
      await runAppleScript(`
				set theImage to read (POSIX file "${filepath}") as «class PNGf»
				set the clipboard to theImage
			`);
      await showToast({
        style: Toast.Style.Success,
        title: "Copied to Clipboard",
      });
    } catch {
      // Fallback: copy file path
      await runAppleScript(`set the clipboard to "${filepath}"`);
      await showToast({
        style: Toast.Style.Success,
        title: "File path copied",
      });
    }
  }

  async function revealInFinder(filepath: string) {
    await runAppleScript(
      `tell application "Finder" to reveal POSIX file "${filepath}"`,
    );
    await runAppleScript(`tell application "Finder" to activate`);
  }

  return (
    <Grid
      columns={3}
      inset={Grid.Inset.Zero}
      searchBarPlaceholder="Filter variants..."
      navigationTitle={`Results: ${prompt}`}
    >
      {items.map((item) => (
        <Grid.Item
          key={item.index}
          content={{ source: item.filepath }}
          title={`Variant ${item.index}`}
          actions={
            <ActionPanel>
              <Action
                title="Save to Downloads"
                icon={Icon.Download}
                onAction={() => saveToDownloads(item.filepath)}
              />
              <Action
                title="Save to Default Directory"
                icon={Icon.Folder}
                onAction={() => saveToCustom(item.filepath)}
              />
              <Action
                title="Copy to Clipboard"
                icon={Icon.Clipboard}
                onAction={() => copyToClipboard(item.filepath)}
              />
              <Action
                title="Reveal in Finder"
                icon={Icon.Finder}
                onAction={() => revealInFinder(item.filepath)}
              />
            </ActionPanel>
          }
        />
      ))}
    </Grid>
  );
}
