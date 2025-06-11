<script setup lang="ts">
  import { ref } from 'vue';
  const branches = defineModel<any>('branches')

  const props = withDefaults(
    defineProps<{
      branchId: string,
      indentWidth: number,
      updateChildren?: boolean,
    }>(),
    {
      indentWidth: 29,
      updateChildren: false,
    }
  );
  const branch = ref(branches.value[props.branchId]);
  const parent_id: string = branch.value['--parentId'];
  const depth: number = branch.value['--depth'];
  const parentBranch = branches.value[parent_id];
  const children: number = parentBranch?.children ?? 0;
  // console.log('parentBranch', parentBranch);
  if(props.updateChildren && parentBranch?.children > 0){
    branches.value[parent_id].children--;
  }
</script>
<template>
  <div v-if="branch && depth > 0" :style="{ borderColor: children > 0 ? 'var(--theme--foreground)' : 'transparent' }" class="line" :data-parent="parent_id" :data-id="branch.id" :data-depth="branch['--depth']" :data-parents="branch.parents" :data-children="branch.children">
    <branch-line
      v-if="branches[parent_id]"
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
</style>