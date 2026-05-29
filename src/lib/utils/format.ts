let currency = 'USD';
let nf = new Intl.NumberFormat('en-US', { style: 'currency', currency });
let nfSigned = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency,
	signDisplay: 'always'
});

export function setCurrency(c: string) {
	currency = c;
	nf = new Intl.NumberFormat('en-US', { style: 'currency', currency });
	nfSigned = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
		signDisplay: 'always'
	});
}

export function money(amount: number): string {
	return nf.format(amount);
}

/** Whole-dollar money for big headline numbers — "$103,890". Always positive
 *  because the design treats sign separately with ↑/↓ glyphs. */
const _nf0 = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0
});
export function money0(amount: number): string {
	return _nf0.format(Math.abs(amount));
}

/** Friendly relative date: "Today" / "Yesterday" / "May 24". Matches the
 *  format the design's data.js uses for recent activity. */
export function friendlyDate(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	const target = new Date(y, m - 1, d);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Yesterday';
	if (diffDays > 1 && diffDays < 7) {
		return target.toLocaleDateString(undefined, { weekday: 'long' });
	}
	return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function moneySigned(amount: number): string {
	return nfSigned.format(amount);
}

export function todayISO(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function thisMonth(): string {
	return todayISO().slice(0, 7);
}

export function monthLabel(month: string): string {
	const [y, m] = month.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function addMonths(month: string, delta: number): string {
	const [y, m] = month.split('-').map(Number);
	const d = new Date(y, m - 1 + delta, 1);
	const yy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	return `${yy}-${mm}`;
}

export function formatDate(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}
