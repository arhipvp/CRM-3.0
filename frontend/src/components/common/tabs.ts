import type { KeyboardEvent } from 'react';

interface TabKeyboardNavigationOptions<T extends string> {
  event: KeyboardEvent<HTMLButtonElement>;
  tabs: readonly T[];
  activeTab: T;
  onChange: (tab: T) => void;
  getTabElementId: (tab: T) => string;
}

export const handleTabKeyboardNavigation = <T extends string>({
  event,
  tabs,
  activeTab,
  onChange,
  getTabElementId,
}: TabKeyboardNavigationOptions<T>) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || tabs.length === 0) {
    return;
  }

  event.preventDefault();
  const currentIndex = Math.max(0, tabs.indexOf(activeTab));
  let nextIndex = currentIndex;
  if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = tabs.length - 1;
  } else if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  }

  const nextTab = tabs[nextIndex];
  onChange(nextTab);
  document.getElementById(getTabElementId(nextTab))?.focus();
};
