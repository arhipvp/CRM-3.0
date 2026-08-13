import React from 'react';

export type TableHeadCellPadding = 'sm' | 'md' | 'lg';
export type TableHeadCellAlign = 'left' | 'center' | 'right';

type TableHeadCellProps = Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'scope'> & {
  padding?: TableHeadCellPadding;
  align?: TableHeadCellAlign;
  scope?: React.ThHTMLAttributes<HTMLTableCellElement>['scope'];
};

const paddingClassNameBySize: Record<TableHeadCellPadding, string> = {
  sm: 'px-3 py-2',
  md: 'px-3 py-2.5',
  lg: 'px-4 py-2.5',
};

const alignClassNameByAlign: Record<TableHeadCellAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export const TableHeadCell: React.FC<TableHeadCellProps> = ({
  padding = 'lg',
  align = 'left',
  scope = 'col',
  className,
  children,
  ...rest
}) => {
  const classes = [
    'border',
    'border-[var(--app-border)]',
    paddingClassNameBySize[padding],
    'text-[11px]',
    'font-semibold',
    'tracking-wide',
    'text-slate-600',
    alignClassNameByAlign[align],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <th scope={scope} className={classes} {...rest}>
      {children}
    </th>
  );
};
