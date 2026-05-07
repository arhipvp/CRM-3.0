import type React from 'react';

import { parseClipboardDateToIso } from '../../../utils/dateInput';

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const DateInput: React.FC<DateInputProps> = ({ onChange, onPaste, ...props }) => {
  const handlePaste: React.ClipboardEventHandler<HTMLInputElement> = (event) => {
    const isoDate = parseClipboardDateToIso(event.clipboardData.getData('text'));
    if (!isoDate) {
      onPaste?.(event);
      return;
    }

    event.preventDefault();
    event.currentTarget.value = isoDate;
    onChange?.({
      ...event,
      currentTarget: event.currentTarget,
      target: event.currentTarget,
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return <input {...props} type="date" onChange={onChange} onPaste={handlePaste} />;
};
