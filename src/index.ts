import { computed, ref, toRefs, watch, ComputedRef } from 'vue';
import type { Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Relation, Field, Filter, PrimaryKey } from '@directus/types';
import { getEndpoint, getFieldsFromTemplate } from '@directus/utils';
import { defineLayout, useApi, useItems, useCollection, useSync, useStores } from '@directus/extensions-sdk';
import { adjustFieldsForDisplays } from './utils/adjust-fields-for-displays';
import { useLayoutClickHandler } from './composables/use-layout-click-handler';
// import { useAliasFields } from './composables/use-alias-fields';
import { formatItemsCountPaginated } from './utils/format-items-count';
import { hideDragImage } from './utils/hide-drag-image';
import { LayoutProps } from '@directus/extensions';
import type { LayoutOptions, Item } from './types';
import LayoutComponent from './layout.vue';
import LayoutOptionsComponent from './options.vue';
import LayoutActionsComponent from './actions.vue';
import { syncRefProperty } from './utils/sync-ref-property';
import { clone, flatten } from 'lodash';

export default defineLayout({
	id: 'site-structure',
	name: 'Site Structure',
	icon: 'account_tree',
	component: LayoutComponent,
	slots: {
		options: LayoutOptionsComponent,
		sidebar: () => {},
		actions: LayoutActionsComponent,
	},
	headerShadow: false,
	setup(props: LayoutProps, { emit }) {
		const api = useApi();
		const { usePermissionsStore, useRelationsStore, useNotificationsStore } = useStores();
		const permissionsStore = usePermissionsStore();
		// const { useFieldsStore } = system.stores;
		// const fieldsStore = useFieldsStore();
		const loadingAll = ref(false);

		const { t, n } = useI18n();

		const selection = useSync(props, 'selection', emit);
		const layoutOptions = useSync(props, 'layoutOptions', emit);
		const layoutQuery = useSync(props, 'layoutQuery', emit);

		const { collection, filter, filterSystem, filterUser, search, selectMode } = toRefs(props);
		const { info, primaryKeyField, fields: fieldsInCollection, sortField } = useCollection(collection);

		const versions = ref([]);

		const { sort, limit, page, fields, parents } = useItemOptions();

		// const { parentField, childrenField } = useTreeViewFieldsToQuery({ primaryKeyField, sortField });

		const { parentField, childrenField, pageTitle, pageType, pageSlug, pageHost, pageVisibility, pageAdditional } = useLayoutOptions();

		const expandedParents = ref(parents.value.length > 0 ? {
			[parentField.value]: {
				_in: parents.value,
			},
		} : {});

		// const { aliasedFields, aliasQuery, aliasedKeys } = useAliasFields(fields, collection);

		// const fieldsWithRelationalAliased = computed(() =>
		// 	flatten(
		// 		Object.values(aliasedFields.value).map(({ fields }) => fields),
		// 	),
		// );

		const { isFiltered } = useFilteringTreeView({ filterUser, search });

		const canDeletePages = permissionsStore.hasPermission(collection.value ?? '', 'delete');

		const { saveEdits } = useSaveEdits();

		// Layout Options
		const relationsStore = useRelationsStore();
		const fileFields = computed(() => {
			return fieldsInCollection.value.filter((field) => {
				if (field.field === '$thumbnail') return true;

				const relation = relationsStore.relations.find((relation: Relation) => {
					return (
						relation.collection === props.collection &&
						relation.field === field.field &&
						relation.related_collection === 'directus_files'
					);
				});

				return !!relation;
			});
		});

		function fieldInCollection(field: string) {
			return fieldsInCollection.value.filter((f) => f.field === field).length > 0;
		}

		const { onClick } = useLayoutClickHandler({ props, selection, primaryKeyField });

		const initialFields = computed<string[] | null | undefined>(() => {
			let f = [];
			if(primaryKeyField.value){
				f.push(primaryKeyField.value.field);
			}

			fields.value.forEach((q: string) => {
				if(!f.includes(q)){
					f.push(q);
				}
			});

			if(parentField.value && !f.includes(parentField.value)){
				f.push(parentField.value);
			}

			if(childrenField.value && !f.includes(childrenField.value)){
				f.push(childrenField.value);
			}

			if(sortField.value && !f.includes(sortField.value)){
				f.push(sortField.value);
			}

			// layoutFields.value.forEach((q) => {
			// 	if(!f.includes(q)){
			// 		f.push(q);
			// 	}
			// });

			return f;
		});

		const allItems = ref<Item[]>([]);
		const initialFilter = computed<Filter | null | undefined>(() => {
			let f: Filter = { _and: [], };
			if(parentField.value && fieldInCollection(parentField.value)){
				f['_and'].push({
					_or: [
						{
							[parentField.value]: {
								_null: true,
							},
						},
						expandedParents.value,
					],
				});
			}
			
			if(filter.value){
				f['_and'].push(filter.value);
			}

			return f;
		});

		console.log(parentField.value, fieldInCollection(parentField.value));

		const {
			items,
			loading,
			error,
			totalPages,
			itemCount,
			totalCount,
			changeManualSort,
			getItems,
			getItemCount,
			getTotalCount
		} = useItems(collection, {
			sort: ref([sortField.value ?? primaryKeyField.value?.field ?? 'id']),
			limit: selectMode.value || isFiltered.value ? limit : ref(-1),
			// limit: ref(100),
			page: selectMode.value || isFiltered.value ? page : ref(1),
			fields: initialFields,
			filter: initialFilter,
			search,
			filterSystem,
		});

		async function fetchChildren(parentID: string){
			const response = await api.get(`/items/${collection.value}`, { params: {
				sort: [sortField.value ?? primaryKeyField.value?.field ?? 'id'],
				fields: initialFields.value,
				filter: parentField.value ? {
						[parentField.value]: {
							_eq: parentID,
						},
					} : {},
				limit: -1,
				page: 1,
			}});

			if(response && response.data){
				return response.data.data;
			}
		}
		
		function fetchAllRecords(){
			if(totalCount.value && !isFiltered.value){
				loadingAll.value = true;
				allItems.value = [];
				let next_page = 1
				const promises = [];
				while (totalCount.value > (next_page - 1) * 100) {
					const promise = fetchRemaining(next_page);
					promises.push(promise);
					next_page++;
				}

				Promise.all(promises).then(res => {
					res.map((r) => {
						if(r && r.data){
							// allItems.value.push(...r.data.data.filter((item: Item) => !currentItems.includes(item[primaryKeyField.value?.field!])));
							allItems.value.push(...r.data.data);
						}
					});
					items.value = allItems.value;
					loadingAll.value = false
				});
			}

			function fetchRemaining(page: number){
				return api.get(`/items/${collection.value}`, { params: {
					sort: [sortField.value ?? primaryKeyField.value?.field ?? 'id'],
					fields: initialFields.value,
					filter: filter.value,
					limit: 100,
					page: page
				}});
			}
		}

		async function fetchVersions() {
			try {
				const response = await api.get('/versions', { params: {
					fields: ['key', 'name', 'item', 'hash'],
					filter: {
						collection: {
							_eq: collection.value,
						},
					},
				}});

				if(response && response.data){
					versions.value = response.data.data;
				}
			}
			catch(error){
				console.error(error);
			}
		}

		fetchVersions();

		const showingCount = computed(() => {
			// Don't show count if there are no items
			if (!totalCount.value || !itemCount.value) return;

			return formatItemsCountPaginated({
				currentItems: itemCount.value,
				currentPage: page.value,
				perPage: limit.value,
				isFiltered: !!filterUser.value,
				totalItems: totalCount.value,
				i18n: { t, n },
			});
		});

		return {
			info,
			items,
			allItems,
			versions,
			loading,
			loadingAll,
			filter,
			search,
			error,
			refresh,
			resetPresetAndRefresh,
			fetchAllRecords,
			fetchChildren,
			
			// Pagination
			limit,
			page,
			toPage,
			totalPages,
			showingCount,
			itemCount,
			totalCount,
			
			// Selection
			primaryKeyField,
			onRowClick: onClick,
			selectAll,
			
			// Sorting
			sort,
			sortField,
			onSortChange,
			changeManualSort,
			fieldsInCollection,
			hideDragImage,
		
			// Layout Options
			fields,
			// layoutFields,
			fileFields,
			pageTitle,
			pageType,
			pageSlug,
			pageHost,
			pageVisibility,
			pageAdditional,
			
			parentField,
			parents,
			childrenField,
			// fieldsWithRelationalAliased,
			// aliasedFields,
			// aliasedKeys,
			saveEdits,
			canDeletePages,
			deletePage,
			isFiltered,
		};

		async function resetPresetAndRefresh() {
			await props?.resetPreset?.();
			refresh();
		}

		function refresh() {
			expandedParents.value = parents.value.length > 0 ? {
				[parentField.value]: {
					_in: parents.value,
				},
			} : {};
			getItems();
			getTotalCount();
			// if(isFiltered.value){
				getItemCount();
			// }
		}

		async function deletePage(id: string | number) {
			const pkField = primaryKeyField.value?.field;

			if (pkField === undefined || !collection.value) return;

			items.value = items.value.filter((item) => item[pkField] !== id);

			await api.delete(`${getEndpoint(collection.value)}/${id}`);

			refresh();
		}

		// Pagination and Sorting
		function toPage(newPage: number) {
			page.value = newPage;
		}
		
		function onSortChange(newSort: { by: string; desc: boolean; } | null) {
			if (!newSort?.by) {
				sort.value = [];
				return;
			}
		
			let sortString = newSort.by;
		
			if (newSort.desc === true) {
				sortString = '-' + sortString;
			}
		
			sort.value = [sortString];
		}
		
		function useItemOptions() {
			// Pagination
			const page = syncRefProperty(layoutQuery, 'page', 1);
			const limit = syncRefProperty(layoutQuery, 'limit', 25);
			
			// Sort
			const defaultSort = computed(() => (primaryKeyField.value ? [primaryKeyField.value?.field] : []));
			const sort = syncRefProperty(layoutQuery, 'sort', defaultSort);
		
			const fieldsDefaultValue = computed(() => {
				return fieldsInCollection.value
					.filter((field) => !field.meta?.hidden && field.type != 'alias')
					.slice(0, 4)
					.map(({ field }) => field)
					.sort();
			});
		
			const parents = syncRefProperty(layoutQuery, 'parents', []);
			const fields = syncRefProperty(layoutQuery, 'fields', fieldsDefaultValue);
		
			return { sort, limit, page, fields, parents };
		}

		// function useTreeViewFieldsToQuery({
		// 	primaryKeyField,
		// 	sortField,
		// }: {
		// 	primaryKeyField: ComputedRef<Field | null>;
		// 	sortField: ComputedRef<string | null>;
		// }) {
		// 	const parentField = syncRefProperty(layoutOptions, 'parent', null);
		// 	const childrenField = syncRefProperty(layoutOptions, 'childrenField', null);

		// 	// addSortField();
		// 	// addParentField();
		// 	// addChildrenField();

		// 	// const fieldsToQuery = computed(() => {
		// 	// 	const fieldsToQuery = fieldsWithRelationalAliased.value;
				

		// 	// 	return fieldsToQuery;

				
		// 	// });

		// 	// watch(() => [parentField.value, childrenField.value], ([newVal]) => {
		// 	// 	console.log(newVal);
		// 	// 	updateItemsOnNewParentQuery(newVal)
		// 	// });

		// 	return {
		// 		parentField,
		// 		childrenField,
		// 		// fieldsToQuery,
		// 	};

		// 	// function addSortField() {
		// 	// 	if (sortField.value && !fields.value.includes(sortField.value)) {
		// 	// 		fields.value.push(sortField.value);
		// 	// 	}
		// 	// }

		// 	// function addParentField() {
		// 	// 	if (
		// 	// 		parentField.value
		// 	// 		&& primaryKeyField.value
		// 	// 		&& !fields.value.some((field: string) => field === parentField.value || field === `${parentField.value}.${primaryKeyField.value?.field}`)
		// 	// 	) {
		// 	// 		fields.value.push(
		// 	// 			// `${parentField.value}.${primaryKeyField.value.field}`,
		// 	// 			parentField.value
		// 	// 		);
		// 	// 	}
		// 	// }

		// 	// function addChildrenField() {
		// 	// 	if (childrenField.value && !fields.value.includes(childrenField.value)) {
		// 	// 		fields.value.push(childrenField.value);
		// 	// 	}
		// 	// }

		// 	// function updateItemsOnNewParentQuery(newRelationalField: string | null | undefined) {
		// 	// 	if (newRelationalField)
		// 	// 		refresh();
		// 	// }
		// }

		// Selection and Routing
		function selectAll() {
			if (!primaryKeyField.value) return;
			const pk = primaryKeyField.value;
			selection.value = items.value.map((item) => item[pk.field]);
		}

		// Layout Options
		function useLayoutOptions() {
			// const imageSource = createViewOption<string | null>('imageSource', fileFields.value[0]?.field ?? null);
			const parentField = syncRefProperty(layoutOptions, 'parent', null);
			const childrenField = syncRefProperty(layoutOptions, 'childrenField', null);
			// const parentField = createViewOption<string | null>('parentField', null);
			// const childrenField = createViewOption<string | null>('childrenField', null);
			const pageTitle = createViewOption<string | null>('pageTitle', 'title');
			const pageType = createViewOption<string | null>('pageType', 'type');
			const pageSlug = createViewOption<string | null>('pageSlug', null);
			const pageHost = createViewOption<string | null>('pageHost', null);
			const pageVisibility = createViewOption<string | null>('pageVisibility', null);
			const pageAdditional = createViewOption<string | null>('pageAdditional', null);

			const templateFields: string[] = [];

			if(parentField.value){
				fields.value.push(parentField.value);
			}

			if(childrenField.value){
				fields.value.push(childrenField.value);
			}

			if (pageTitle.value) {
				templateFields.push(...getFieldsFromTemplate(pageTitle.value));
			}

			if(pageType.value){
				fields.value.push(pageType.value);
			}

			if(pageSlug.value){
				fields.value.push(pageSlug.value);
			}

			if(pageVisibility.value){
				fields.value.push(pageVisibility.value);
			}

			if(pageAdditional.value){
				templateFields.push(...getFieldsFromTemplate(pageAdditional.value));
			}

			if(props.collection){
				fields.value.push(...adjustFieldsForDisplays(templateFields, props.collection));
			}

			// const layoutFields = computed<string[]>(() => {
			// 	if (!primaryKeyField.value || !props.collection) return [];
			// 	// const fields = [];

			watch(() => [props.collection, parentField.value, childrenField.value], () => {
				console.log(props.collection);
				refresh();
			});

			// 	return [];
			// });
		
			return { parentField, childrenField, pageType, pageTitle, pageSlug, pageHost, pageVisibility, pageAdditional };
		
			function createViewOption<T>(key: keyof LayoutOptions, defaultValue: any) {
				return computed({
					get() {
						return layoutOptions.value?.[key] !== undefined ? layoutOptions.value?.[key] : defaultValue;
					},
					set(newValue) {
						layoutOptions.value = {
							...layoutOptions.value,
							[key]: newValue,
						};
					},
				});
			}
		}

		function useFilteringTreeView({
			filterUser,
			search,
		}: {
			filterUser: Ref<Filter | null>;
			search: Ref<string | null | undefined>;
		}) {
			const isFiltered = computed(
				() => !!filterUser.value || !!search.value,
			);

			watch(() => isFiltered.value, turnOffManualSortOnFilter);

			return {
				isFiltered,
			};

			function turnOffManualSortOnFilter(filterIsActive: boolean) {
				if (filterIsActive)
					onSortChange(null);
			}
		}

		function useSaveEdits() {
			// const api = useApi();
			const { unexpectedError } = useUnexpectedError();

			return { saveEdits };

			async function saveEdits(edits: Record<PrimaryKey, Item>) {
				let newItems = clone(items.value);
				let changes: any = {};
				const primaryKey = primaryKeyField.value?.field! ?? 'id';
				for (const item of newItems) {
					if(item[primaryKey] in edits){
						item[parentField.value] = edits[item[primaryKey]]?.[parentField.value] ?? item[parentField.value];
						if(sortField.value){
							if(edits[item[primaryKey]]?.[sortField.value] != item[sortField.value]){
								console.log("change", `${edits[item[primaryKey]]?.[sortField.value]} != ${item[sortField.value]}`);
								changes[item[primaryKey]] = edits[item[primaryKey]];
							}
							item[sortField.value] = edits[item[primaryKey]]?.[sortField.value] ?? item[sortField.value];
						}
					}
				}

				items.value = newItems;
				allItems.value = [];

				try {
					for (const [id, payload] of Object.entries(changes)) {
						await api.patch(
							`${getEndpoint(collection.value!)}/${id}`,
							payload,
						);
					}
				}
				catch (error: any) {
					unexpectedError(error);
				}

				// refresh();
			}

			// Based from the core: /app/src/utils/unexpected-error.ts
			function useUnexpectedError() {
				const notificationStore = useNotificationsStore();
				return {
					unexpectedError(error: any) {
						const code = error.response?.data?.errors?.[0]?.extensions?.code || error?.extensions?.code || 'UNKNOWN';

						notificationStore.add({
							title: t(`errors.${code}`),
							type: 'error',
							code,
							dialog: true,
							error,
						});
					},
				};
			}
		}
	},
});
