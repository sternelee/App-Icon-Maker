import { useState } from "react";
import {
  Form,
  ActionPanel,
  Action,
  useNavigation,
  Icon,
  getPreferenceValues,
  showToast,
  Toast,
} from "@raycast/api";
import type { Provider } from "./config";
import { PROVIDERS, MODEL_LIST, getDefaultModel } from "./config";
import { generateIcons } from "./api";
import { ResultsView } from "./results";
import { fileToBase64 } from "./utils";

interface Preferences {
  openaiApiKey: string;
  geminiApiKey: string;
  openrouterApiKey: string;
  falApiKey: string;
  stepfunApiKey: string;
}

const API_KEY_MAP: Record<Provider, keyof Preferences> = {
  openai: "openaiApiKey",
  gemini: "geminiApiKey",
  openrouter: "openrouterApiKey",
  fal: "falApiKey",
  stepfun: "stepfunApiKey",
};

export default function Command() {
  const { push } = useNavigation();
  const prefs = getPreferenceValues<Preferences>();
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(getDefaultModel("openai"));
  const [isLoading, setIsLoading] = useState(false);
  const [hasReference, setHasReference] = useState(false);

  const models = MODEL_LIST[provider] || [];

  function handleProviderChange(newProvider: string) {
    const p = newProvider as Provider;
    setProvider(p);
    setModel(getDefaultModel(p));
  }

  async function handleSubmit(values: {
    provider: string;
    model: string;
    prompt: string;
    numImages: string;
    referenceImage: string[];
  }) {
    const p = values.provider as Provider;
    const key = prefs[API_KEY_MAP[p]];

    if (!key) {
      await showToast({
        style: Toast.Style.Failure,
        title: "API Key Required",
        message: `Please set your ${p} API key in Raycast preferences`,
      });
      return;
    }

    if (!values.prompt.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Prompt Required",
        message: "Please enter a description for your app icon",
      });
      return;
    }

    let referenceImage: string | undefined;
    if (values.referenceImage && values.referenceImage.length > 0) {
      try {
        referenceImage = fileToBase64(values.referenceImage[0]);
      } catch (err) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Invalid Reference Image",
          message: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: referenceImage ? "Refining icon..." : "Generating icons...",
    });

    const result = await generateIcons({
      provider: p,
      model: values.model,
      prompt: values.prompt.trim(),
      apiKey: key,
      numImages: Number(values.numImages) || 3,
      referenceImage,
    });

    setIsLoading(false);

    if (result.error || result.images.length === 0) {
      toast.style = Toast.Style.Failure;
      toast.title = referenceImage ? "Refinement Failed" : "Generation Failed";
      toast.message = result.error || "No images returned";
      return;
    }

    toast.hide();
    push(
      <ResultsView
        images={result.images}
        prompt={values.prompt.trim()}
        provider={p}
        model={values.model}
        apiKey={key}
      />,
    );
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Generate App Icon"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={hasReference ? "Refine Icon" : "Generate Icon"}
            onSubmit={handleSubmit}
            icon={Icon.Wand}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="provider"
        title="Provider"
        value={provider}
        onChange={handleProviderChange}
        info={
          prefs[API_KEY_MAP[provider]]
            ? "API key configured"
            : "API key not set — configure in extension preferences"
        }
      >
        {PROVIDERS.map((p) => (
          <Form.Dropdown.Item
            key={p.value}
            value={p.value}
            title={p.label}
            icon={
              prefs[API_KEY_MAP[p.value]]
                ? Icon.CheckCircle
                : Icon.ExclamationMark
            }
          />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="model" title="Model" value={model} onChange={setModel}>
        {models.map((m) => (
          <Form.Dropdown.Item key={m.value} value={m.value} title={m.label} />
        ))}
      </Form.Dropdown>

      <Form.TextArea
        id="prompt"
        title="Prompt"
        placeholder="A sleek camera app icon with gradient glass background..."
        info="Describe the app icon you want. The system will add macOS styling automatically."
      />

      <Form.FilePicker
        id="referenceImage"
        title="Reference Image"
        allowMultipleSelection={false}
        info="Optional: select an existing image to use as reference for refinement"
        onChange={(files) => setHasReference(files && files.length > 0)}
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
