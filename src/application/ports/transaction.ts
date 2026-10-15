export interface Transaction {
  run<T>(work: () => T): T;
}
