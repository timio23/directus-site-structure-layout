import type { Collection as CollectionRaw, CollectionType, PrimaryKey } from '@directus/types';
import type { TranslateResult } from 'vue-i18n';

export interface Branch {
	['--depth']: number;
	['--parentId']: PrimaryKey;
	children: number;
	['--collapsed']: boolean;
	['--collapsed-parents']: boolean;
};

export interface Branches {
	branch: number;
	items: number;
};

export interface Depths {
	[x: number]: (number | string)[];
};

export interface Nest {
	[x: string]: any;
	children: Nest[];
}

export type LayoutOptions = {
	parentField?: string;
	childrenField?: string;
	pageTitle?: string;
  pageType?: string;
	pageSlug?: string;
	pageHost?: string;
	pageVisibility?: string;
	pageAdditional?: string;
};

export type LayoutQuery = {
	fields: string[];
	sort: string[];
	limit: number;
	page: number;
};

export interface Collection extends CollectionRaw {
	name: string | TranslateResult;
	icon: string;
	type: CollectionType;
	color?: string | null;
}

export interface Sort {
  by: string | null;
  desc: boolean;
}

export interface Item {
	[key: string]: any;
}

export interface ItemSelectEvent {
	value: boolean;
	item: Item;
}