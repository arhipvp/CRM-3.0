const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (EDITABLE_TAGS.has(target.tagName)) {
    return true;
  }

  return target.isContentEditable || Boolean(target.closest('[contenteditable="true"]'));
};
