// Root Pinia store registration. M2 registers `tasks` + `auth`. M4 will register `feeds`.
import type { Pinia } from 'pinia';

export { useAuthStore } from './auth';
export { useTasksStore } from './tasks';

export function registerStores(_pinia: Pinia): void {
  // Stores self-register on first use; nothing to do here yet.
}
