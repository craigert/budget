/**
 * Svelte action for number inputs.
 * - Shows "0" when the field value is zero.
 * - Clears to blank on focus so you can type immediately.
 * - Resets back to "0" on blur if the field is left empty.
 */
export function clearOnFocus(node: HTMLInputElement) {
	function handleFocus() {
		if (node.value === '0') {
			node.value = '';
		}
	}

	function handleBlur() {
		if (node.value === '') {
			node.value = '0';
			// Sync bound value and trigger onchange handlers.
			node.dispatchEvent(new Event('input', { bubbles: true }));
			node.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}

	node.addEventListener('focus', handleFocus);
	node.addEventListener('blur', handleBlur);

	return {
		destroy() {
			node.removeEventListener('focus', handleFocus);
			node.removeEventListener('blur', handleBlur);
		}
	};
}
