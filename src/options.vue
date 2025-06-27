<script setup lang="ts">
import { useSync } from '@directus/extensions-sdk';
import { useI18n } from 'vue-i18n';
import { Field } from '@directus/types';
import { computed } from 'vue';

const props = defineProps<{
	collection: string;
  fieldsInCollection: any;
	fileFields: Field[];
  fields: Field[];
  sortField: string;
  parentField: string | null;
  childrenField: string | null;
	pageTitle: string | null;
  pageType: string | null;
  pageSlug: string | null;
  pageVisibility: string | null;
  pageAdditional: string | null;
}>();

const emit = defineEmits([
  'update:parentField',
  'update:childrenField',
  'update:pageTitle',
  'update:pageType',
  'update:pageSlug',
  'update:pageVisibility',
  'update:pageAdditional',
]);

const { t } = useI18n();

const parentFieldWritable = useSync(props, 'parentField', emit);
const childrenFieldWritable = useSync(props, 'childrenField', emit);
const titleWritable = useSync(props, 'pageTitle', emit);
const pageTypeWritable = useSync(props, 'pageType', emit);
const pageSlugWritable = useSync(props, 'pageSlug', emit);
const pageVisibilityWritable = useSync(props, 'pageVisibility', emit);
const additionalWritable = useSync(props, 'pageAdditional', emit);

const selfReferencingM2oFields = computed(() => {
	return props.fieldsInCollection?.filter(
		(field: Field) =>
			['string', 'uuid', 'integer', 'bigInteger'].includes(
				field.type,
			)
			&& field.meta?.special?.includes('m2o')
			&& field.schema?.foreign_key_table === props.collection,
	);
});

const O2mFields = computed(() => {
	return props.fieldsInCollection?.filter(
		(field: Field) =>
			field.type === 'alias'
			&& field.meta?.special?.includes('o2m')
	);
});

const stringFields = computed(() => {
  return props.fieldsInCollection?.filter(
    (field: Field) => field.type === 'string'
  );
});

const booleanFields = computed(() => {
  return props.fieldsInCollection?.filter(
    (field: Field) => field.type === 'boolean'
  );
});
</script>
<template>
  <div v-if="!sortField" class="field">
    <v-notice type="warning">
      Specify a sort field in your data model settings!
    </v-notice>
  </div>
  <div v-else class="fields">
    <div class="field">
      <div class="type-label">Parent (M2O)</div>
      <v-notice v-if="!selfReferencingM2oFields?.length" type="warning">
        Create a M2O field that references this collection in your data
        model settings!
      </v-notice>

      <template v-else>
        <v-select v-model="parentFieldWritable" :items="selfReferencingM2oFields" item-value="field" item-text="name"
          show-deselect :placeholder="t('select_a_field')" />

        <small v-if="!parentFieldWritable" class="type-note">Note that selecting a field can immediately update the sort
          values of your items!</small>
      </template>
    </div>

    <div class="field">
      <div class="type-label">Children (O2M)</div>
      <v-notice v-if="!O2mFields?.length" type="warning">
        Create a O2M children field that references this collection in your data
        model settings!
      </v-notice>

      <template v-else>
        <v-select v-model="childrenFieldWritable" :items="O2mFields" item-value="field" item-text="name"
          show-deselect :placeholder="t('select_a_field')" />

        <small v-if="!childrenFieldWritable" class="type-note">Note that selecting a field can immediately update the sort
          values of your items!</small>
      </template>
    </div>


    <div class="field">
      <div class="type-label">{{ t('layouts.cards.title') }}</div>
      <v-collection-field-template v-model="titleWritable" :collection="collection" />
    </div>

    <div class="field">
      <div class="type-label">{{ t('type') }}</div>
      <v-select v-model="pageTypeWritable" show-deselect item-value="field" item-text="name" :items="stringFields"
      :placeholder="t('select_a_field')" />
    </div>

    <div class="field">
      <div class="type-label">Slug {{ t('field') }}</div>
      <v-select v-model="pageSlugWritable" show-deselect item-value="field" item-text="name" :items="stringFields"
      :placeholder="t('select_a_field')" />
    </div>

    <div class="field">
      <div class="type-label">{{ t('visible') }} {{ t('field') }}</div>
      <v-select v-model="pageVisibilityWritable" show-deselect item-value="field" item-text="name" :items="booleanFields"
      :placeholder="t('select_a_field')" />
    </div>

    <div class="field">
      <div class="type-label">Additional Information</div>
      <v-collection-field-template v-model="additionalWritable" :collection="collection" />
    </div>
  </div>
</template>
<style scoped>
.fields {
  grid-column: start/full;
}

.fields .field {
  margin-bottom: 24px;
}

.v-notice {
	--v-notice-background-color: var(--theme--background-accent);
}
</style>