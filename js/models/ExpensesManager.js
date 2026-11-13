/**
 * Holds the list of transactions and provides every aggregate the UI needs.
 * The list itself is private; callers always receive copies.
 */
class expensesManager {
  #myTransactionsList;

  constructor(parameters = []) {
    this.#myTransactionsList = [...parameters];
  }

  add(val) {
    this.#myTransactionsList.push(val);
  }

  /**
   * Deletes by id.
   * @returns {boolean} true when a transaction was actually removed.
   */
  remove(wantToDeleteId) {
    const before = this.#myTransactionsList.length;
    this.#myTransactionsList = this.#myTransactionsList.filter(
      (element) => element.id !== wantToDeleteId,
    );
    return this.#myTransactionsList.length !== before;
  }

  makeCopy() {
    return [...this.#myTransactionsList];
  }

  filtering(conditionOfFiltering) {
    return this.makeCopy().filter(conditionOfFiltering);
  }

  // Sums raw (always positive) values, guarding against bad/legacy data.
  #sum(transactions) {
    return transactions.reduce((acc, t) => acc + (Number(t.value) || 0), 0);
  }

  totalBalance() {
    return this.#myTransactionsList.reduce(
      (acc, t) => acc + (Number(t.signedAmount) || 0),
      0,
    );
  }

  /**
   * Everything that is not an expense is treated as income, so the invariant
   * totalIncome() - totalExpenses() === totalBalance() always holds.
   */
  totalIncome() {
    return this.#sum(this.#myTransactionsList.filter((t) => !t.isExpense));
  }

  totalExpenses() {
    return this.#sum(this.#myTransactionsList.filter((t) => t.isExpense));
  }

  /**
   * Total amount per kind (both income and expenses).
   * @returns {Map<string, number>} e.g. Map { "اكل" => 1200 }
   */
  totalPerCategory() {
    return this.#myTransactionsList.reduce((acc, t) => {
      const current = acc.get(t.kind) ?? 0;
      acc.set(t.kind, current + (Number(t.value) || 0));
      return acc;
    }, new Map());
  }

  allCategories() {
    return new Set(this.#myTransactionsList.map((t) => t.kind));
  }

  count() {
    return this.#myTransactionsList.length;
  }

  *[Symbol.iterator]() {
    for (const t of this.#myTransactionsList) {
      yield t;
    }
  }

  /**
   * Yields transactions of one calendar month.
   * @param {number} month 1-based month (1 = January).
   * @param {number} year full year, e.g. 2026.
   */
  *transactionPerMonth(month, year) {
    for (const t of this.#myTransactionsList) {
      const day = t.day instanceof Date ? t.day : new Date(t.day);
      if (Number.isNaN(day.getTime())) continue;
      if (day.getMonth() + 1 === month && day.getFullYear() === year) {
        yield t;
      }
    }
  }

  predictedSavings(months, monthlyRate, principal) {
    return principal * (1 + monthlyRate) ** months;
  }
}
export { expensesManager };
