declare type MaybeArray<T> = T | T[];
declare type ValuesOf<T extends readonly any[]> = T[number];
declare type ImmutablePrimitive =
  | undefined
  | null
  | boolean
  | string
  | number
  | Function;

declare type Immutable<T> = T extends ImmutablePrimitive
  ? T
  : T extends Array<infer U>
  ? ImmutableArray<U>
  : T extends Map<infer K, infer V>
  ? ImmutableMap<K, V>
  : T extends Set<infer M>
  ? ImmutableSet<M>
  : ImmutableObject<T>;

declare type ImmutableArray<T> = ReadonlyArray<Immutable<T>>;
declare type ImmutableMap<K, V> = ReadonlyMap<Immutable<K>, Immutable<V>>;
declare type ImmutableSet<T> = ReadonlySet<Immutable<T>>;
declare type ImmutableObject<T> = { readonly [K in keyof T]: Immutable<T[K]> };
