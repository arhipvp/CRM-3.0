import type { ReactNode } from 'react';
import type { PolicyRecognitionResult } from '../../../../types';
import type { AppIconName } from '../../../common/AppIcon';
import { Button } from '../../../common/Button';
import type { ButtonSize, ButtonVariant } from '../../../common/buttonClassName';
import { formatRecognitionSummary } from '../helpers';

export const FILE_ACTION_LINK_CLASS = 'link-action text-xs disabled:text-slate-300';
export const SORT_HEADER_BUTTON_CLASS =
  'flex w-full items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
export const SORT_HEADER_TITLE_CLASS =
  'text-[11px] font-semibold uppercase tracking-wide text-rose-600 underline decoration-rose-500 decoration-2 underline-offset-2';
export const SORT_HEADER_VALUE_CLASS =
  'text-[11px] font-semibold uppercase tracking-wide text-slate-900';
export const PREVIEW_RENAME_INPUT_CLASS =
  'min-w-0 flex-1 border-none bg-transparent p-0 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-400';
export const RENAME_INPUT_CLASS =
  'min-w-0 flex-1 border-none bg-transparent p-0 text-sm text-slate-700 outline-none';

interface HeaderActionButtonProps {
  onClick: () => void | Promise<void>;
  disabled: boolean;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: AppIconName;
  children: ReactNode;
}

export function HeaderActionButton({
  onClick,
  disabled,
  className,
  variant,
  size,
  icon,
  children,
}: HeaderActionButtonProps) {
  return (
    <Button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      className={className}
      variant={variant}
      size={size}
      icon={icon}
    >
      {children}
    </Button>
  );
}

export function ActionLinkButton({
  onClick,
  disabled,
  children,
}: Pick<HeaderActionButtonProps, 'onClick' | 'disabled' | 'children'>) {
  return (
    <Button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      className={FILE_ACTION_LINK_CLASS}
    >
      {children}
    </Button>
  );
}

export function RecognitionResults({ results }: { results: PolicyRecognitionResult[] }) {
  if (!results.length) return null;
  return (
    <div className="ui-result-card">
      {results.map((result) => (
        <div key={`${result.fileId}-${result.status}`} className="space-y-1">
          <p className="font-semibold text-slate-900">{result.fileName ?? result.fileId}</p>
          <p
            className={`text-[11px] ${
              result.status === 'error'
                ? 'text-rose-600'
                : result.status === 'exists'
                  ? 'text-amber-600'
                  : 'text-slate-500'
            }`}
          >
            {formatRecognitionSummary(result)}
          </p>
        </div>
      ))}
    </div>
  );
}
