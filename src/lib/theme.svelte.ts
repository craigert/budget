import { db } from './db';

type Theme = 'light' | 'dark' | 'system';

class ThemeStore {
	value = $state<Theme>('system');
	resolved = $state<'light' | 'dark'>('light');

	async init() {
		const setting = await db.settings.get('theme');
		if (setting?.value === 'light' || setting?.value === 'dark' || setting?.value === 'system') {
			this.value = setting.value;
		}
		this.apply();
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		mq.addEventListener('change', () => this.apply());
	}

	apply() {
		const dark =
			this.value === 'dark' ||
			(this.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		this.resolved = dark ? 'dark' : 'light';
		document.documentElement.classList.toggle('dark', dark);
	}

	async set(v: Theme) {
		this.value = v;
		await db.settings.put({ key: 'theme', value: v });
		this.apply();
	}

	cycle() {
		const next: Theme = this.value === 'light' ? 'dark' : this.value === 'dark' ? 'system' : 'light';
		this.set(next);
	}
}

export const theme = new ThemeStore();
