import { computed, ref, toRefs, watch, ComputedRef } from 'vue';
import type { Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Relation, Field, Filter, PrimaryKey } from '@directus/types';
import { getEndpoint, getFieldsFromTemplate } from '@directus/utils';
import { defineLayout, useApi, useItems, useCollection, useSync, useStores } from '@directus/extensions-sdk';
import { adjustFieldsForDisplays } from './utils/adjust-fields-for-displays';
import { useLayoutClickHandler } from './composables/use-layout-click-handler';
import { useAliasFields } from './composables/use-alias-fields';
import { formatItemsCountPaginated } from './utils/format-items-count';
import { hideDragImage } from './utils/hide-drag-image';
import { LayoutProps } from '@directus/extensions';
import type { LayoutOptions, Item } from './types';
import LayoutComponent from './layout.vue';
import LayoutOptionsComponent from './options.vue';
import LayoutActionsComponent from './actions.vue';
import { syncRefProperty } from './utils/sync-ref-property';
import { flatten } from 'lodash';

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

		const { t, n } = useI18n();

		const selection = useSync(props, 'selection', emit);
		const layoutOptions = useSync(props, 'layoutOptions', emit);
		const layoutQuery = useSync(props, 'layoutQuery', emit);

		const { collection, filter, filterSystem, filterUser, search, selectMode } = toRefs(props);
		const { info, primaryKeyField, fields: fieldsInCollection, sortField } = useCollection(collection);

		const versions = ref([]);

		const { sort, limit, page, fields } = useItemOptions();

		const { aliasedFields, aliasQuery, aliasedKeys } = useAliasFields(fields, collection);

		const fieldsWithRelationalAliased = computed(() =>
			flatten(
				Object.values(aliasedFields.value).map(({ fields }) => fields),
			),
		);

		const { parentField, fieldsToQuery } = useTreeViewFieldsToQuery({
			fieldsWithRelationalAliased,
			primaryKeyField,
			sortField,
		});

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
		const { pageTitle, pageType, pageSlug, pageVisibility, pageAdditional, layoutField } = useLayoutOptions();

		const { onClick } = useLayoutClickHandler({ props, selection, primaryKeyField });

		const combinedFieldsQuery: string[] = [
			...fieldsToQuery.value,
			...fields.value,
			...layoutField.value
		];

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
			sort: ref([primaryKeyField.value?.field ?? 'id']),
			limit: selectMode ? limit : ref(-1),
			page: selectMode ? page : ref(1),
			fields: ref<string[]>(combinedFieldsQuery.filter((value, index) => combinedFieldsQuery.indexOf(value) === index)),
			alias: aliasQuery,
			filter,
			search,
			filterSystem,
		});

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
			versions,
			loading,
			filter,
			search,
			error,
			refresh,
			resetPresetAndRefresh,
			
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
			fileFields,
			pageTitle,
			pageType,
			pageSlug,
			pageVisibility,
			pageAdditional,
			
			parentField,
			fieldsWithRelationalAliased,
			aliasedFields,
			aliasedKeys,
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
			getItems();
			getTotalCount();
			getItemCount();
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
					.filter((field) => !field.meta?.hidden)
					.slice(0, 4)
					.map(({ field }) => field)
					.sort();
			});
		
			const fields = syncRefProperty(layoutQuery, 'fields', fieldsDefaultValue);
		
			return { sort, limit, page, fields };
		}

		function useTreeViewFieldsToQuery({
			fieldsWithRelationalAliased,
			primaryKeyField,
			sortField,
		}: {
			fieldsWithRelationalAliased: ComputedRef<string[]>;
			primaryKeyField: ComputedRef<Field | null>;
			sortField: ComputedRef<string | null>;
		}) {
			const parentField = syncRefProperty(layoutOptions, 'parent', null);

			const fieldsToQuery = computed(() => {
				const fieldsToQuery = fieldsWithRelationalAliased.value;
				addSortField();
				addParentField();

				return fieldsToQuery;

				function addSortField() {
					if (
						sortField.value
						&& !fieldsToQuery.includes(
							sortField.value,
						)
					) {
						fieldsToQuery.push(sortField.value);
					}
				}

				function addParentField() {
					if (
						parentField.value
						&& primaryKeyField.value
						&& !fieldsToQuery.some(
							(field) =>
								field === parentField.value
								|| field
								=== `${parentField.value}.${primaryKeyField.value?.field}`,
						)
					) {
						fieldsToQuery.push(
							`${parentField.value}.${primaryKeyField.value.field}`,
						);
					}
				}
			});

			watch(() => parentField.value, updateItemsOnNewParentQuery);

			return {
				parentField,
				fieldsToQuery,
			};

			function updateItemsOnNewParentQuery(
				newParentField: string | null | undefined,
			) {
				if (newParentField)
					refresh();
			}
		}

		// Selection and Routing
		function selectAll() {
			if (!primaryKeyField.value) return;
			const pk = primaryKeyField.value;
			selection.value = items.value.map((item) => item[pk.field]);
		}

		// Layout Options
		function useLayoutOptions() {
			// const imageSource = createViewOption<string | null>('imageSource', fileFields.value[0]?.field ?? null);
			const pageTitle = createViewOption<string | null>('pageTitle', 'title');
			const pageType = createViewOption<string | null>('pageType', 'type');
			const pageSlug = createViewOption<string | null>('pageSlug', null);
			const pageVisibility = createViewOption<string | null>('pageVisibility', null);
			const pageAdditional = createViewOption<string | null>('pageAdditional', null);

			const fields = computed<string[]>(() => {
				if (!primaryKeyField.value || !props.collection) return [];
				const fields = [];

				const templateFields: string[] = [];

				if (pageTitle.value) {
					templateFields.push(...getFieldsFromTemplate(pageTitle.value));
				}

				if(pageType.value){
					fields.push(pageType.value);
		 		}

				if(pageSlug.value){
					fields.push(pageSlug.value);
		 		}

				if(pageVisibility.value){
					fields.push(pageVisibility.value);
		 		}

				if(pageAdditional.value){
					templateFields.push(...getFieldsFromTemplate(pageAdditional.value));
				}

				return [...fields, ...adjustFieldsForDisplays(templateFields, props.collection)];
			});
		
			return { pageType, pageTitle, pageSlug, pageVisibility, pageAdditional, layoutField: fields };
		
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
				try {
					for (const [id, payload] of Object.entries(edits)) {
						await api.patch(
							`${getEndpoint(collection.value!)}/${id}`,
							payload,
						);
					}
				}
				catch (error: any) {
					unexpectedError(error);
				}

				refresh();
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
