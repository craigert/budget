import { liveQuery } from 'dexie';

/**
 * Reactive wrapper around Dexie's liveQuery. Use inside a component:
 *   const accounts = live(() => db.accounts.toArray(), []);
 *   {#each accounts.value as a}
 * The query auto-resubscribes when the DB changes.
 */
export function live<T>(querier: () => T | Promise<T>, initial: T) {
	let value = $state<T>(initial);
	let loading = $state(true);
	let error = $state<unknown>(null);

	$effect(() => {
		const sub = liveQuery(querier).subscribe({
			next: (v) => {
				value = v;
				loading = false;
				error = null;
			},
			error: (e) => {
				error = e;
				loading = false;
			}
		});
		return () => sub.unsubscribe();
	});

	return {
		get value() {
			return value;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		}
	};
}
