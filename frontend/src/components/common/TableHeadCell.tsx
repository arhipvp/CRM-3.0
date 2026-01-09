import React from 'react';

type TableHeadCellPadding = 'sm' | 'md' | 'lg';
type TableHeadCellAlign = 'left' | 'center' | 'right';

type TableHeadCellProps = Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'scope'> & {
  padding?: TableHeadCellPadding;
  align?: TableHeadCellAlign;
  scope?: React.ThHTMLAttributes<HTMLTableCellElement>['scope'];
};

const paddingClassNameBySize: Record<TableHeadCellPadding, string> = {
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
  lg: 'px-6 py-3',
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
    'border-slate-200',
    paddingClassNameBySize[padding],
    'text-[11px]',
    'uppercase',
    'tracking-[0.3em]',
    'text-slate-900',
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
