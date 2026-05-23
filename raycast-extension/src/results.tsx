import { useMemo, useState } from "react";
import {
  Grid,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
  useNavigation,
  popToRoot,
} from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { saveBase64Image } from "./api";
import { DetailView } from "./detail-view";
import { RefineForm } from "./refine-form";
import type { Provider } from "./config";

interface ResultsViewProps {
  images: string[];
  prompt: string;
  provider: Provider;
  model: string;
  apiKey: string;
}

export function ResultsView({
  images,
  prompt,
  provider,
  model,
  apiKey,
}: ResultsViewProps) {
  const { push } = useNavigation();
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  async function saveAll() {
    const downloads = path.join(os.homedir(), "Downloads");
    for (const item of items) {
      const dest = path.join(downloads, item.filename);
      fs.copyFileSync(item.filepath, dest);
    }
    await showToast({
      style: Toast.Style.Success,
      title: "Saved All",
      message: `${items.length} icons saved to Downloads`,
    });
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

  const selectedItem = items[selectedIndex];

  return (
    <Grid
      columns={3}
      inset={Grid.Inset.Zero}
      searchBarPlaceholder="Filter variants..."
      navigationTitle={`Results: ${prompt}`}
      onSelectionChange={(id) => {
        if (id) setSelectedIndex(Number(id) - 1);
      }}
      actions={
        selectedItem ? (
          <ActionPanel>
            <Action
              title="Save Selected"
              icon={Icon.Download}
              onAction={() => saveToDownloads(selectedItem.filepath)}
            />
            <Action
              title="Refine Selected"
              icon={Icon.Wand}
              onAction={() =>
                push(
                  <RefineForm
                    referenceImage={selectedItem.b64}
                    provider={provider}
                    model={model}
                    apiKey={apiKey}
                    originalPrompt={prompt}
                  />,
                )
              }
            />
            <Action
              title="View Large"
              icon={Icon.Eye}
              onAction={() =>
                push(
                  <DetailView
                    imagePath={selectedItem.filepath}
                    title={`Variant ${selectedItem.index}`}
                  />,
                )
              }
            />
            <Action
              title="Copy to Clipboard"
              icon={Icon.Clipboard}
              onAction={() => copyToClipboard(selectedItem.filepath)}
            />
            <Action
              title="Reveal in Finder"
              icon={Icon.Finder}
              onAction={() => revealInFinder(selectedItem.filepath)}
            />
            <Action
              title="Save All"
              icon={Icon.SaveDocument}
              onAction={saveAll}
            />
            <Action
              title="Regenerate"
              icon={Icon.RotateAntiClockwise}
              onAction={() => popToRoot()}
            />
          </ActionPanel>
        ) : undefined
      }
    >
      {items.map((item) => (
        <Grid.Item
          key={item.index}
          id={String(item.index)}
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
                title="Refine"
                icon={Icon.Wand}
                onAction={() =>
                  push(
                    <RefineForm
                      referenceImage={item.b64}
                      provider={provider}
                      model={model}
                      apiKey={apiKey}
                      originalPrompt={prompt}
                    />,
                  )
                }
              />
              <Action
                title="View Large"
                icon={Icon.Eye}
                onAction={() =>
                  push(
                    <DetailView
                      imagePath={item.filepath}
                      title={`Variant ${item.index}`}
                    />,
                  )
                }
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
              <Action
                title="Save All"
                icon={Icon.SaveDocument}
                onAction={saveAll}
              />
              <Action
                title="Regenerate"
                icon={Icon.RotateAntiClockwise}
                onAction={() => popToRoot()}
              />
            </ActionPanel>
          }
        />
      ))}
    </Grid>
  );
}
