<script lang="ts">
  let count = $state<number>(0);
  const increment = () => {
    count += 1;
  };
</script>

<button onclick={increment}>
  count is {count}
</button>
