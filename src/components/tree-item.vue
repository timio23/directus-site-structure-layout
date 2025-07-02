<script setup lang="ts">
import type { ShowSelect } from '@directus/extensions';
import type { ContentVersion, PrimaryKey } from '@directus/types';
import type { Branch, Item, LayoutOptions } from '../types';
import type { Ref } from 'vue';
import { ref, inject, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BranchLine from './branch-line.vue';
import { getItemRoute } from '../utils/get-route';
import { useRouter } from 'vue-router';

const branches = defineModel<Record<PrimaryKey,Branch>>('branches');

const props = withDefaults(
	defineProps<{
		collection: string;
		item: Item;
		versions: ContentVersion[];
		itemKey: string;
		parentKey: string;
		branchLinesKey: string,
		branchLoading: boolean;
		manualSortKey: string;
		toggleSort?: boolean;
		indent?: number;
		indentWidth?: number;
		isFiltered: boolean;
		sorting?: boolean;
		hasChildren?: boolean;
		selectMode: boolean;
		showSelect: ShowSelect;
		showManualSort?: boolean;
		isSelected?: boolean;
		subdued?: boolean;
		hasClickListener?: boolean;
		height?: number;
		layoutOptions: LayoutOptions | null;
		canDeletePages: boolean;
	}>(),
	{
		indent: 0,
		indentWidth: 28,
		selectMode: false,
		showSelect: 'none',
		showManualSort: false,
		isSelected: false,
		subdued: false,
		hasClickListener: false,
		height: 48,
	},
);

const emit = defineEmits(['click', 'item-selected', 'toggle-children', 'delete:item']);

const { t } = useI18n();
const router = useRouter();

const typeKey = ref<string>(props.layoutOptions?.pageType ?? 'type');
const visibilityKey = ref<string>(props.layoutOptions?.pageVisibility ?? 'visibility');

const childrenCollapsed = computed<boolean>(() => {
	return branches.value?.[props.item[props.itemKey]]?.['--collapsed'] ?? true;
});
const collapsed = computed<boolean>(() => {
	return !!branches.value?.[props.item[props.itemKey]]?.['--collapsed-parents'];
});

async function deletePage(id: string | number){
	emit('delete:item', id);
}

async function openLink(slug: string){
	if(props.layoutOptions?.pageHost && slug)
		window.open(`${props.layoutOptions.pageHost}${slug}`, '_blank');
}

const itemVersions = computed(() => {
	return props.versions.filter(v => v.item === props.item[props.itemKey]);
});
// console.log('branches', branches.value);

// const cssHeight = computed(() => {
// 	return {
// 		tableRow: `${props.height + 2}px`,
// 		renderTemplateImage: `${props.height - 16}px`,
// 	};
// });

const { onSortStart, nestable } = inject('sortable') as {
	onSortStart: (item: Item, event: MouseEvent) => void;
	nestable: Ref<boolean>;
};

const { onMouseDown, onClick } = usePreventClickAfterDragging({
	mouseDownHandler: onSortStart,
	clickHandler: (event: MouseEvent) => emit('click', event),
});

function usePreventClickAfterDragging({ mouseDownHandler, clickHandler }: { mouseDownHandler: any, clickHandler: any }) {
	let dragging = false;

	return {
		onMouseDown,
		onClick,
	};

	function onMouseDown(item: Item, event: MouseEvent) {
		dragging = true;
		mouseDownHandler(item, event);

		document.addEventListener('mouseup', onMouseUp);

		function onMouseUp() {
			document.removeEventListener('mouseup', onMouseUp);
			// this does the trick
			setTimeout(() => (dragging = false), 0);
		}
	}

	function onClick(event: MouseEvent) {
		if (dragging)
			return;
		clickHandler(event);
	}
}

function pageIcon(){
	var icon = '';
	// const typeKey = props.layoutOptions?.pageType ?? 'type';
	const pageType = props.item[typeKey.value];
	if(props.indent === 0){
		icon = 'home';
	} else if(props.hasChildren){
		icon = 'topic';
	} else if(pageType == 'module'){
		icon = 'extension';
	} else if(pageType == 'sidebar'){
		icon = 'vertical_split';
	} else if(pageType == 'form'){
		icon = '3p';
	} else if(pageType == 'banner'){
		icon = 'panorama';
	} else {
		icon = 'description';
	}
	return icon;
}

function editVersion({ collection, item, primaryKeyField, versionKey }: { collection: string; item: Item; primaryKeyField: string; versionKey: string }){
	if (!primaryKeyField) return;
	const primaryKey = item[primaryKeyField];
	const route = getItemRoute(collection, primaryKey, versionKey);
	router.push(route)
}

// console.log('Item', props.item);
</script>
<template>
	<v-list-item v-if="item && branches && itemKey" :data-id="item[itemKey]" :data-sort="item.sort" class="tree-line-item line-item-header clearfix"
		:class="{
			subdued,
			clickable: hasClickListener,
			sorting,
			collapsed,
			is_draft: item.status === 'draft',
			branch: hasChildren,
			hasParent: item[parentKey],
			selected: isSelected,
			selectMode: selectMode,
		}" >
		<div
			class="pull-left"
			:class="{
				inBranch: !selectMode && !isFiltered
			}"
			:style="{
				marginLeft: !isFiltered ? `${indent}px` : '0px',
				marginRight: selectMode ? '30px' : '10px',
			}"
		>
			<BranchLine
				v-if="item[parentKey] && !selectMode && !isFiltered"
				v-model:branches="branches"
				:key="`${item[itemKey]}_${item[parentKey]}`"
				:branch-id="item[itemKey]"
				:indent-width="indentWidth"
				updateChildren
			/>
			<v-icon
				v-if="hasChildren && !isFiltered"
				:name="childrenCollapsed ? 'add_circle_outline' : 'remove_circle_outline'"
				class="collapse-btn"
				:class="{ 'children-collapsed': childrenCollapsed }"
				@click.stop="!branchLoading ? $emit('toggle-children') : false"
			/>
			<span v-else-if="!isFiltered" class="icon-placeholder"></span>
			<v-icon
				v-if="toggleSort && showManualSort && !selectMode"
				name="drag_handle"
				class="drag-handle manual"
				:class="{ 'sorted-manually': nestable }"
				@click.stop
				@mousedown.prevent="onMouseDown(item, $event)"
			/>
			<div class="tree-item-name" @click="onClick">
				<v-icon :name="pageIcon()" class="page-icon" :filled="!(visibilityKey in item) || item[visibilityKey]" :outline="visibilityKey in item && !item[visibilityKey]" />
				<v-checkbox
					v-if="showSelect !== 'none'"
					class="select"
					:class="{
						'select-mode': selectMode
					}"
					:icon-on="
						showSelect === 'one'
							? 'radio_button_checked'
							: undefined
					"
					:icon-off="
						showSelect === 'one'
							? 'radio_button_unchecked'
							: undefined
					"
					:model-value="isSelected"
					@click.stop
					@update:model-value="$emit('item-selected', $event)"
				/>
				<span class="tree-label">
					<render-template v-if="layoutOptions?.pageTitle" :collection="collection" :item="item" :template="layoutOptions.pageTitle" />
					<span v-else>{{ item[itemKey] }}</span>
				</span>
				<span v-if="layoutOptions?.pageAdditional" class="tree-additional">
					<render-template :collection="collection" :item="item" :template="layoutOptions.pageAdditional" />
				</span>
			</div>
		</div>
		<div class="pull-right">
			<div v-if="!selectMode" class="tree-actions text-right">
				<v-menu placement="left-start" show-arrow>
					<template #activator="{ toggle }">
						<v-badge v-if="versions && itemVersions.length > 0" :value="itemVersions.length">
							<v-icon name="more_vert" clickable @click="toggle" />
						</v-badge>
						<v-icon v-else name="more_vert" clickable @click="toggle" />
					</template>
					<v-list>
						<v-list-item v-if="versions" v-for="version in itemVersions" clickable @click="editVersion({ collection, item, primaryKeyField: itemKey, versionKey: version.key })">
							<v-list-item-icon>
								<v-icon name="edit" filled />
							</v-list-item-icon>
							<v-list-item-content>{{ t('edit') }} {{ version.name }}</v-list-item-content>
						</v-list-item>
						<v-list-item clickable @click="onClick">
							<v-list-item-icon>
								<v-icon name="edit" filled />
							</v-list-item-icon>
							<v-list-item-content>{{ t('edit') }}</v-list-item-content>
						</v-list-item>
						<v-list-item v-if="layoutOptions?.pageSlug && layoutOptions?.pageHost" clickable @click="openLink(item[layoutOptions.pageSlug!])">
							<v-list-item-icon>
								<v-icon name="visibility" filled />
							</v-list-item-icon>
							<v-list-item-content>Preview</v-list-item-content>
						</v-list-item>
						<!-- <v-list-item v-if="page[typefield] == 'page'" clickable :to="`/site/${page.id}`">
								<v-list-item-icon>
										<v-icon name="preview" filled />
								</v-list-item-icon>
								<v-list-item-content>Preview</v-list-item-content>
						</v-list-item>
	<v-list-item v-if="page[typefield] == 'page'" clickable :to="`/site/${page.id}`">
								<v-list-item-icon>
										<v-icon name="publish" filled />
								</v-list-item-icon>
								<v-list-item-content>Publish</v-list-item-content>
						</v-list-item> -->
						<v-list-item
							:disabled="!canDeletePages || selectMode"
							class="danger"
							clickable
							@click="deletePage(item[itemKey])"
						>
							<v-list-item-icon><v-icon name="delete" /></v-list-item-icon>
							<v-list-item-content>{{ t('delete_label') }}</v-list-item-content>
						</v-list-item>
					</v-list>
				</v-menu>
			</div>
		</div>
	</v-list-item>
</template>
<style scoped>
.icon-placeholder {
	display: block;
	min-width: 25px;
	width: 25px;
}

.v-icon.collapse-btn {
	position: relative;
	min-width: 25px;
	width: 25px;
	height: 24px;
	padding: 0 0.5px;
	z-index: 2;
	background-color: var(--theme--background);
}

.tree-line-item {
	border-bottom: 2px solid var(--theme--border-color-subdued);
	border-radius: 0;
	padding-left: 30px;
	padding-right: 30px;
	overflow: visible;
}

.tree-line-item.selectMode {
	padding-left: 0;
	padding-right: 0;
}

.tree-label, .tree-additional {
	display: flex;
	align-items: center;
	flex-grow: 1;
	flex-shrink: 1;
	min-width: 0;
	height: 48px;
	line-height: 1;
	padding-left: 6px;
	vertical-align: middle;
	color: var(--v-list-item-color);
}

.tree-additional {
	flex-grow: 0;
	flex-shrink: 0;
	justify-content: end;
}

.pull-left {
	position: relative;
	display: flex;
	align-items: center;
	white-space: nowrap;
	flex-grow: 1;
	border: 2px solid transparent;
	margin-top: -2px;
	min-width: 0;
}

.sorting .tree-label, .selected .tree-label {
	color: var(--theme--primary);
}

.sorting .pull-left:before {
	display: none;
}

.pull-right {
	display: flex;
	align-items: center;
}

.pull-right .v-icon i {
	line-height: 50px;
}

.tree-item-name {
	display: flex;
	align-items: center;
	flex-grow: 1;
	margin-left: 4px;
	min-width: 0;
}

.tree-item .tree-item-name {
  margin-left: 5px;
}

.tree-item-name .v-checkbox {
  display: none;
}

.tree-item-name:hover .page-icon,
.tree-line-item.selected .tree-item-name .page-icon,
.tree-line-item.selectMode .tree-item-name .page-icon {
  display: none;
}

.tree-item-name:hover .v-checkbox,
.tree-line-item.selected .tree-item-name .v-checkbox,
.tree-line-item.selectMode .tree-item-name .v-checkbox {
  display: flex;
}

.clearfix:after, .clearfix:before {
  display: table;
  content: " ";
  clear: both;
}

.tree-actions, .tree-actions-header {
  position: relative;
  white-space: nowrap;
  margin-top: -1px;
}

.text-right {
  text-align: right;
}

.tree-line-item .inBranch:before {
	display: block;
  content: "";
  position: absolute;
  top: 25px;
  left: -15px;
  width: 30px;
  height: 0;
  border-top: 1px dotted var(--theme--foreground-subdued);
  border-top-color: var(--theme--foreground-subdued);
  z-index: 1;
}

.inBranch .line {
	left: -16px;
	top: -28px;
}

.sorting .line {
	display: none;
}

.tree:before,
.tree .tree-item:before,
.tree .tree-folder .tree-folder-content:before {
  border-color: var(--theme--foreground);
}

.is_draft .v-icon, .is_draft .tree-label {
  color: var(--theme--foreground-subdued);
  font-style: italic;
}

.tree-line-item .drag-handle {
	--v-icon-color: var(--theme--foreground-subdued);
}

.tree-line-item .drag-handle.sorted-manually {
	--v-icon-color: var(--theme--foreground);
	cursor: ns-resize;
}

.tree-line-item .drag-handle.sorted-manually.nestable {
	cursor: move;
}

.tree-line-item .drag-handle.sorted-manually:hover {
	--v-icon-color: var(--theme--primary);
}

.tree-line-item.sorting:not(.subdued) .drag-handle {
	--v-icon-color: var(--theme--primary);
}

.tree-line-item.collapsed {
	display: none;
	visibility: hidden;
	height: 0;
	overflow: hidden;
	pointer-events: none;
}
</style>