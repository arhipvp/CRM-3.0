import React from "react";
import { Deal, Payment } from "../../types";

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("ru-RU") : "—");

interface PaymentsViewProps {
  payments: Payment[];
  deals: Deal[];
  onMarkPaid: (paymentId: string) => Promise<void>;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ payments, deals, onMarkPaid }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
          <tr>
            <th className="px-5 py-3">Сделка</th>
            <th className="px-5 py-3">Сумма</th>
            <th className="px-5 py-3">Плановая дата</th>
            <th className="px-5 py-3">Факт</th>
            <th className="px-5 py-3">Статус</th>
            <th className="px-5 py-3 text-right">Действие</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const deal = payment.dealId ? deals.find((d) => d.id === payment.dealId) : null;
            return (
              <tr key={payment.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{deal?.title || "—"}</p>
                  <p className="text-xs text-slate-500">{deal?.clientName || ""}</p>
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {Number(payment.amount).toLocaleString("ru-RU", { style: "currency", currency: "RUB" })}
                </td>
                <td className="px-5 py-4 text-slate-600">{formatDate(payment.scheduledDate)}</td>
                <td className="px-5 py-4 text-slate-600">{formatDate(payment.actualDate)}</td>
                <td className="px-5 py-4 text-slate-600">{payment.status}</td>
                <td className="px-5 py-4 text-right">
                  {payment.status !== "paid" ? (
                    <button
                      onClick={() => onMarkPaid(payment.id)}
                      className="text-sky-600 font-semibold hover:text-sky-800"
                    >
                      Отметить оплаченным
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 font-semibold">Оплачен</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!payments.length && (
            <tr>
              <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                Платежей пока нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
