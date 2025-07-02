<script setup lang="ts">
  import { ref } from 'vue';
  import type { PrimaryKey } from '@directus/types';
  import type { Branch } from '../types';
  const branches = defineModel<Record<PrimaryKey, Branch>>('branches')

  const props = withDefaults(
    defineProps<{
      branchId: PrimaryKey,
      indentWidth: number,
      updateChildren?: boolean,
    }>(),
    {
      indentWidth: 29,
      updateChildren: false,
    }
  );

  const branch = ref<Branch | undefined>(branches.value?.[props.branchId]);
  const parent_id: PrimaryKey | undefined = branch.value?.['--parentId'];
  const depth: number = branch.value?.['--depth'] ?? 0;
  const parentBranch = branches.value?.[parent_id!] ?? null;
  const siblings: number = parentBranch?.children ?? 0;
  
  // console.log('parentBranch', parentBranch);
  if(props.updateChildren && siblings > 0){
    if(branches.value && parent_id && parent_id in branches.value && branches.value[parent_id]){
      branches.value[parent_id].children--;
    }
  }
</script>
<template>
  <div v-if="branches && branch && depth > 0" :style="{ borderColor: siblings > 0 ? 'var(--theme--foreground-subdued)' : 'transparent' }" class="line" :data-parent="parent_id" :data-depth="branch['--depth']" :data-children="branch.children">
    <branch-line
      v-if="parent_id && branches?.[parent_id]"
      v-model:branches="branches"
      :branch-id="parent_id"
      :indent-width="props.indentWidth"
    />
  </div>
</template>
<style scoped>
  .line {
    position: absolute;
    left: -29px;
    top: 0;
    z-index: 0;
    height: 53px;
    width: 0;
    border-left: 1px dotted var(--theme--foreground);
    border-left-color: var(--theme--foreground);
  }

  .dark .line {
    border-left: 1px dotted var(--theme--foreground-subdued);
    border-left-color: var(--theme--foreground-subdued);
  }
</style>