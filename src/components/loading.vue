<template>
  <div class="loading-container">
    <div class="loading-inner">
      <v-progress-circular indeterminate /><span>Fetching Items...</span>
    </div>
  </div>
</template>
<style lang="css" scoped>
	.loading-container {
		height: 76vh;
	}

	.loading-inner {
		padding-top: calc(38vh - 30px);
		text-align: center;
	}

	.loading-container .v-progress-circular {
		margin: 0 auto 0.5em;
	}
</style>