<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	goto(`${base}/transactions`, { replaceState: true });
</script>
