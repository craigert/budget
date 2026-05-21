<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	goto(`${base}/budgets`, { replaceState: true });
</script>
