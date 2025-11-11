import React, { useState } from "react";

export interface AddFinancialTransactionFormValues {
  transactionType: "income" | "expense";
  amount: string;
  description: string;
  transactionDate: string;
  source: string;
  category: string;
  note: string;
  dealId?: string;
}

interface AddFinancialTransactionFormProps {
  onSubmit: (data: AddFinancialTransactionFormValues) => Promise<void>;
  onCancel: () => void;
  dealId?: string;
}

export function AddFinancialTransactionForm({
  onSubmit,
  onCancel,
  dealId,
}: AddFinancialTransactionFormProps) {
  const [formData, setFormData] = useState<AddFinancialTransactionFormValues>({
    transactionType: "income",
    amount: "",
    description: "",
    transactionDate: new Date().toISOString().split("T")[0],
    source: "",
    category: "",
    note: "",
    dealId,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.amount) {
        throw new Error("Сумма обязательна");
      }
      if (!formData.transactionDate) {
        throw new Error("Дата обязательна");
      }

      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message || "Ошибка при создании транзакции");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-financial-transaction-form">
      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="transactionType">Тип транзакции *</label>
        <select
          id="transactionType"
          name="transactionType"
          value={formData.transactionType}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="income">Доход</option>
          <option value="expense">Расход</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Сумма (руб.) *</label>
        <input
          type="number"
          id="amount"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          placeholder="0.00"
          step="0.01"
          disabled={loading}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="transactionDate">Дата транзакции *</label>
        <input
          type="date"
          id="transactionDate"
          name="transactionDate"
          value={formData.transactionDate}
          onChange={handleChange}
          disabled={loading}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Описание</label>
        <input
          type="text"
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Описание транзакции"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="source">Источник</label>
        <input
          type="text"
          id="source"
          name="source"
          value={formData.source}
          onChange={handleChange}
          placeholder="Источник дохода/платежа"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="category">Категория</label>
        <input
          type="text"
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          placeholder="Категория расхода"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="note">Примечание</label>
        <textarea
          id="note"
          name="note"
          value={formData.note}
          onChange={handleChange}
          placeholder="Дополнительные примечания"
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Создание..." : "Создать"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="btn-secondary"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
