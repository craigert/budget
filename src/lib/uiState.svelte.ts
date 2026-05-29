/*
 * Shared UI state for cross-component triggers that need to live above
 * `.bs-tab-content` (the layout's animated container). Anything fixed-
 * positioned has to be rendered outside transformed ancestors — otherwise
 * `position: fixed` resolves relative to the ancestor, not the viewport.
 * So the TweaksPanel drawer is mounted once at the layout root and any
 * button anywhere flips `tweaks.open` to show it.
 */

class TweaksUi {
	open = $state(false);
	show() {
		this.open = true;
	}
	hide() {
		this.open = false;
	}
}

export const tweaks = new TweaksUi();
