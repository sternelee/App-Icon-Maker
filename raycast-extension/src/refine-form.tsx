import { useState } from "react";
import {
  Form,
  ActionPanel,
  Action,
  useNavigation,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { generateIcons } from "./api";
import type { Provider } from "./config";
import { ResultsView } from "./results";

interface RefineFormProps {
  referenceImage: string; // base64 without data: prefix
  provider: Provider;
  model: string;
  apiKey: string;
  originalPrompt: string;
}

export function RefineForm({
  referenceImage,
  provider,
  model,
  apiKey,
  originalPrompt,
}: RefineFormProps) {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: { prompt: string; numImages: string }) {
    if (!values.prompt.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Prompt Required",
        message: "Please enter a description for the refined icon",
      });
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Refining icon...",
    });

    const result = await generateIcons({
      provider,
      model,
      prompt: values.prompt.trim(),
      apiKey,
      numImages: Number(values.numImages) || 3,
      referenceImage,
    });

    setIsLoading(false);

    if (result.error || result.images.length === 0) {
      toast.style = Toast.Style.Failure;
      toast.title = "Refinement Failed";
      toast.message = result.error || "No images returned";
      return;
    }

    toast.hide();
    push(
      <ResultsView
        images={result.images}
        prompt={values.prompt.trim()}
        provider={provider}
        model={model}
        apiKey={apiKey}
      />,
    );
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Refine Icon"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Refine Icon"
            onSubmit={handleSubmit}
            icon={Icon.Wand}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Reference Image"
        text="The selected icon will be used as a reference for the refinement."
      />
      <Form.Separator />
      <Form.TextArea
        id="prompt"
        title="New Prompt"
        defaultValue={originalPrompt}
        placeholder="Describe how you want to change the icon..."
        info="Describe the changes you want. The selected image will guide the generation."
      />
      <Form.Dropdown id="numImages" title="Variants" defaultValue="3">
        <Form.Dropdown.Item value="1" title="1" />
        <Form.Dropdown.Item value="2" title="2" />
        <Form.Dropdown.Item value="3" title="3" />
        <Form.Dropdown.Item value="4" title="4" />
      </Form.Dropdown>
    </Form>
  );
}
