/**
 * LedgerRepository — double-entry accounting (§37, §23–§24).
 *
 * Journal balance (sum debits == sum credits) is validated ATOMICALLY by the
 * implementation inside one database transaction together with the insert —
 * SQLite cannot defer a multi-row CHECK, so the contract (not a constraint)
 * carries the invariant. History is append-only; corrections are reversal
 * journals, never edits.
 */

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE" | "EQUITY";
  currency: string;
}

export interface JournalLeg {
  accountCode: string;
  debitMinor: number;
  creditMinor: number;
  memo?: string;
}

export interface LedgerRepository {
  findAccountByCode(code: string): Promise<LedgerAccount | null>;
  /**
   * Post a balanced journal atomically. Rejects unbalanced, empty, unknown-
   * account, non-positive, or unsafe-integer legs before writing anything.
   */
  postJournal(input: {
    refId: string;
    transactionId?: string | null;
    memo: string;
    reversalOfId?: string | null;
    legs: JournalLeg[];
  }): Promise<string>;
  entriesForJournal(journalId: string): Promise<Array<{ accountCode: string; debitMinor: number; creditMinor: number }>>;
  accountBalanceMinor(accountCode: string): Promise<{ debits: number; credits: number }>;
}
