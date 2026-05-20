// Curated icon palette for the Categories picker. All paths resolve to
// /static/icons/<name>.svg and are rendered by <Icon>.

export const ICON_GROUPS: { label: string; icons: string[] }[] = [
	{
		label: 'Money',
		icons: [
			'finance-ecommerce/coins-01',
			'finance-ecommerce/coins-02',
			'finance-ecommerce/coins-stacked-01',
			'finance-ecommerce/coins-hand',
			'finance-ecommerce/coins-swap',
			'finance-ecommerce/bank',
			'finance-ecommerce/bank-note-01',
			'finance-ecommerce/credit-card',
			'finance-ecommerce/wallet',
			'finance-ecommerce/piggy-bank',
			'finance-ecommerce/currency-dollar',
			'finance-ecommerce/currency-dollar-circle',
			'finance-ecommerce/sale',
			'finance-ecommerce/scales',
			'finance-ecommerce/receipt',
			'finance-ecommerce/receipt-check',
			'finance-ecommerce/diamond-01',
			'finance-ecommerce/gift'
		]
	},
	{
		label: 'Shopping',
		icons: [
			'finance-ecommerce/shopping-cart',
			'finance-ecommerce/shopping-bag-01',
			'finance-ecommerce/shopping-bag-02',
			'finance-ecommerce/tag-01'
		]
	},
	{
		label: 'Home & Bills',
		icons: [
			'general/home',
			'media-devices/lightbulb-01',
			'media-devices/wifi',
			'media-devices/phone',
			'media-devices/tv',
			'media-devices/signal',
			'general/tool-01',
			'security/shield-tick',
			'security/shield-dollar',
			'security/lock',
			'security/key'
		]
	},
	{
		label: 'Travel & Transit',
		icons: [
			'maps-travel/car',
			'maps-travel/bus',
			'maps-travel/train',
			'maps-travel/truck',
			'maps-travel/plane',
			'maps-travel/rocket',
			'maps-travel/ticket',
			'maps-travel/luggage',
			'maps-travel/map-01',
			'maps-travel/globe-01',
			'maps-travel/compass'
		]
	},
	{
		label: 'Health & Life',
		icons: [
			'general/heart',
			'general/heart-check',
			'general/hearts',
			'users/face-happy',
			'users/face-smile',
			'users/user',
			'users/user-circle'
		]
	},
	{
		label: 'Work & School',
		icons: [
			'education/briefcase-01',
			'education/briefcase-02',
			'education/award-01',
			'education/book-closed',
			'education/book-open',
			'education/calculator',
			'education/graduation-hat',
			'education/medal',
			'education/trophy',
			'charts/bar-chart-01',
			'charts/bar-chart-03'
		]
	},
	{
		label: 'Time & Tasks',
		icons: [
			'time/calendar',
			'time/calendar-check',
			'time/clock',
			'time/alarm-clock',
			'time/hourglass',
			'arrows/refresh-cw-01',
			'arrows/reverse-left',
			'arrows/switch-horizontal',
			'general/settings-01',
			'general/activity-heart',
			'general/bookmark',
			'general/archive'
		]
	}
];

export const ALL_ICONS: string[] = ICON_GROUPS.flatMap((g) => g.icons);

// Nav menu icons
export const NAV_ICONS = {
	home: 'general/home',
	transactions: 'finance-ecommerce/coins-swap',
	budgets: 'charts/bar-chart-03',
	accounts: 'finance-ecommerce/wallet',
	business: 'education/briefcase-01',
	taxes: 'finance-ecommerce/scales',
	settings: 'general/settings-01'
} as const;
