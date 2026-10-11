import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { PROVIDER_CONFIG, type Provider } from "@app-icon-maker/utils";

export const PROVIDERS = Object.keys(PROVIDER_CONFIG) as Provider[];

export function ProviderSelect({
  provider,
  onChange,
  disabled,
  className,
}: {
  provider: Provider;
  onChange: (p: Provider) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={provider}
      onValueChange={(v) => v && onChange(v as Provider)}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "h-8 text-xs w-[150px]"}>
        <SelectValue placeholder="Select provider">
          {(v: any) => PROVIDER_CONFIG[v as Provider]?.label || v}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PROVIDERS.map((p) => (
          <SelectItem key={p} value={p}>
            {PROVIDER_CONFIG[p].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
