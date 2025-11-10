import React, { useMemo } from "react";
import { Payment } from "../../types";

interface FinanceViewProps {
  payments: Payment[];
}

export const FinanceView: React.FC<FinanceViewProps> = ({ payments }) => {
  const stats = useMemo(() => {
    const planned = payments.filter((p) => p.status === "planned");
    const partial = payments.filter((p) => p.status === "partial");
    const paid = payments.filter((p) => p.status === "paid");

    const sum = (items: Payment[]) =>
      items.reduce((total, item) => total + Number(item.amount || 0), 0);

    return {
      planned: sum(planned),
      partial: sum(partial),
      paid: sum(paid),
      total: sum(payments),
    };
  }, [payments]);

  const formatRub = (value: number) =>
    value.toLocaleString("ru-RU", { style: "currency", currency: "RUB" });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-sm text-slate-500">Всего</p>
        <p className="text-3xl font-semibold text-slate-900">{formatRub(stats.total)}</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-sm text-slate-500">План</p>
        <p className="text-3xl font-semibold text-slate-900">{formatRub(stats.planned)}</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-sm text-slate-500">Частично</p>
        <p className="text-3xl font-semibold text-slate-900">{formatRub(stats.partial)}</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-sm text-slate-500">Оплачено</p>
        <p className="text-3xl font-semibold text-slate-900 text-green-600">{formatRub(stats.paid)}</p>
      </div>
    </div>
  );
};
