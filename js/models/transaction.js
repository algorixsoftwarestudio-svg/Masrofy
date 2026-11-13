/**
 * A single money movement.
 * The id is generated automatically and restored from storage when present,
 * so ids stay unique across reloads.
 */
class Transaction {
  static #id = 1;
  #uid;

  constructor({
    name = "محمد",
    kind = "ايجار",
    category = "صرف",
    notes = "لا يوجد",
    salary = 0,
    value = 0,
    date = new Date(),
    id = null,
  } = {}) {
    this.name = name;
    this.kind = kind;
    this.category = category;
    this.notes = notes;
    this.salary = salary;
    // Stored values may arrive as strings (localStorage / number inputs).
    this.value = Number(value) || 0;
    this.day = Transaction.#toValidDate(date);

    if (id != null) {
      this.#uid = id;
      // Keep the static counter ahead of every restored id.
      Transaction.#id = Math.max(Transaction.#id, Number(id) + 1);
    } else {
      this.#uid = Transaction.#id;
      Transaction.#id += 1;
    }
  }

  // Normalizes whatever we receive (Date, ISO string, timestamp) into a Date.
  static #toValidDate(value) {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  get id() {
    return this.#uid;
  }

  /** True for "صرف" (expense) rows — the signed amount is negative. */
  get isExpense() {
    return this.category === "صرف";
  }

  valuereader(num, category) {
    if (category == "صرف") {
      return -num;
    } else {
      return num;
    }
  }

  get signedAmount() {
    return this.valuereader(this.value, this.category);
  }

  static fromString(str) {
    let [amount, ...rest] = str.split(" ");
    return new Transaction({ name: rest.join(" "), value: Number(amount) });
  }

  toJSON() {
    return {
      id: this.#uid,
      name: this.name,
      kind: this.kind,
      category: this.category,
      notes: this.notes,
      value: this.value,
      salary: this.salary,
      day: this.day,
    };
  }

  static fromJSON(data) {
    let myTransaction = JSON.parse(data);
    myTransaction.date = new Date(myTransaction.day);
    return new Transaction(myTransaction);
  }
}
export { Transaction };
