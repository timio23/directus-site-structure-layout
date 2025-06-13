<script setup lang="ts">
import type { ShowSelect } from '@directus/extensions';
import type { Branches, Depths, Item, ItemSelectEvent, LayoutOptions } from '../types';
import type { PrimaryKey, ContentVersion } from '@directus/types';
import type { Ref } from 'vue';
import { useSessionStorage } from '@vueuse/core';
import { clone, cloneDeep } from 'lodash';
import { computed, ref, toRef, watch, nextTick, } from 'vue';
import { useI18n } from 'vue-i18n';
import Sortable from './sortable.vue';
import TreeItem from './tree-item.vue';

const props = withDefaults(
	defineProps<{
		items: Item[];
		versions: ContentVersion[],
		sort: string[],
		isFiltered: boolean;
		itemKey?: string;
		mustSort?: boolean;
		showSelect?: ShowSelect;
		showManualSort?: boolean;
		manualSortKey?: string;
		toggleSort?: boolean;
		allowHeaderReorder?: boolean;
		modelValue?: any[];
		fixedHeader?: boolean;
		loading?: boolean;
		loadingText?: string;
		noItemsText?: string;
		selectionUseKeys?: boolean;
		inline?: boolean;
		disabled?: boolean;
		clickable?: boolean;
		parentField: string | null;
		collection: string;
		selectMode: boolean;
		canDeletePages: boolean;
		layoutOptions: LayoutOptions | null,
	}>(),
	{
		itemKey: 'id',
		mustSort: false,
		showSelect: 'none',
		showManualSort: false,
		manualSortKey: undefined,
		allowHeaderReorder: false,
		modelValue: () => [],
		fixedHeader: false,
		loading: false,
		// CORE CHANGE
		// loadingText: i18n.global.t("loading"),
		// noItemsText: i18n.global.t("no_items"),
		selectionUseKeys: false,
		inline: false,
		disabled: false,
		clickable: true,
	},
);

const { t } = useI18n();
const rowHeight = ref<number>(48);
const controlIconWidth = ref<number>(28);
const itemDepths = ref<Depths>({});
const branches = ref<any>({});
const itemBranchLines = '--branchLines';
const treeLoading = ref<boolean>(false);
const confirmDelete = ref<number | string | boolean | null>(false);
const selectAll = ref<boolean>(false);
const manualSort = ref<boolean>(false);

const emit = defineEmits([
	'click:row',
	'update:sort',
	'item-selected',
	'update:modelValue',
  'update:items',
	'delete:item',
]);

// const internalSort = computed<Sort>(() =>	{
// 	if (!props.sort?.[0]) {
// 		return { by: null, desc: false };
// 	}
// 	else if (props.sort?.[0].startsWith('-')) {
// 		return { by: props.sort[0].slice(1), desc: true };
// 	}
// 	else {
// 		return { by: props.sort[0], desc: false };
// 	}
// });

const reordering = ref<boolean>(false);

// const allItemsSelected = computed<boolean>(() => {
// 	return (
// 		props.loading === false
// 		&& props.items.length > 0
// 		&& props.modelValue.length === props.items.length
// 	);
// });

// const someItemsSelected = computed<boolean>(() => {
// 	return props.modelValue.length > 0 && allItemsSelected.value === false;
// });

function itemHasNoKeyYet(item: Item) {
	return !item[props.itemKey] && item.$index !== undefined;
}

function onItemSelected(event: ItemSelectEvent) {
	if (props.disabled) return;
	emit('item-selected', event);
	let selection = clone(props.modelValue) as any[];
	if (event.value === true) {
		if (props.selectionUseKeys) {
			selection.push(event.item[props.itemKey]);
		} else {
			selection.push(event.item);
		}
	} else {
		selection = selection.filter((item) => {
			if (!props.selectionUseKeys && itemHasNoKeyYet(item)) {
				return item.$index !== event.item.$index;
			}
			if (props.selectionUseKeys) {
				return item !== event.item[props.itemKey];
			}

			return item[props.itemKey] !== event.item[props.itemKey];
		});
	}

	if (props.showSelect === 'one') {
		selection = selection.slice(-1);
	}

	emit('update:modelValue', selection);
}

function getSelectedState(item: Item) {
	if (!props.selectionUseKeys && itemHasNoKeyYet(item)) {
		const selectedKeys = props.modelValue.map((item) => item.$index);
		return selectedKeys.includes(item.$index);
	}

	const selectedKeys = props.selectionUseKeys ? props.modelValue : props.modelValue.map((item) => item[props.itemKey]);

	return selectedKeys.includes(item[props.itemKey]);
}

function onToggleSelectAll() {
	if (props.disabled) return;

	if (selectAll.value === true) {
		if (props.selectionUseKeys) {
			emit(
				'update:modelValue',
				clone(props.items).map((item) => item[props.itemKey]),
			);
		} else {
			emit('update:modelValue', clone(props.items));
		}
	} else {
		emit('update:modelValue', []);
	}
}

// function updateSort(newSort: Sort) {
// 	emit('update:sort', newSort?.by ? newSort : null);
// }

// interface EndEvent extends CustomEvent {
// 	oldIndex: number;
// 	newIndex: number;
// }

// function onSortChange(event: EndEvent) {
// 	if (props.disabled) return;

// 	const item = internalItems.value[event.oldIndex][props.itemKey];
// 	const to = internalItems.value[event.newIndex][props.itemKey];

// 	emit('manual-sort', { item, to });
// }

const internalItems = ref(props.items);
// const nestedData = ref<Nest[]>([]);

watch(
	() => props.items,
	(newItems) => (internalItems.value = newItems),
);

const {
	// gridTemplateTreeColumnWidth,
	depthChangeMax,
	itemDepth,
	itemParent,
	childrenKey,
	collapsedKey,
	collapsedParentsKey,
	onSortUpdate,
	onToggleChildren,
} = useTreeView({
	internalItems,
	parentField: toRef(props, 'parentField'),
	itemKey: toRef(props, 'itemKey'),
	sortKey: toRef(props, 'manualSortKey'),
	showManualSort: toRef(props, 'showManualSort'),
	collection: toRef(props, 'collection')
});

function useTreeView({
	internalItems,
	parentField,
	itemKey,
	sortKey,
	showManualSort,
	collection
}: {
	internalItems: Ref<Item[]>;
	parentField: Ref<string | null>;
	itemKey: Ref<string>;
	sortKey: Ref<string | undefined>;
	showManualSort: Ref<boolean>;
	collection: Ref<string>;
}) {
	const itemDepth = '--depth';
	const itemParent = '--parentId';
	const treeViewAble = computed(isTreeViewAble);
	// console.log(`treeViewAble: ${treeViewAble.value}`);
	const depthChangeMax = ref(0);
	const sortChange = ref<{ id: PrimaryKey; parent: PrimaryKey | null } | null>(null);
	// const maxDepths = computed(getMaxDepths);
	// const gridTemplateTreeColumnWidth = computed(calculateColumnWidth);

	const {
		childrenKey,
		collapsedKey,
		collapsedParentsKey,
		onToggleChildren,
		isCollapsed,
		initCollapsedChildren,
	} = useCollapsible();

	watch(() => props.items, initTreeView);
	watch(() => treeViewAble.value, initTreeView);
	watch(() => parentField.value, initTreeView);
	watch(() => parentField.value, resetIfNoParentSelected);

	initTreeView;
	treeLoading.value = false;

	return {
		// gridTemplateTreeColumnWidth,
		depthChangeMax,
		itemDepth,
		itemParent,
		childrenKey,
		collapsedKey,
		collapsedParentsKey,
		onSortUpdate,
		onToggleChildren,
	};

	function resetIfNoParentSelected(
		newParentField: string | null,
		oldParentField: string | null,
	) {
		if (!newParentField && !!oldParentField)
			internalItems.value = props.items;
	}

	function initTreeView() {
		treeLoading.value = true;
		if (treeViewAble.value) {
			internalItems.value = internalItems.value.map((item) => {
				if(item[itemKey.value] === sortChange.value?.id){
					item[props.parentField!] = sortChange.value?.parent;
					item[itemParent] = sortChange.value?.parent;
				}
				return item;
			});
			const { sortedResult, orderChanged } = reorder(
				calculateTreeProps(cloneDeep(internalItems.value)),
			);

			internalItems.value = sortedResult;
			initCollapsedChildren();

			if (orderChanged)
				onSortUpdate({ sort: true, parent: null });
		}
		treeLoading.value = false;
	}

	function isTreeViewAble() {
		return (
			!!internalItems.value?.length
			&& !!parentField.value
			&& showManualSort.value
			&& !!sortKey.value
		);
	}

	// function calculateColumnWidth() {
	// 	return maxDepths.value * controlIconWidth;
	// }

	// function getMaxDepths() {
	// 	return Math.max(
	// 		...internalItems.value.map((item) => item[itemDepth] ?? 0),
	// 		depthChangeMax.value,
	// 	);
	// }

	/** Calculates `[itemDepth]`, `[itemParent]` (id) and `[childrenKey]` */
	function calculateTreeProps(data: Item[]) {
		const map: any = {};

		for (const item of data) {
			item[itemParent] = getParentId(item);
			item[childrenKey] = data.filter(
				(child) => child[itemParent] === item[itemKey.value],
			).map((child) => child[itemKey.value]);
			item[collapsedKey] = isCollapsed(item[itemKey.value]);
			item[collapsedParentsKey] = [];

			map[item[itemKey.value]] = item;
		}

		for (const key in map) {
			const item = map[key];
			if (!(itemDepth in item))
				setDepth(item);
		}

		Object.keys(map).sort(function(a, b) {
			const sortkey = props.manualSortKey ?? 'sort';
			return map[a][sortkey] - map[b][sortkey];
		}).forEach((key: string) => {
			const item = map[key];
			branches.value[item[itemKey.value]] = {
				parents: map[item[itemParent]]?.[childrenKey].length ?? 0,
				children: item[childrenKey].length ?? 0,
				[itemDepth]: item[itemDepth],
				[itemParent]: item[itemParent],
			};
		});

		// Object.keys(map).sort(function(a, b) {
		// 	const sortkey = props.manualSortKey ?? 'sort';
		// 	return map[a][sortkey] - map[b][sortkey];
		// }).forEach(doStuff);

		// function doStuff(key: number | string){
		// 	const item = map[key];
			
		// 	if (!(itemBranchLines in item))
		// 		calculateBranchLines(item);
		// 	let depthsCount = itemDepths.value ? itemDepths.value[item[itemDepth]] ?? [] : [];
		// 	if(depthsCount){
		// 		const depth_index = depthsCount.indexOf(item[props.itemKey]);
		// 		if (depth_index > -1) {
		// 			itemDepths.value?.[item[itemDepth]]?.splice(depth_index, 1);
		// 		}
		// 	}
		// }

		// function buildNestedTree(pages: Item[]) {
		// 		const map: any = {};
		// 		const result: Nest[] = [];

		// 		pages.forEach(item => {
		// 				map[item[itemKey.value]] = {
		// 					[itemKey.value]: item[itemKey.value],
		// 					[itemParent]: item[itemParent],
		// 					children: [],
		// 				};
		// 		});

		// 		pages.forEach(item => {
		// 				const node = map[item[itemKey.value]];
		// 				if (!(itemDepth in node))
		// 					setDepth(node);
		// 				if (item[itemParent] !== null) {
		// 						map[item[itemParent]].children.push(node);
		// 				} else {
		// 						result.push(node);
		// 				}
		// 		});

		// 		return result;
		// }

		// const buildNestedTree = (parentId?: number | string): Item => (item: Item) => {
		// 	const children = data.filter((child) => child.parentId === item.id);
		// 	return {
		// 		...item,
		// 		...(children.length > 0 && { children: children.map(buildNestedTree(item.id)) }),
		// 	};
		// };

		// nestedData.value = buildNestedTree(data);

		return Object.values(map) as Item[];

		function getParentId(item: Item) {
			if (!parentField.value)
				return null;

			return (
				item[parentField.value]?.[itemKey.value]
				?? item[parentField.value]
			);
		}

		function setDepth(item: Item) {
			if (item[itemParent]) {
				const parentId = item[itemParent];

				if (map[parentId]) {
					const parentItem = map[parentId];

					if (!(itemDepth in parentItem)) {
						setDepth(parentItem);
					}

					item[itemDepth] = parentItem[itemDepth] + 1;
					if(itemDepths.value[item[itemDepth]] === undefined){
						itemDepths.value[item[itemDepth]] = [];
					}
					// console.log(`item: ${item[itemKey.value]}, depth: ${item[itemDepth]}`);
					itemDepths.value[item[itemDepth]]?.push(item[itemKey.value]);
				}
			}
			else {
				item[itemDepth] = 0;
				if(itemDepths.value[0] === undefined){
					itemDepths.value[0] = [];
				}
				// console.log(`item: ${item[itemKey.value]}, depth: ${item[itemDepth]}`);
				itemDepths.value[0].push(item[itemKey.value]);
			}
		}
	}

	function calculateBranchLines(item: Item){
		let branches: Branches[] = [];
		for(var i = 0; i <= item[itemDepth]; i++) {
			branches.push({
				branch: i,
				items: itemDepths.value?.[i]?.length ?? 0,
			});
		}
		return branches.reverse();
	}

	function reorder(items: Item[]) {
		let sortedResult: Item[] = [];
		let orderChanged = false;

		const rootItems = items.filter((item) => item[itemDepth] === 0);
		rootItems.sort(sortBySortKey);
		rootItems.forEach(addItem);
		applySortValues();

		return { sortedResult, orderChanged };

		function applySortValues() {
			sortedResult = sortedResult.map((item: Item, index) => {
				const sortValue = index + 1;

				if (item[sortKey.value!] !== sortValue) {
					item[sortKey.value!] = sortValue;
					if (!orderChanged)
						orderChanged = true;
				}

				return item;
			});
		}

		function addItem(item: Item) {
			item[itemBranchLines] = calculateBranchLines(item);
			sortedResult.push(item);
			
			const children = items.filter(
				(child) => child[itemParent] === item[itemKey.value],
			);

			branches.value[item[itemKey.value]].children = children.length;

			children.sort(sortBySortKey);

			for (const child of children) {
				child[itemBranchLines] = calculateBranchLines(item);
				item[childrenKey].push(child[itemKey.value]);
				const childrenIds = addItem(child);
				item[childrenKey].push(...childrenIds);

				// branches.value[child[itemKey.value]] = {
				// 	parents: item[childrenKey].length ?? 0,
				// 	// children: item[childrenKey].length ?? 0,
				// 	[itemDepth]: child[itemDepth],
				// 	[itemParent]: child[itemParent],
				// };
			}

			return item[childrenKey];
		}

		function sortBySortKey(a: Item, b: Item): number {
			return a[sortKey.value!] - b[sortKey.value!];
		}
	}

	interface SortUpdateParams {
		sort: boolean;
		parent: null | { id: PrimaryKey; parent: PrimaryKey | null };
	}

	async function onSortUpdate({ sort, parent }: SortUpdateParams) {
		treeLoading.value = true;
		let edits: any = {};

		// console.log('parent', parent);
		sortChange.value = parent;

		if (sort) {
			// const map: any = {};
			for (const item of internalItems.value) {
				edits[item[props.itemKey]] = {
					[props.manualSortKey!]: item[props.manualSortKey!],
				};
			}

			// for (const key in map) {
			// 	const item = map[key];
			// 	branches.value[item[itemKey.value]] = {
			// 		parents: item[itemKey.value] === parent?.id && parent?.parent ? 1 + map[parent.parent]?.[childrenKey].length : map[item[itemParent]]?.[childrenKey].length ?? 0,
			// 		children: item[childrenKey].length ?? 0,
			// 		[itemDepth]: item[itemDepth],
			// 		[itemParent]: item[itemParent],
			// 	};
			// };

			// for (const item of internalItems.value) {
			// 	calculateBranchLines(item);
			// 	let depthsCount = itemDepths.value ? itemDepths.value[item[itemDepth]] ?? [] : [];
			// 	if(depthsCount){
			// 		const depth_index = depthsCount.indexOf(item[props.itemKey]);
			// 		if (depth_index > -1) {
			// 			itemDepths.value?.[item[itemDepth]]?.splice(depth_index, 1);
			// 		}
			// 	}
			// }
		}

		if (parent && parentField.value) {

			let newBranches: any = {};
			for (const item of internalItems.value){
				newBranches[item[props.itemKey]] = {
					[itemDepth]: item[itemDepth],
					[itemParent]: item[props.parentField!],
					children: internalItems.value.filter(
						(child) => child[props.itemKey] !== sortChange.value?.id && child[itemParent] === item[props.itemKey]
					).length
				};
			}

			if(sortChange.value?.id)	newBranches[parent.id][itemParent] = sortChange.value.parent;
			if(sortChange.value?.parent)	newBranches[sortChange.value.parent].children++;
			edits = {
				...edits,
				[parent.id]: {
					...edits[parent.id],
					[parentField.value]: parent.parent !== null ? { [props.itemKey]: parent.parent } : null,
				},
			};
			// console.log(newBranches);
			branches.value = newBranches;
		}

		emit('update:items', edits);
		
		initTreeView;
		await nextTick();
		treeLoading.value = false;
	}

	function useCollapsible() {
		const childrenKey = '--children';
		const collapsedKey = '--collapsed';
		const collapsedParentsKey = '--collapsed-parents';

		const collapsedState = useSessionStorage<PrimaryKey[]>(
			`${collection.value}--tree-view-collapsed-items`,
			[],
		);

		return {
			childrenKey,
			collapsedKey,
			collapsedParentsKey,
			onToggleChildren,
			isCollapsed,
			initCollapsedChildren,
		};

		function isCollapsed(id: PrimaryKey) {
			return collapsedState.value.includes(id);
		}

		function onToggleChildren(item: Item) {
			if (!item[childrenKey]?.length)
				return;

			item[collapsedKey] = toggleItem(item[props.itemKey]);
			collapseChildren(item[itemKey.value], item[childrenKey]);
		}

		function toggleItem(id: PrimaryKey): boolean {
			const index = collapsedState.value.indexOf(id);

			if (index !== -1) {
				collapsedState.value.splice(index, 1);
				return false;
			}

			collapsedState.value.push(id);
			return true;
		}

		function initCollapsedChildren() {
			collapsedState.value.forEach((collapsedId: PrimaryKey) => {
				const childrenIds = internalItems.value?.find(
					(item) => item[itemKey.value] === collapsedId,
				)?.[childrenKey];

				collapseChildren(collapsedId, childrenIds);
			});
		}

		function collapseChildren(
			id: PrimaryKey,
			childrenIds: PrimaryKey[],
		) {
			for (const childItem of internalItems.value
				.filter((internalItem) =>
					childrenIds.includes(internalItem[itemKey.value]),
				)) {
				const parentIndex = childItem[collapsedParentsKey]?.indexOf(id);

				if (parentIndex > -1) {
					childItem[collapsedParentsKey].splice(
						parentIndex,
						1,
					);
				}
				else {
					childItem[collapsedParentsKey].push(id);
				}
			}
		}
	}
}

async function deletePage(id: string | number){
	confirmDelete.value = id;
}

async function deleteAndQuit() {
	emit('delete:item', confirmDelete.value);
	confirmDelete.value = false;
}

</script>
<template>
  <div class="widget-body">
		<div class="widget-toolbar" v-if="!selectMode">
			<v-checkbox
					v-model="selectAll"
					icon-on="check_box"
					icon-off="check_box_outline_blank"
					icon-indeterminate="indeterminate_check_box"
					@update:model-value="onToggleSelectAll"
				>Select All</v-checkbox>

			<v-checkbox
				v-model="manualSort"
				icon-on="toggle_on"
				icon-off="toggle_off"
				icon-indeterminate="toggle_off"
			>Rearrange Items</v-checkbox>
		</div>
    <div class="widget-main">
      <div class="fuelux">
        <div class="tree tree-folder-select" role="tree">
					<VSkeletonLoader style="margin: " v-if="loading || treeLoading" />
          <template v-else-if="items.length === 0">
            {{ noItemsText || $t("no_items") }}
          </template>
          <v-list v-else class="v-site-tree">
            <Sortable
              v-slot="{
                item,
                selected: isSorting,
                parentSelected: parentSorting,
                onDragOver,
                currentDepth,
              }"
              v-model:items="internalItems"
              v-model:depth-change-max="depthChangeMax"
              :item-key
              :item-sort="manualSortKey"
              :item-depth
              :item-parent="!!parentField ? itemParent : null"
              :snap-step="controlIconWidth"
              :disabled="disabled || selectMode"
              @manual-sort="onSortUpdate"
            >
              <TreeItem
								:collection="collection"
                :item
								:versions
								:item-key="itemKey"
								:parent-key="itemParent"
								:manual-sort-key="manualSortKey"
								:toggle-sort="toggleSort && manualSort"
								:branch-lines-key="itemBranchLines"
                :indent="currentDepth * controlIconWidth"
								:indent-width="controlIconWidth"
								:is-filtered="isFiltered"
                :sorting="isSorting || parentSorting"
                :has-children="item[childrenKey]?.length"
                :children-collapsed="item[collapsedKey]"
                :collapsed="!!item[collapsedParentsKey]?.length"
                :show-select="disabled ? 'none' : showSelect"
                :show-manual-sort="!disabled && showManualSort"
								:select-mode="selectMode"
                :is-selected="getSelectedState(item)"
                :subdued="loading || reordering"
                :has-click-listener="!disabled && clickable"
                :height="rowHeight"
								:layout-options="layoutOptions"
								v-model:branches="branches"
                @mouseover.prevent="onDragOver"
                @toggle-children="onToggleChildren(item)"
                @click="
                  !disabled && clickable
                    ? $emit('click:row', { item, event: $event })
                    : null
                "
                @item-selected="
                  onItemSelected({
                    item,
                    value: !getSelectedState(item),
                  })
                "
								:can-delete-pages="canDeletePages"
								@delete:item="deletePage"
              />
            </Sortable>
          </v-list>
        </div>
      </div>
    </div>
		<v-dialog v-model="confirmDelete" @esc="confirmDelete = false">
			<v-card>
				<v-card-title>{{ t('delete_are_you_sure') }}</v-card-title>
				<v-card-actions>
					<v-button secondary @click="confirmDelete = false">
						{{ t('cancel') }}
					</v-button>
					<v-button kind="danger" :loading="loading" @click="deleteAndQuit">
						{{ t('delete_label') }}
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
  </div>
</template>
<style lang="css" scoped>
	.widget-toolbar {
		display: flex;
		justify-content: space-between;
		padding-left: 35px;
		padding-bottom: 10px;
		border-bottom: 2px solid var(--theme--border-color-subdued);
	}

	.widget-toolbar .v-checkbox {
		margin-right: 24px;
	}

	.v-site-tree {
		padding: 0;
	}
</style>