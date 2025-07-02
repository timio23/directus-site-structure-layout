<script setup lang="ts">
import { useElementSize, useSync } from '@directus/composables';
import type { ShowSelect } from '@directus/extensions';
import type { Field, Filter, Item, PrimaryKey, ContentVersion } from '@directus/types';
import type { Collection } from './types';
import { usePageSize } from './composables/use-page-size';
import { Ref, computed, inject, ref, watch, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStores } from '@directus/extensions-sdk';
import TreeView from './components/tree-view.vue';
import Loading from './components/loading.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		collection: string;
		items: Item[];
		allItems: Item[];
		versions: ContentVersion[];
		selection: (number | string)[];
		selectMode: boolean;
		readonly: boolean;
		limit: number;
		size: number;
		icon: string;
		imageFit: string;
		isSingleRow: boolean;
		width: number;
		totalPages: number;
		filter: Filter;
		page: number;
		toPage: (newPage: number) => void;
		getLinkForItem: (item: Record<string, any>) => string | undefined;
		fieldsInCollection: Field[];
		selectAll: () => void;
		sortField?: string;
		parentField: string | null;
		parents: PrimaryKey[] | never[];
		childrenField: string | null;
		resetPresetAndRefresh: () => Promise<void>;
		sort: string[];
		loading: boolean;
		loadingAll: boolean;
		showSelect?: ShowSelect;
		error?: any;
		itemCount: number | null;
		totalCount: number | null;
		primaryKeyField?: Field;
		pageTitle?: string;
		pageType?: string;
		pageSlug?: string;
		pageHost?: string;
		pageVisibility?: string;
		pageAdditional?: string;
		info?: Collection;
		filterUser?: Filter;
		search?: string;
		isFiltered: boolean;
		onRowClick: ({ item, event }: { item: Item; event: PointerEvent }) => void;
		onSortChange: (newSort: { by: string; desc: boolean }) => void;
		saveEdits: (edits: Record<PrimaryKey, Item>) => void;
		canDeletePages: boolean;
		deletePage: (id: PrimaryKey) => void;
		fetchAllRecords: () => Promise<Item[]>;
		fetchChildren: (parentID: string) => Promise<Item[]>;
	}>(),
	{
		showSelect: 'multiple',
	},
);

const emit = defineEmits(['update:selection', 'update:page', 'update:limit', 'update:size', 'update:sort', 'update:width', 'update:parents']);

const { t } = useI18n();
const { collection } = toRefs(props);

const selectionWritable = useSync(props, 'selection', emit);
const limitWritable = useSync(props, 'limit', emit);
const parentsWritable = useSync(props, 'parents', emit);
// const sortWritable = useSync(props, 'sort', emit);

// const toggleSort = ref<boolean>(false);

// watch(() => parentsWritable.value, () => (console.log("Changed:", parentsWritable.value)));

const mainElement = inject<Ref<Element | undefined>>('main-element');

const layoutElement = ref<HTMLElement>();

const { width: innerWidth } = useElementSize(layoutElement);

const { sizes: pageSizes, selected: selectedSize } = usePageSize<string>(
	[25, 50, 100, 250, 500, 1000],
	(value) => String(value),
	props.limit,
);

if (limitWritable.value !== selectedSize) {
	limitWritable.value = selectedSize;
}

const stores = useStores();

const { sortAllowed } = useCollectionPermissions(collection);
// console.log(`sortAllowed: ${sortAllowed.value}`);
// console.log(`isFiltered: ${props.isFiltered}`);

function useCollectionPermissions(collection: Ref<string>) {
	const { usePermissionsStore } = stores;
	const permissionsStore = usePermissionsStore();

	return {
		sortAllowed: computed(() => {
			if (!props.sortField)
				return false;
			return permissionsStore.hasPermission(collection.value, 'sort');
		}),
	};
}

watch(
	() => props.page,
	() => mainElement!.value?.scrollTo({ top: 0, behavior: 'smooth' }),
);

watch(innerWidth, (value) => {
	emit('update:width', value);
});

// console.log(props.items);

// watch(() => props.items, () => {
// 	console.log(props.items);
// });

</script>
<template>
	<v-info v-if="!parentField || !childrenField" title="Layout not configured" style="height: 76vh; justify-content: center;" icon="error">Please set the Parent and Children relational fields in the layout settings.</v-info>
	<v-info v-else-if="!items" title="Internal Server Error" style="height: 76vh; justify-content: center;" icon="error">Error with API</v-info>
	<Loading v-else-if="loading" />
	<v-info v-else-if="itemCount && itemCount == 0" style="height: 76vh; justify-content: center;" title="No Items" icon="warning"></v-info>
	<div v-else class="widget-box site-structure">
		<TreeView
			v-if="!error"
			v-model:selection="selectionWritable"
			v-model:expanded="parentsWritable"
			:show-select="showSelect ? showSelect : selection !== undefined ? 'multiple' : 'none'"
			must-sort
			:items
			:versions
			:sort="sort"
			:loading="loading"
			:loading-all="loadingAll"
			:is-filtered="isFiltered"
			:item-key="primaryKeyField?.field"
			:show-manual-sort="!isFiltered"
			:toggle-sort="sortAllowed"
			:manual-sort-key="sortField"
			allow-header-reorder
			selection-use-keys
			:parent-field
			:parents
			:children-field
			:collection
			:layout-options="{
				pageTitle,
				pageType,
				pageSlug,
				pageHost,
				pageVisibility,
				pageAdditional,
			}"
			:select-mode="selectMode"
			:can-delete-pages="canDeletePages"
			:fetch-all-records
			:fetch-children
			@click:row="onRowClick"
			@update:sort="onSortChange"
			@update:items="saveEdits"
			@delete:item="deletePage"
		/>
		<div class="footer">
			<div v-if="selectMode || isFiltered" class="pagination">
				<v-pagination
					v-if="totalPages > 1"
					:length="totalPages"
					:total-visible="7"
					show-first-last
					:model-value="page"
					@update:model-value="toPage"
				/>
			</div>

			<div v-if="loading === false && items.length >= 25 && itemCount && itemCount <= limit" class="per-page">
				<span>{{ t('per_page') }}</span>
				<v-select :model-value="`${limit}`" :items="pageSizes" inline @update:model-value="limitWritable = +$event" />
			</div>
		</div>
	</div>
</template>
<style scoped>
.v-enter-active,
.v-leave-active {
  transition: max-height 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  max-height: 0;
}

.layout-options .field .field {
  margin-bottom: 24px;
}

.fuelux {
  background: repeating-linear-gradient(to bottom, var(--border-subdued) 0px, var(--border-subdued) 1px, transparent 1px, transparent 49px, var(--border-subdued) 49px, var(--border-subdued) 50px);
  padding: 0 2em 4px;
}

.tree {
  padding-left: 9px;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  overflow-x: inherit;
  overflow-y: inherit;
}
.tree:before {
  display: inline-block;
  content: "";
  position: absolute;
  top: -20px;
  bottom: 24px;
  left: 0;
  z-index: 1;
  border: 1px dotted #67b2dd;
  border-width: 0 0 0 1px;
}
.tree::before {
  top: 27px;
  bottom: 24px;
}
.tree .tree-folder {
  width: auto;
  min-height: 20px;
  cursor: pointer;
}
.tree .tree-folder .tree-folder-header {
  position: relative;
  border-radius: 0;
}
.tree .tree-folder .tree-folder-header .tree-folder-name {
  margin-left: 2px;
}
.tree .tree-folder .tree-folder-content {
  margin-left: 19px;
  padding-left: 10px;
  position: relative;
}
.tree .tree-folder .tree-folder-content:before {
  display: inline-block;
  content: "";
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: 24px;
  left: 0;
  border: 1px dotted #67b2dd;
  border-width: 0 0 0 1px;
}
.tree .tree-folder .tree-folder-content::before {
  left: 0px;
  top: 0px;
}
.tree .tree-folder, .tree .tree-item {
  position: relative;
  border: 1px solid #FFF;
  border: 0;
}
.tree .tree-folder:before, .tree .tree-item:before {
  display: inline-block;
  content: "";
  position: absolute;
  top: 25px;
  left: -13px;
  width: 18px;
  height: 0;
  border-top: 1px dotted #67b2dd;
  z-index: 1;
}
.tree .tree-folder::before, .tree .tree-item::before {
  left: -9px;
  width: 15px;
}
.tree .tree-item::before {
  width: 35px;
}
.tree .tree-folder-header, .tree .tree-item-header {
  display: flex;
  margin: 0;
  padding: 0;
  -webkit-box-sizing: content-box;
  -moz-box-sizing: content-box;
  box-sizing: content-box;
}
.tree .tree-folder-header:hover, .tree .tree-item-header:hover {
  background-color: var(--background-subdued);
}
.tree .tree-folder-header:hover .selection-indicator, .tree .tree-item-header:hover .selection-indicator {
  visibility: visible;
}
.tree .tree-folder-header:hover .tree-link .v-icon, .tree .tree-folder-header:hover .v-list .v-icon, .tree .tree-item-header:hover .tree-link .v-icon, .tree .tree-item-header:hover .v-list .v-icon {
  visibility: hidden;
}

.clearfix:after, .clearfix:before {
  display: table;
  content: " ";
  clear: both;
}

.tree-branch-children {
  transition: height 0.35s ease-in-out;
  overflow: hidden;
}
.tree-branch-children:not(.active) {
  display: none;
}

.tree:before, .tree .tree-folder:before, .tree .tree-item:before, .tree .tree-folder .tree-folder-content:before {
  border-color: var(--v-list-item-color);
}

.tree .tree-label, .tree i {
  color: var(--v-list-item-color);
}

.footer {
	padding: 20px 30px;
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.footer .per-page {
	display: flex;
}

.footer .per-page > span {
	margin-right: 10px;
}
</style>